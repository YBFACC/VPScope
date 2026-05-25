use crate::{
    app_state::AppState,
    config::OkResult,
    errors::AppError,
    events::{ConnectionStatus, HostConnectionState, HOST_CONNECTION_STATE},
    metrics::scheduler::MetricsSubscribeResult,
};
use tauri::{AppHandle, Emitter, State};

#[tauri::command(rename_all = "camelCase")]
pub async fn metrics_subscribe(
    host_id: String,
    interval_ms: Option<u64>,
    state: State<'_, AppState>,
    app: AppHandle,
) -> Result<MetricsSubscribeResult, AppError> {
    let host = state.config_store.get_host(&host_id)?;
    state
        .metrics_scheduler
        .subscribe(host, state.ssh_pool.client(), app, interval_ms)
}

#[tauri::command(rename_all = "camelCase")]
pub fn metrics_unsubscribe(
    subscription_id: String,
    state: State<'_, AppState>,
    app: AppHandle,
) -> Result<OkResult, AppError> {
    if let Some(host_id) = state.metrics_scheduler.unsubscribe(&subscription_id)? {
        state.ssh_pool.client().disconnect_host(&host_id)?;
        app.emit(
            HOST_CONNECTION_STATE,
            HostConnectionState {
                host_id,
                status: ConnectionStatus::Disconnected,
                message: Some("subscription stopped".to_string()),
                latency_ms: None,
                last_connected_at: None,
                last_error: None,
            },
        )
        .map_err(|err| {
            AppError::internal("Failed to emit connection state").with_detail(err.to_string())
        })?;
    }

    Ok(OkResult { ok: true })
}
