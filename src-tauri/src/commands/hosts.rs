use crate::{
    app_state::AppState,
    config::storage::unix_ms,
    config::{
        HostAuth, HostConfig, HostCreatePayload, HostDeletePayload, HostPatch, HostReorderPayload,
        HostUpdatePayload, OkResult, TerminalApp,
    },
    errors::AppError,
};
use serde::Serialize;
use std::{
    fs::{self, Permissions},
    os::unix::fs::PermissionsExt,
    path::{Path, PathBuf},
    process::Command,
};
use tauri::State;
use uuid::Uuid;

#[tauri::command]
pub fn host_list(state: State<'_, AppState>) -> Result<Vec<HostConfig>, AppError> {
    state.config_store.list_hosts()
}

#[tauri::command(rename_all = "camelCase")]
pub fn host_create(
    name: String,
    address: String,
    port: u16,
    auth: HostAuth,
    refresh_interval_ms: u64,
    tags: Option<Vec<String>>,
    state: State<'_, AppState>,
) -> Result<HostConfig, AppError> {
    let id = Uuid::new_v4().to_string();
    let payload = HostCreatePayload {
        name,
        address,
        port,
        auth,
        refresh_interval_ms,
        tags: tags.unwrap_or_default(),
    };
    state.config_store.validate_host_create(&payload)?;

    state.config_store.create_host_with_id(id, payload)
}

#[tauri::command]
pub fn host_update(
    payload: Option<HostUpdatePayload>,
    id: Option<String>,
    patch: Option<HostPatch>,
    state: State<'_, AppState>,
) -> Result<HostConfig, AppError> {
    let payload = match payload {
        Some(payload) => payload,
        None => HostUpdatePayload {
            id: id.ok_or_else(|| AppError::config_invalid("Host id is required"))?,
            patch: patch.ok_or_else(|| AppError::config_invalid("Host patch is required"))?,
        },
    };
    state
        .config_store
        .validate_host_update(&payload.id, &payload.patch)?;
    state.config_store.update_host(&payload.id, payload.patch)
}

#[tauri::command]
pub fn host_reorder(
    payload: Option<HostReorderPayload>,
    ordered_host_ids: Option<Vec<String>>,
    state: State<'_, AppState>,
) -> Result<Vec<HostConfig>, AppError> {
    let ordered_host_ids = payload
        .map(|payload| payload.ordered_host_ids)
        .or(ordered_host_ids)
        .ok_or_else(|| AppError::config_invalid("Ordered host ids are required"))?;
    state.config_store.reorder_hosts(ordered_host_ids)
}

#[tauri::command]
pub fn host_delete(
    payload: Option<HostDeletePayload>,
    id: Option<String>,
    state: State<'_, AppState>,
) -> Result<OkResult, AppError> {
    let id = payload
        .map(|payload| payload.id)
        .or(id)
        .ok_or_else(|| AppError::config_invalid("Host id is required"))?;
    state.config_store.delete_host(&id)?;
    state
        .tray_state
        .set_settings(state.config_store.get_tray_settings()?);
    Ok(OkResult { ok: true })
}

#[derive(Debug, Clone, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HostOpenTerminalPayload {
    pub host_id: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HostOpenTerminalResult {
    pub ok: bool,
    pub app: TerminalApp,
}

#[tauri::command]
pub fn host_open_terminal(
    payload: Option<HostOpenTerminalPayload>,
    host_id: Option<String>,
    state: State<'_, AppState>,
) -> Result<HostOpenTerminalResult, AppError> {
    let host_id = payload
        .map(|payload| payload.host_id)
        .or(host_id)
        .ok_or_else(|| AppError::config_invalid("Host id is required"))?;
    let host = state.config_store.get_host(&host_id)?;
    let settings = state.config_store.get_terminal_settings()?;
    let launch = terminal_launch_command(settings.app, &host)?;
    run_terminal_launch(launch)?;

    Ok(HostOpenTerminalResult {
        ok: true,
        app: settings.app,
    })
}

fn build_ssh_terminal_command(host: &HostConfig) -> Result<String, AppError> {
    let username = auth_username(&host.auth).trim();
    let address = host.address.trim();

    if username.is_empty() {
        return Err(AppError::config_invalid("Host username is required"));
    }
    if address.is_empty() {
        return Err(AppError::config_invalid("Host address is required"));
    }

    let key_arg = match &host.auth {
        HostAuth::PrivateKey {
            key_path: Some(key_path),
            ..
        } if !key_path.trim().is_empty() => format!(" -i {}", shell_quote(key_path.trim())),
        _ => String::new(),
    };
    let destination = format!("{username}@{address}");

    Ok(format!(
        "ssh -p {}{} {}",
        host.port,
        key_arg,
        shell_quote(&destination)
    ))
}

fn build_ssh_args(host: &HostConfig) -> Result<Vec<String>, AppError> {
    let username = auth_username(&host.auth).trim();
    let address = host.address.trim();

    if username.is_empty() {
        return Err(AppError::config_invalid("Host username is required"));
    }
    if address.is_empty() {
        return Err(AppError::config_invalid("Host address is required"));
    }

    let destination = format!("{username}@{address}");
    let mut args = vec!["ssh".to_string(), "-p".to_string(), host.port.to_string()];

    if let HostAuth::PrivateKey {
        key_path: Some(key_path),
        ..
    } = &host.auth
    {
        let key_path = key_path.trim();
        if !key_path.is_empty() {
            args.push("-i".to_string());
            args.push(key_path.to_string());
        }
    }

    args.push(destination);
    Ok(args)
}

fn auth_username(auth: &HostAuth) -> &str {
    match auth {
        HostAuth::PrivateKey { username, .. } | HostAuth::SshAgent { username } => username,
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
enum TerminalLaunch {
    AppleScript(String),
    Program {
        program: PathBuf,
        args: Vec<String>,
    },
    OpenApp {
        app_name: &'static str,
        args: Vec<String>,
    },
}

fn terminal_launch_command(
    app: TerminalApp,
    host: &HostConfig,
) -> Result<TerminalLaunch, AppError> {
    terminal_launch_command_with_wezterm_candidates(app, host, &default_wezterm_candidates())
}

fn terminal_launch_command_with_wezterm_candidates(
    app: TerminalApp,
    host: &HostConfig,
    wezterm_candidates: &[PathBuf],
) -> Result<TerminalLaunch, AppError> {
    let args = build_ssh_args(host)?;

    match app {
        TerminalApp::TerminalApp | TerminalApp::Iterm2 => {
            let command = build_ssh_terminal_command(host)?;
            Ok(TerminalLaunch::AppleScript(terminal_launch_script(
                app, &command,
            )))
        }
        TerminalApp::WezTerm => Ok(TerminalLaunch::Program {
            program: find_wezterm_binary(wezterm_candidates)?,
            args: wezterm_args(args),
        }),
        TerminalApp::Ghostty => Ok(TerminalLaunch::OpenApp {
            app_name: "Ghostty",
            args: std::iter::once("-e".to_string()).chain(args).collect(),
        }),
        TerminalApp::Alacritty => Ok(TerminalLaunch::OpenApp {
            app_name: "Alacritty",
            args: std::iter::once("-e".to_string()).chain(args).collect(),
        }),
        TerminalApp::Kitty => Ok(TerminalLaunch::OpenApp {
            app_name: "kitty",
            args,
        }),
    }
}

fn run_terminal_launch(launch: TerminalLaunch) -> Result<(), AppError> {
    let output = match launch {
        TerminalLaunch::Program { program, args } => {
            Command::new(program).args(args).spawn().map_err(|err| {
                AppError::internal("Failed to open terminal").with_detail(err.to_string())
            })?;
            return Ok(());
        }
        TerminalLaunch::AppleScript(script) => Command::new("/usr/bin/osascript")
            .arg("-e")
            .arg(script)
            .output(),
        TerminalLaunch::OpenApp { app_name, args } => {
            let mut command = Command::new("/usr/bin/open");
            command.arg("-a").arg(app_name).arg("--args").args(args);
            command.output()
        }
    }
    .map_err(|err| AppError::internal("Failed to open terminal").with_detail(err.to_string()))?;

    if !output.status.success() {
        let detail = String::from_utf8_lossy(&output.stderr).trim().to_string();
        return Err(AppError::internal("Failed to open terminal").with_detail(detail));
    }

    Ok(())
}

fn wezterm_args(ssh_args: Vec<String>) -> Vec<String> {
    std::iter::once("start".to_string())
        .chain(std::iter::once("--new-tab".to_string()))
        .chain(std::iter::once("--".to_string()))
        .chain(ssh_args)
        .collect()
}

fn default_wezterm_candidates() -> Vec<PathBuf> {
    vec![
        PathBuf::from("/opt/homebrew/bin/wezterm"),
        PathBuf::from("/usr/local/bin/wezterm"),
        PathBuf::from("/Applications/WezTerm.app/Contents/MacOS/wezterm"),
    ]
}

fn find_wezterm_binary(candidates: &[PathBuf]) -> Result<PathBuf, AppError> {
    candidates
        .iter()
        .find(|path| is_executable_file(path))
        .cloned()
        .ok_or_else(|| AppError::internal("WezTerm executable not found"))
}

fn is_executable_file(path: &Path) -> bool {
    path.metadata()
        .map(|metadata| metadata.is_file() && is_executable(metadata.permissions()))
        .unwrap_or(false)
}

fn is_executable(permissions: Permissions) -> bool {
    permissions.mode() & 0o111 != 0
}

fn terminal_launch_script(app: TerminalApp, command: &str) -> String {
    let escaped_command = applescript_string(command);

    match app {
        TerminalApp::TerminalApp => format!(
            "tell application \"Terminal\"\nactivate\ndo script \"{}\"\nend tell",
            escaped_command
        ),
        TerminalApp::Iterm2 => format!(
            "tell application \"iTerm2\"\nactivate\ncreate window with default profile\n tell current session of current window to write text \"{}\"\nend tell",
            escaped_command
        ),
        TerminalApp::WezTerm | TerminalApp::Ghostty | TerminalApp::Alacritty | TerminalApp::Kitty => {
            String::new()
        }
    }
}

fn shell_quote(value: &str) -> String {
    if value.is_empty() {
        return "''".to_string();
    }

    format!("'{}'", value.replace('\'', "'\\''"))
}

fn applescript_string(value: &str) -> String {
    value.replace('\\', "\\\\").replace('"', "\\\"")
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SshConfigHost {
    pub alias: String,
    pub host_name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub user: Option<String>,
    pub port: u16,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub identity_file: Option<String>,
}

#[tauri::command]
pub fn host_ssh_config_list() -> Result<Vec<SshConfigHost>, AppError> {
    let Some(home) = std::env::var_os("HOME") else {
        return Ok(Vec::new());
    };
    let path = PathBuf::from(home).join(".ssh").join("config");
    let Ok(content) = fs::read_to_string(path) else {
        return Ok(Vec::new());
    };

    Ok(parse_ssh_config_hosts(&content))
}

fn parse_ssh_config_hosts(input: &str) -> Vec<SshConfigHost> {
    let mut hosts = Vec::new();
    let mut current: Vec<SshConfigHost> = Vec::new();

    for raw_line in input.lines() {
        let line = raw_line.split('#').next().unwrap_or("").trim();
        if line.is_empty() {
            continue;
        }

        let Some((key, value)) = split_ssh_config_line(line) else {
            continue;
        };
        let key = key.to_ascii_lowercase();

        if key == "host" {
            hosts.extend(current.drain(..).filter(is_importable_ssh_host));
            current = value
                .split_whitespace()
                .filter(|alias| !alias.contains('*') && !alias.contains('?') && *alias != "!")
                .map(|alias| SshConfigHost {
                    alias: alias.to_string(),
                    host_name: alias.to_string(),
                    user: None,
                    port: 22,
                    identity_file: None,
                })
                .collect();
            continue;
        }

        for host in &mut current {
            match key.as_str() {
                "hostname" => host.host_name = value.to_string(),
                "user" => host.user = Some(value.to_string()),
                "port" => {
                    if let Ok(port) = value.parse::<u16>() {
                        host.port = port;
                    }
                }
                "identityfile" => host.identity_file = Some(value.to_string()),
                _ => {}
            }
        }
    }

    hosts.extend(current.into_iter().filter(is_importable_ssh_host));
    hosts
}

fn split_ssh_config_line(line: &str) -> Option<(&str, &str)> {
    if let Some((key, value)) = line.split_once(char::is_whitespace) {
        let value = value.trim();
        if value.is_empty() {
            return None;
        }
        return Some((key.trim(), value));
    }

    line.split_once('=')
        .map(|(key, value)| (key.trim(), value.trim()))
        .filter(|(_, value)| !value.is_empty())
}

fn is_importable_ssh_host(host: &SshConfigHost) -> bool {
    !host.alias.is_empty()
        && !host.host_name.is_empty()
        && !host.alias.starts_with('!')
        && !host.alias.contains('*')
        && !host.alias.contains('?')
}

#[derive(Debug, Clone, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HostTestConnectionPayload {
    pub id: Option<String>,
    pub draft: Option<HostCreatePayload>,
}

#[derive(Debug, Clone, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HostAcceptKeyPayload {
    pub id: Option<String>,
    pub draft: Option<HostCreatePayload>,
    pub fingerprint: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HostAcceptKeyResult {
    pub ok: bool,
    pub fingerprint: String,
}

#[tauri::command]
pub async fn host_test_connection(
    payload: Option<HostTestConnectionPayload>,
    id: Option<String>,
    draft: Option<HostCreatePayload>,
    state: State<'_, AppState>,
) -> Result<crate::ssh::ConnectionInfo, AppError> {
    let payload = payload.unwrap_or(HostTestConnectionPayload { id, draft });
    let host = host_from_connection_payload(payload.id, payload.draft, &state)?;

    state.ssh_pool.client().test_connection(&host).await
}

#[tauri::command]
pub async fn host_accept_key(
    payload: Option<HostAcceptKeyPayload>,
    id: Option<String>,
    draft: Option<HostCreatePayload>,
    fingerprint: Option<String>,
    state: State<'_, AppState>,
) -> Result<HostAcceptKeyResult, AppError> {
    let payload = match payload {
        Some(payload) => payload,
        None => HostAcceptKeyPayload {
            id,
            draft,
            fingerprint: fingerprint
                .ok_or_else(|| AppError::config_invalid("Host key fingerprint is required"))?,
        },
    };
    let fingerprint = payload.fingerprint.trim();
    if !fingerprint.starts_with("SHA256:") {
        return Err(AppError::config_invalid(
            "Host key fingerprint must use the SHA256 format",
        ));
    }

    let host = host_from_connection_payload(payload.id, payload.draft, &state)?;
    let fingerprint = state
        .ssh_pool
        .client()
        .accept_host_key(&host, fingerprint)
        .await?;

    Ok(HostAcceptKeyResult {
        ok: true,
        fingerprint,
    })
}

fn host_from_connection_payload(
    id: Option<String>,
    draft: Option<HostCreatePayload>,
    state: &AppState,
) -> Result<HostConfig, AppError> {
    if let Some(id) = id {
        return state.config_store.get_host(&id);
    }

    if let Some(draft) = draft {
        let now = unix_ms();
        return Ok(HostConfig {
            id: "draft".to_string(),
            name: draft.name,
            address: draft.address,
            port: draft.port,
            auth: draft.auth,
            refresh_interval_ms: draft.refresh_interval_ms,
            tags: draft.tags,
            created_at: now,
            updated_at: now,
        });
    }

    Err(AppError::config_invalid(
        "Host id or draft host is required",
    ))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::{
        path::PathBuf,
        time::{Duration, Instant},
    };
    use uuid::Uuid;

    fn host(auth: HostAuth) -> HostConfig {
        HostConfig {
            id: "host-1".to_string(),
            name: "prod".to_string(),
            address: "203.0.113.10".to_string(),
            port: 22,
            auth,
            refresh_interval_ms: 2_000,
            tags: Vec::new(),
            created_at: 1,
            updated_at: 1,
        }
    }

    fn temp_test_path(name: &str) -> PathBuf {
        std::env::temp_dir().join(format!("vpscope-{name}-{}", Uuid::new_v4()))
    }

    fn executable_fixture(name: &str) -> PathBuf {
        executable_fixture_with_script(name, "#!/bin/sh\nexit 0\n")
    }

    fn executable_fixture_with_script(name: &str, script: &str) -> PathBuf {
        let path = temp_test_path(name);
        fs::write(&path, script).expect("write executable fixture");
        let mut permissions = fs::metadata(&path).expect("metadata").permissions();
        permissions.set_mode(0o755);
        fs::set_permissions(&path, permissions).expect("set executable permissions");
        path
    }

    #[test]
    fn builds_basic_ssh_command() {
        let command = build_ssh_terminal_command(&host(HostAuth::SshAgent {
            username: "ubuntu".to_string(),
        }))
        .expect("command");

        assert_eq!(command, "ssh -p 22 'ubuntu@203.0.113.10'");
    }

    #[test]
    fn builds_non_default_port_command() {
        let mut host = host(HostAuth::SshAgent {
            username: "ops".to_string(),
        });
        host.port = 2222;

        let command = build_ssh_terminal_command(&host).expect("command");

        assert_eq!(command, "ssh -p 2222 'ops@203.0.113.10'");
    }

    #[test]
    fn builds_private_key_command_with_quoted_path() {
        let command = build_ssh_terminal_command(&host(HostAuth::PrivateKey {
            username: "ubuntu".to_string(),
            key_path: Some("/Users/me/.ssh/prod key's.pem".to_string()),
        }))
        .expect("command");

        assert_eq!(
            command,
            "ssh -p 22 -i '/Users/me/.ssh/prod key'\\''s.pem' 'ubuntu@203.0.113.10'"
        );
    }

    #[test]
    fn rejects_empty_username_and_address() {
        let username_error = build_ssh_terminal_command(&host(HostAuth::SshAgent {
            username: " ".to_string(),
        }))
        .expect_err("empty username must fail");
        assert_eq!(username_error.code, "CONFIG_INVALID");

        let mut empty_address = host(HostAuth::SshAgent {
            username: "ubuntu".to_string(),
        });
        empty_address.address = " ".to_string();
        let address_error =
            build_ssh_terminal_command(&empty_address).expect_err("empty address must fail");
        assert_eq!(address_error.code, "CONFIG_INVALID");
    }

    #[test]
    fn escapes_applescript_string() {
        assert_eq!(
            applescript_string("ssh 'u@h' && echo \"done\" \\ ok"),
            "ssh 'u@h' && echo \\\"done\\\" \\\\ ok"
        );
    }

    #[test]
    fn builds_terminal_and_iterm_scripts() {
        let command = "ssh -p 22 'ubuntu@203.0.113.10'";

        let terminal = terminal_launch_script(TerminalApp::TerminalApp, command);
        assert!(terminal.contains("tell application \"Terminal\""));
        assert!(terminal.contains("do script \"ssh -p 22 'ubuntu@203.0.113.10'\""));

        let iterm = terminal_launch_script(TerminalApp::Iterm2, command);
        assert!(iterm.contains("tell application \"iTerm2\""));
        assert!(iterm.contains("write text \"ssh -p 22 'ubuntu@203.0.113.10'\""));
    }

    #[test]
    fn builds_wezterm_launch_with_argument_vector() {
        let wezterm_path = executable_fixture("wezterm");
        let launch = terminal_launch_command_with_wezterm_candidates(
            TerminalApp::WezTerm,
            &host(HostAuth::SshAgent {
                username: "ubuntu".to_string(),
            }),
            &[wezterm_path.clone()],
        )
        .expect("launch");

        assert_eq!(
            launch,
            TerminalLaunch::Program {
                program: wezterm_path,
                args: vec![
                    "start".to_string(),
                    "--new-tab".to_string(),
                    "--".to_string(),
                    "ssh".to_string(),
                    "-p".to_string(),
                    "22".to_string(),
                    "ubuntu@203.0.113.10".to_string(),
                ],
            }
        );
    }

    #[test]
    fn builds_wezterm_launch_with_private_key_as_separate_argument() {
        let wezterm_path = executable_fixture("wezterm-key");
        let launch = terminal_launch_command_with_wezterm_candidates(
            TerminalApp::WezTerm,
            &host(HostAuth::PrivateKey {
                username: "ubuntu".to_string(),
                key_path: Some("/Users/me/.ssh/prod key.pem".to_string()),
            }),
            &[wezterm_path.clone()],
        )
        .expect("launch");

        assert_eq!(
            launch,
            TerminalLaunch::Program {
                program: wezterm_path,
                args: vec![
                    "start".to_string(),
                    "--new-tab".to_string(),
                    "--".to_string(),
                    "ssh".to_string(),
                    "-p".to_string(),
                    "22".to_string(),
                    "-i".to_string(),
                    "/Users/me/.ssh/prod key.pem".to_string(),
                    "ubuntu@203.0.113.10".to_string(),
                ],
            }
        );
    }

    #[test]
    fn rejects_missing_wezterm_executable() {
        let missing = temp_test_path("missing-wezterm");

        let error = terminal_launch_command_with_wezterm_candidates(
            TerminalApp::WezTerm,
            &host(HostAuth::SshAgent {
                username: "ubuntu".to_string(),
            }),
            &[missing],
        )
        .expect_err("missing executable must fail");

        assert_eq!(error.code, "INTERNAL");
        assert_eq!(error.message, "WezTerm executable not found");
    }

    #[test]
    fn program_launch_spawns_without_waiting_for_child_exit() {
        let program = executable_fixture_with_script("slow-terminal", "#!/bin/sh\nsleep 2\n");
        let started = Instant::now();

        run_terminal_launch(TerminalLaunch::Program {
            program,
            args: Vec::new(),
        })
        .expect("program launch");

        assert!(started.elapsed() < Duration::from_millis(500));
    }

    #[test]
    fn builds_modern_terminal_launches_without_shell_strings() {
        let host = host(HostAuth::PrivateKey {
            username: "ubuntu".to_string(),
            key_path: Some("/Users/me/.ssh/prod key.pem".to_string()),
        });

        let ghostty = terminal_launch_command(TerminalApp::Ghostty, &host).expect("ghostty");
        let alacritty = terminal_launch_command(TerminalApp::Alacritty, &host).expect("alacritty");
        let kitty = terminal_launch_command(TerminalApp::Kitty, &host).expect("kitty");

        assert_eq!(
            ghostty,
            TerminalLaunch::OpenApp {
                app_name: "Ghostty",
                args: vec![
                    "-e".to_string(),
                    "ssh".to_string(),
                    "-p".to_string(),
                    "22".to_string(),
                    "-i".to_string(),
                    "/Users/me/.ssh/prod key.pem".to_string(),
                    "ubuntu@203.0.113.10".to_string(),
                ],
            }
        );
        assert_eq!(
            alacritty,
            TerminalLaunch::OpenApp {
                app_name: "Alacritty",
                args: vec![
                    "-e".to_string(),
                    "ssh".to_string(),
                    "-p".to_string(),
                    "22".to_string(),
                    "-i".to_string(),
                    "/Users/me/.ssh/prod key.pem".to_string(),
                    "ubuntu@203.0.113.10".to_string(),
                ],
            }
        );
        assert_eq!(
            kitty,
            TerminalLaunch::OpenApp {
                app_name: "kitty",
                args: vec![
                    "ssh".to_string(),
                    "-p".to_string(),
                    "22".to_string(),
                    "-i".to_string(),
                    "/Users/me/.ssh/prod key.pem".to_string(),
                    "ubuntu@203.0.113.10".to_string(),
                ],
            }
        );
    }
}
