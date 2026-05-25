use crate::{
    app_state::AppState,
    config::OkResult,
    errors::AppError,
    metrics::{scheduler::MetricsSubscribeResult, snapshot::HostSnapshot, CollectionProfile},
};
use tauri::{AppHandle, State};

#[tauri::command(rename_all = "camelCase")]
pub async fn metrics_subscribe(
    host_id: String,
    interval_ms: Option<u64>,
    profile: Option<CollectionProfile>,
    state: State<'_, AppState>,
    app: AppHandle,
) -> Result<MetricsSubscribeResult, AppError> {
    let host = state.config_store.get_host(&host_id)?;
    state.metrics_scheduler.subscribe(
        host,
        state.ssh_pool.client(),
        app,
        interval_ms,
        profile.unwrap_or_default(),
    )
}

#[tauri::command(rename_all = "camelCase")]
pub fn metrics_unsubscribe(
    subscription_id: String,
    state: State<'_, AppState>,
    app: AppHandle,
) -> Result<OkResult, AppError> {
    if let Some(host_id) = state.metrics_scheduler.unsubscribe(&subscription_id)? {
        state
            .metrics_scheduler
            .schedule_idle_disconnect(host_id, state.ssh_pool.client(), app)?;
    }

    Ok(OkResult { ok: true })
}

#[tauri::command(rename_all = "camelCase")]
pub fn metrics_last_snapshot(
    host_id: String,
    state: State<'_, AppState>,
) -> Result<Option<HostSnapshot>, AppError> {
    let _ = state.config_store.get_host(&host_id)?;
    state.metrics_scheduler.latest_snapshot(&host_id)
}
