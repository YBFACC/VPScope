use crate::{
    app_state::AppState,
    errors::{AppError, AppErrorCode},
    ssh::{DockerContainerAction, RemoteCommand},
};
use serde::Serialize;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::State;

const DOCKER_TAIL_OPTIONS: [u16; 3] = [100, 300, 1000];

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DockerContainer {
    pub id: String,
    pub name: String,
    pub image: String,
    pub state: String,
    pub status: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DockerContainerLogsResult {
    pub host_id: String,
    pub container_id: String,
    pub tail_lines: u16,
    pub logs: String,
    pub fetched_at: u64,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DockerContainerActionResult {
    pub host_id: String,
    pub container_id: String,
    pub action: DockerContainerAction,
    pub completed_at: u64,
}

#[tauri::command(rename_all = "camelCase")]
pub async fn docker_container_list(
    host_id: String,
    state: State<'_, AppState>,
) -> Result<Vec<DockerContainer>, AppError> {
    let host = state.config_store.get_host(&host_id)?;
    let output = state
        .ssh_pool
        .client()
        .exec(&host, RemoteCommand::DockerContainerList)
        .await
        .map_err(map_docker_error)?;

    parse_docker_container_list(&output)
}

#[tauri::command(rename_all = "camelCase")]
pub async fn docker_container_logs(
    host_id: String,
    container_id: String,
    tail_lines: u16,
    state: State<'_, AppState>,
) -> Result<DockerContainerLogsResult, AppError> {
    let host = state.config_store.get_host(&host_id)?;
    let tail_lines = normalize_tail_lines(tail_lines)?;
    let container_id = normalize_container_identifier(&container_id)?;
    let logs = state
        .ssh_pool
        .client()
        .exec(
            &host,
            RemoteCommand::DockerContainerLogs {
                container_id: container_id.clone(),
                tail_lines,
            },
        )
        .await
        .map_err(map_docker_error)?;

    Ok(DockerContainerLogsResult {
        host_id,
        container_id,
        tail_lines,
        logs,
        fetched_at: unix_ms(),
    })
}

#[tauri::command(rename_all = "camelCase")]
pub async fn docker_container_action(
    host_id: String,
    container_id: String,
    action: DockerContainerAction,
    state: State<'_, AppState>,
) -> Result<DockerContainerActionResult, AppError> {
    let host = state.config_store.get_host(&host_id)?;
    let container_id = normalize_container_identifier(&container_id)?;
    state
        .ssh_pool
        .client()
        .exec(
            &host,
            RemoteCommand::DockerContainerAction {
                container_id: container_id.clone(),
                action,
            },
        )
        .await
        .map_err(map_docker_error)?;

    Ok(DockerContainerActionResult {
        host_id,
        container_id,
        action,
        completed_at: unix_ms(),
    })
}

fn parse_docker_container_list(output: &str) -> Result<Vec<DockerContainer>, AppError> {
    let mut containers = Vec::new();

    for (index, line) in output.lines().enumerate() {
        let trimmed = line.trim_end();
        if trimmed.is_empty() {
            continue;
        }

        let columns: Vec<&str> = trimmed.splitn(5, '\t').collect();
        if columns.len() != 5 {
            return Err(AppError::new(
                AppErrorCode::ParserFailed,
                "Docker container list output could not be parsed",
            )
            .with_detail(format!("line={}", index + 1)));
        }

        containers.push(DockerContainer {
            id: columns[0].trim().to_string(),
            name: columns[1].trim().to_string(),
            image: columns[2].trim().to_string(),
            state: columns[3].trim().to_string(),
            status: columns[4].trim().to_string(),
        });
    }

    containers.sort_by_key(|container| !container.state.eq_ignore_ascii_case("running"));
    Ok(containers)
}

fn normalize_tail_lines(tail_lines: u16) -> Result<u16, AppError> {
    if DOCKER_TAIL_OPTIONS.contains(&tail_lines) {
        return Ok(tail_lines);
    }

    Err(AppError::config_invalid(
        "Docker log tail size must be one of 100, 300, or 1000",
    ))
}

fn normalize_container_identifier(container_id: &str) -> Result<String, AppError> {
    let trimmed = container_id.trim();
    if trimmed.is_empty() {
        return Err(AppError::config_invalid("Docker container id is required"));
    }

    if trimmed.len() > 128 || trimmed.starts_with('-') {
        return Err(AppError::config_invalid("Docker container id is invalid"));
    }

    if !trimmed
        .bytes()
        .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'_' | b'.' | b'-'))
    {
        return Err(AppError::config_invalid(
            "Docker container id contains unsupported characters",
        ));
    }

    Ok(trimmed.to_string())
}

fn map_docker_error(error: AppError) -> AppError {
    if error.code != AppErrorCode::RemoteCommandFailed.as_str() {
        return error;
    }

    let detail = error.detail.as_deref().unwrap_or_default().to_lowercase();
    if detail.contains("docker: command not found")
        || detail.contains("docker: not found")
        || detail.contains("no such file or directory")
    {
        return AppError::new(
            AppErrorCode::RemoteUnsupported,
            "Docker is not available on this host",
        )
        .with_detail(error.detail.unwrap_or_default());
    }

    error
}

fn unix_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis() as u64)
        .unwrap_or(0)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_containers_and_sorts_running_first() {
        let output = "\
7ba2c7b6dbad\tflux-logic-db\tpostgres:16\texited\tExited (0) 2 hours ago
a83f7fca5fb1\tflux-logic-api\tflux-logic-api:latest\trunning\tUp 5 hours
fb2e571ebd80\tflux-logic-web\tflux-logic-web:latest\trunning\tUp 5 hours
";

        let containers = parse_docker_container_list(output).expect("parse containers");

        assert_eq!(containers.len(), 3);
        assert_eq!(containers[0].name, "flux-logic-api");
        assert_eq!(containers[1].name, "flux-logic-web");
        assert_eq!(containers[2].name, "flux-logic-db");
    }

    #[test]
    fn rejects_malformed_container_rows() {
        let error = parse_docker_container_list("missing\tcolumns").expect_err("invalid row");

        assert_eq!(error.code, AppErrorCode::ParserFailed.as_str());
    }

    #[test]
    fn validates_tail_line_options() {
        assert_eq!(normalize_tail_lines(300).expect("valid tail"), 300);

        let error = normalize_tail_lines(500).expect_err("invalid tail");
        assert_eq!(error.code, AppErrorCode::ConfigInvalid.as_str());
    }

    #[test]
    fn validates_container_identifiers() {
        assert_eq!(
            normalize_container_identifier("flux-logic-api_1").expect("valid id"),
            "flux-logic-api_1"
        );

        for value in ["", "--help", "bad id", "bad/id", "bad;id"] {
            let error = normalize_container_identifier(value).expect_err("invalid id");
            assert_eq!(error.code, AppErrorCode::ConfigInvalid.as_str());
        }
    }

    #[test]
    fn serializes_force_remove_action() {
        let value =
            serde_json::to_value(DockerContainerAction::ForceRemove).expect("serialize action");

        assert_eq!(value, serde_json::json!("forceRemove"));
    }

    #[test]
    fn renders_fixed_force_remove_command() {
        let command = RemoteCommand::DockerContainerAction {
            container_id: "flux-logic-api".to_string(),
            action: DockerContainerAction::ForceRemove,
        };

        assert_eq!(command.as_fixed_command(), "docker rm -f flux-logic-api");
    }
}
