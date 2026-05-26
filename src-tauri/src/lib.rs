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
        alert_settings_get, alert_settings_update, health_check, host_create, host_delete,
        host_list, host_open_terminal, host_ssh_config_list, host_test_connection, host_update,
        metrics_last_snapshot, metrics_subscribe, metrics_unsubscribe, process_list,
        terminal_settings_get, terminal_settings_update, tray_settings_get, tray_settings_update,
    };
    use tauri::{Manager, WindowEvent};
    use tray::setup_tray;

    tauri::Builder::default()
        .plugin(tauri_plugin_notification::init())
        .on_window_event(|window, event| {
            if window.label() != "main" {
                return;
            }

            if let WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.hide();
            }
        })
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
            host_open_terminal,
            host_ssh_config_list,
            host_test_connection,
            metrics_last_snapshot,
            metrics_subscribe,
            metrics_unsubscribe,
            process_list,
            alert_settings_get,
            alert_settings_update,
            terminal_settings_get,
            terminal_settings_update,
            tray_settings_get,
            tray_settings_update,
        ])
        .build(tauri::generate_context!())
        .expect("failed to build VPScope application")
        .run(handle_run_event);
}

fn handle_run_event(app: &tauri::AppHandle, event: tauri::RunEvent) {
    #[cfg(target_os = "macos")]
    if let tauri::RunEvent::Reopen {
        has_visible_windows: false,
        ..
    } = event
    {
        tray::show_main_window(app);
    }

    #[cfg(not(target_os = "macos"))]
    {
        let _ = app;
        let _ = event;
    }
}
