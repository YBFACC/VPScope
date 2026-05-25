use crate::{
    app_state::AppState,
    errors::AppError,
    metrics::snapshot::ProcessInfo,
    parsers::process::{filter_sort_limit, parse_ps_output},
    ssh::RemoteCommand,
};
use tauri::State;

#[tauri::command(rename_all = "camelCase")]
pub async fn process_list(
    host_id: String,
    sort_by: String,
    sort_direction: String,
    filter: Option<String>,
    limit: Option<usize>,
    state: State<'_, AppState>,
) -> Result<Vec<ProcessInfo>, AppError> {
    let host = state.config_store.get_host(&host_id)?;
    let ps = state
        .ssh_pool
        .client()
        .exec(&host, RemoteCommand::Ps)
        .await?;
    let processes = parse_ps_output(&ps)?;
    Ok(filter_sort_limit(
        processes,
        &sort_by,
        &sort_direction,
        filter.as_deref(),
        limit,
    ))
}
