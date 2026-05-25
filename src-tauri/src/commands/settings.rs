use crate::{
    app_state::AppState,
    config::{AlertSettings, TraySettings},
    errors::AppError,
};
use tauri::State;

#[tauri::command]
pub fn health_check() -> &'static str {
    "ok"
}

#[tauri::command]
pub fn tray_settings_get(state: State<'_, AppState>) -> Result<TraySettings, AppError> {
    state.config_store.get_tray_settings()
}

#[tauri::command]
pub fn tray_settings_update(
    state: State<'_, AppState>,
    settings: TraySettings,
) -> Result<TraySettings, AppError> {
    let settings = state.config_store.update_tray_settings(settings)?;
    state.tray_state.set_settings(settings.clone());
    Ok(settings)
}

#[tauri::command]
pub fn alert_settings_get(state: State<'_, AppState>) -> Result<AlertSettings, AppError> {
    state.config_store.get_alert_settings()
}

#[tauri::command]
pub fn alert_settings_update(
    state: State<'_, AppState>,
    settings: AlertSettings,
) -> Result<AlertSettings, AppError> {
    state.config_store.update_alert_settings(settings)
}
