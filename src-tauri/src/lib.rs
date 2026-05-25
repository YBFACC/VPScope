pub mod app_state;
pub mod commands;
pub mod config;
pub mod credentials;
pub mod errors;
pub mod events;
pub mod metrics;
pub mod parsers;
pub mod ssh;
pub mod tray;

pub fn run() {
    use app_state::AppState;
    use commands::{
        health_check, host_create, host_delete, host_list, host_ssh_config_list,
        host_test_connection, host_update, metrics_subscribe, metrics_unsubscribe, process_list,
        tray_settings_get, tray_settings_update,
    };
    use tauri::Manager;
    use tray::setup_tray;

    tauri::Builder::default()
        .setup(|app| {
            let config_dir = app.path().app_config_dir()?;
            app.manage(AppState::new(config_dir)?);
            setup_tray(app)?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            health_check,
            host_list,
            host_create,
            host_update,
            host_delete,
            host_ssh_config_list,
            host_test_connection,
            metrics_subscribe,
            metrics_unsubscribe,
            process_list,
            tray_settings_get,
            tray_settings_update,
        ])
        .run(tauri::generate_context!())
        .expect("failed to run VPScope application");
}
