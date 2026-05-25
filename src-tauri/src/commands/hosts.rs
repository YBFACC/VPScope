use crate::{
    app_state::AppState,
    config::storage::unix_ms,
    config::{
        HostAuth, HostConfig, HostCreatePayload, HostDeletePayload, HostPatch, HostUpdatePayload,
        OkResult,
    },
    errors::AppError,
};
use serde::Serialize;
use std::{fs, path::PathBuf};
use tauri::State;

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
    state.config_store.create_host(HostCreatePayload {
        name,
        address,
        port,
        auth,
        refresh_interval_ms,
        tags: tags.unwrap_or_default(),
    })
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
    state.config_store.update_host(&payload.id, payload.patch)
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
    state.credential_store.delete_for_host(&id)?;
    state
        .tray_state
        .set_settings(state.config_store.get_tray_settings()?);
    Ok(OkResult { ok: true })
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

#[tauri::command]
pub async fn host_test_connection(
    payload: Option<HostTestConnectionPayload>,
    id: Option<String>,
    draft: Option<HostCreatePayload>,
    state: State<'_, AppState>,
) -> Result<crate::ssh::ConnectionInfo, AppError> {
    let payload = payload.unwrap_or(HostTestConnectionPayload { id, draft });
    let host = if let Some(id) = payload.id {
        state.config_store.get_host(&id)?
    } else if let Some(draft) = payload.draft {
        let now = unix_ms();
        HostConfig {
            id: "draft".to_string(),
            name: draft.name,
            address: draft.address,
            port: draft.port,
            auth: draft.auth,
            refresh_interval_ms: draft.refresh_interval_ms,
            tags: draft.tags,
            created_at: now,
            updated_at: now,
        }
    } else {
        return Err(AppError::config_invalid(
            "Host id or draft host is required",
        ));
    };

    state.ssh_pool.client().test_connection(&host).await
}
