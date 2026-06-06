use crate::{
    config::{storage::unix_ms, HostConfig},
    errors::AppError,
    events::{
        ConnectionStatus, HostConnectionState, HOST_CONNECTION_STATE, METRICS_ERROR,
        METRICS_SNAPSHOT,
    },
    metrics::{
        collector::{CollectionProfile, MetricsCollector},
        snapshot::HostSnapshot,
    },
    ssh::DynSshClient,
    tray::TrayState,
};
use serde::Serialize;
use std::{
    collections::HashMap,
    sync::{Arc, RwLock},
    time::Duration,
};
use tauri::{
    async_runtime::{self, JoinHandle},
    AppHandle, Emitter,
};
use uuid::Uuid;

const SSH_IDLE_DISCONNECT_MS: u64 = 300_000;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MetricsSubscribeResult {
    pub subscription_id: String,
}

#[derive(Debug)]
struct SubscriptionTask {
    host_id: String,
    handle: JoinHandle<()>,
}

pub struct MetricsScheduler {
    subscriptions: RwLock<HashMap<String, SubscriptionTask>>,
    idle_disconnects: RwLock<HashMap<String, JoinHandle<()>>>,
    snapshots: Arc<RwLock<HashMap<String, HostSnapshot>>>,
    tray_state: Arc<TrayState>,
}

impl MetricsScheduler {
    pub fn new(tray_state: Arc<TrayState>) -> Self {
        Self {
            subscriptions: RwLock::new(HashMap::new()),
            idle_disconnects: RwLock::new(HashMap::new()),
            snapshots: Arc::new(RwLock::new(HashMap::new())),
            tray_state,
        }
    }

    pub fn subscribe(
        &self,
        host: HostConfig,
        ssh: DynSshClient,
        app: AppHandle,
        interval_ms: Option<u64>,
        profile: CollectionProfile,
    ) -> Result<MetricsSubscribeResult, AppError> {
        let subscription_id = Uuid::new_v4().to_string();
        let host_id = host.id.clone();
        self.cancel_idle_disconnect(&host_id)?;
        let interval = Duration::from_millis(
            profile.resolve_interval_ms(interval_ms, host.refresh_interval_ms),
        );
        let handle = async_runtime::spawn(run_subscription_loop(
            host,
            ssh,
            app,
            interval,
            profile,
            Arc::clone(&self.snapshots),
            self.tray_state.clone(),
        ));

        self.subscriptions
            .write()
            .map_err(|_| AppError::internal("Metrics scheduler lock is poisoned"))?
            .insert(
                subscription_id.clone(),
                SubscriptionTask { host_id, handle },
            );
        Ok(MetricsSubscribeResult { subscription_id })
    }

    pub fn unsubscribe(&self, subscription_id: &str) -> Result<Option<String>, AppError> {
        let subscription = self
            .subscriptions
            .write()
            .map_err(|_| AppError::internal("Metrics scheduler lock is poisoned"))?
            .remove(subscription_id);

        if let Some(subscription) = subscription {
            subscription.handle.abort();
            let host_id = subscription.host_id;
            let has_remaining_host_subscription = self
                .subscriptions
                .read()
                .map_err(|_| AppError::internal("Metrics scheduler lock is poisoned"))?
                .values()
                .any(|subscription| subscription.host_id == host_id);

            if has_remaining_host_subscription {
                return Ok(None);
            }

            return Ok(Some(host_id));
        }

        Ok(None)
    }

    pub fn remove_host_runtime(&self, host_id: &str) -> Result<usize, AppError> {
        let removed_subscriptions = {
            let mut subscriptions = self
                .subscriptions
                .write()
                .map_err(|_| AppError::internal("Metrics scheduler lock is poisoned"))?;

            let subscription_ids = subscriptions
                .iter()
                .filter_map(|(subscription_id, subscription)| {
                    (subscription.host_id == host_id).then(|| subscription_id.clone())
                })
                .collect::<Vec<_>>();

            subscription_ids
                .into_iter()
                .filter_map(|subscription_id| subscriptions.remove(&subscription_id))
                .collect::<Vec<_>>()
        };

        for subscription in &removed_subscriptions {
            subscription.handle.abort();
        }

        self.cancel_idle_disconnect(host_id)?;
        self.snapshots
            .write()
            .map_err(|_| AppError::internal("Metrics snapshot cache lock is poisoned"))?
            .remove(host_id);
        self.tray_state.remove_host_snapshot(host_id);

        Ok(removed_subscriptions.len())
    }

    pub fn latest_snapshot(&self, host_id: &str) -> Result<Option<HostSnapshot>, AppError> {
        Ok(self
            .snapshots
            .read()
            .map_err(|_| AppError::internal("Metrics snapshot cache lock is poisoned"))?
            .get(host_id)
            .cloned())
    }

    pub fn schedule_idle_disconnect(
        self: &Arc<Self>,
        host_id: String,
        ssh: DynSshClient,
        app: AppHandle,
    ) -> Result<(), AppError> {
        self.cancel_idle_disconnect(&host_id)?;

        let scheduler = Arc::clone(self);
        let task_host_id = host_id.clone();
        let handle = async_runtime::spawn(async move {
            tokio::time::sleep(Duration::from_millis(SSH_IDLE_DISCONNECT_MS)).await;

            if scheduler
                .host_has_subscriptions(&task_host_id)
                .unwrap_or(true)
            {
                let _ = scheduler.remove_idle_disconnect(&task_host_id);
                return;
            }

            let _ = ssh.disconnect_host(&task_host_id);
            let _ = scheduler.remove_idle_disconnect(&task_host_id);
            emit_connection_state(
                &app,
                HostConnectionState {
                    host_id: task_host_id,
                    status: ConnectionStatus::Disconnected,
                    message: Some("SSH session closed after idle timeout".to_string()),
                    latency_ms: None,
                    last_connected_at: None,
                    last_error: None,
                },
            );
        });

        self.idle_disconnects
            .write()
            .map_err(|_| AppError::internal("Idle disconnect lock is poisoned"))?
            .insert(host_id, handle);

        Ok(())
    }

    pub fn snapshot_ts(&self) -> u64 {
        unix_ms()
    }

    fn cancel_idle_disconnect(&self, host_id: &str) -> Result<(), AppError> {
        if let Some(handle) = self
            .idle_disconnects
            .write()
            .map_err(|_| AppError::internal("Idle disconnect lock is poisoned"))?
            .remove(host_id)
        {
            handle.abort();
        }

        Ok(())
    }

    fn remove_idle_disconnect(&self, host_id: &str) -> Result<(), AppError> {
        self.idle_disconnects
            .write()
            .map_err(|_| AppError::internal("Idle disconnect lock is poisoned"))?
            .remove(host_id);
        Ok(())
    }

    fn host_has_subscriptions(&self, host_id: &str) -> Result<bool, AppError> {
        Ok(self
            .subscriptions
            .read()
            .map_err(|_| AppError::internal("Metrics scheduler lock is poisoned"))?
            .values()
            .any(|subscription| subscription.host_id == host_id))
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MetricsErrorEvent {
    pub host_id: String,
    pub ts: u64,
    pub error: AppError,
}

pub type SnapshotEvent = HostSnapshot;

async fn run_subscription_loop(
    host: HostConfig,
    ssh: DynSshClient,
    app: AppHandle,
    interval: Duration,
    profile: CollectionProfile,
    snapshots: Arc<RwLock<HashMap<String, HostSnapshot>>>,
    tray_state: Arc<TrayState>,
) {
    let mut collector = MetricsCollector::new();
    emit_connection_state(
        &app,
        HostConnectionState {
            host_id: host.id.clone(),
            status: ConnectionStatus::Connecting,
            message: Some("collecting metrics".to_string()),
            latency_ms: None,
            last_connected_at: None,
            last_error: None,
        },
    );

    loop {
        let ts = unix_ms();
        match collector.collect(&host, ssh.clone(), ts, profile).await {
            Ok(snapshot) => {
                let host_id = snapshot.host_id.clone();
                if let Ok(mut cache) = snapshots.write() {
                    cache.insert(host_id.clone(), snapshot.clone());
                }
                tray_state.update_snapshot(&snapshot);
                let _ = app.emit(METRICS_SNAPSHOT, snapshot);
                emit_connection_state(
                    &app,
                    HostConnectionState {
                        host_id,
                        status: ConnectionStatus::Connected,
                        message: Some("receiving live metrics".to_string()),
                        latency_ms: None,
                        last_connected_at: Some(ts),
                        last_error: None,
                    },
                );
            }
            Err(error) => {
                let _ = app.emit(
                    METRICS_ERROR,
                    MetricsErrorEvent {
                        host_id: host.id.clone(),
                        ts,
                        error: error.clone(),
                    },
                );
                emit_connection_state(
                    &app,
                    HostConnectionState {
                        host_id: host.id.clone(),
                        status: ConnectionStatus::Error,
                        message: Some(error.message.clone()),
                        latency_ms: None,
                        last_connected_at: None,
                        last_error: Some(error),
                    },
                );
            }
        }

        tokio::time::sleep(interval).await;
    }
}

fn emit_connection_state(app: &AppHandle, state: HostConnectionState) {
    let _ = app.emit(HOST_CONNECTION_STATE, state);
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{
        config::{HostAuth, HostConfig, TraySettings},
        metrics::collector::MetricsCollector,
    };
    use std::future;

    fn host(id: &str) -> HostConfig {
        HostConfig {
            id: id.to_string(),
            name: id.to_string(),
            address: "203.0.113.10".to_string(),
            port: 22,
            auth: HostAuth::SshAgent {
                username: "ubuntu".to_string(),
            },
            refresh_interval_ms: 2_000,
            tags: Vec::new(),
            created_at: 1,
            updated_at: 1,
        }
    }

    fn insert_subscription(scheduler: &MetricsScheduler, subscription_id: &str, host_id: &str) {
        let handle = async_runtime::spawn(async {
            future::pending::<()>().await;
        });
        scheduler
            .subscriptions
            .write()
            .expect("subscriptions lock")
            .insert(
                subscription_id.to_string(),
                SubscriptionTask {
                    host_id: host_id.to_string(),
                    handle,
                },
            );
    }

    #[tokio::test]
    async fn remove_host_runtime_aborts_only_deleted_host_subscriptions_and_clears_snapshot() {
        let tray_state = Arc::new(TrayState::new(TraySettings::default()));
        let scheduler = MetricsScheduler::new(tray_state);

        insert_subscription(&scheduler, "deleted-active", "deleted-host");
        insert_subscription(&scheduler, "deleted-tray", "deleted-host");
        insert_subscription(&scheduler, "kept-overview", "kept-host");

        scheduler.snapshots.write().expect("snapshot lock").insert(
            "deleted-host".to_string(),
            MetricsCollector::warming_snapshot(&host("deleted-host"), 1),
        );
        scheduler.snapshots.write().expect("snapshot lock").insert(
            "kept-host".to_string(),
            MetricsCollector::warming_snapshot(&host("kept-host"), 1),
        );

        let removed = scheduler
            .remove_host_runtime("deleted-host")
            .expect("remove runtime");

        assert_eq!(removed, 2);
        assert!(scheduler
            .subscriptions
            .read()
            .expect("subscriptions lock")
            .values()
            .all(|subscription| subscription.host_id != "deleted-host"));
        assert!(scheduler.latest_snapshot("deleted-host").unwrap().is_none());
        assert!(scheduler.latest_snapshot("kept-host").unwrap().is_some());
        assert!(scheduler
            .subscriptions
            .read()
            .expect("subscriptions lock")
            .values()
            .any(|subscription| subscription.host_id == "kept-host"));
    }
}
