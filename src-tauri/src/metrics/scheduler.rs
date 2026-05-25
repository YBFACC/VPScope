use crate::{
    config::{storage::unix_ms, HostConfig},
    errors::AppError,
    events::{
        ConnectionStatus, HostConnectionState, HOST_CONNECTION_STATE, METRICS_ERROR,
        METRICS_SNAPSHOT,
    },
    metrics::{collector::MetricsCollector, snapshot::HostSnapshot},
    ssh::DynSshClient,
    tray::TrayState,
};
use serde::Serialize;
use std::{
    collections::HashMap,
    sync::{Arc, RwLock},
    time::Duration,
};
use tauri::{AppHandle, Emitter};
use tokio::task::JoinHandle;
use uuid::Uuid;

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
    tray_state: Arc<TrayState>,
}

impl MetricsScheduler {
    pub fn new(tray_state: Arc<TrayState>) -> Self {
        Self {
            subscriptions: RwLock::new(HashMap::new()),
            tray_state,
        }
    }

    pub fn subscribe(
        &self,
        host: HostConfig,
        ssh: DynSshClient,
        app: AppHandle,
        interval_ms: Option<u64>,
    ) -> Result<MetricsSubscribeResult, AppError> {
        let subscription_id = Uuid::new_v4().to_string();
        let host_id = host.id.clone();
        let interval =
            Duration::from_millis(resolve_interval_ms(interval_ms, host.refresh_interval_ms));
        let handle = tokio::spawn(run_subscription_loop(
            host,
            ssh,
            app,
            interval,
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

    pub fn snapshot_ts(&self) -> u64 {
        unix_ms()
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
        match collector.collect(&host, ssh.clone(), ts).await {
            Ok(snapshot) => {
                let host_id = snapshot.host_id.clone();
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

fn resolve_interval_ms(requested: Option<u64>, host_default: u64) -> u64 {
    requested.unwrap_or(host_default).clamp(500, 10_000)
}

fn emit_connection_state(app: &AppHandle, state: HostConnectionState) {
    let _ = app.emit(HOST_CONNECTION_STATE, state);
}
