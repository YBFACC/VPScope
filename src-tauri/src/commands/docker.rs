use crate::{
    app_state::AppState,
    errors::{AppError, AppErrorCode},
    ssh::{DockerComposeAction, DockerContainerAction, RemoteCommand},
};
use serde::Serialize;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::State;

const DOCKER_TAIL_OPTIONS: [u16; 3] = [100, 300, 1000];
const MAX_COMPOSE_LABEL_LENGTH: usize = 512;

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DockerContainer {
    pub id: String,
    pub name: String,
    pub image: String,
    pub state: String,
    pub status: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub compose: Option<DockerComposeMetadata>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DockerComposeMetadata {
    pub project: String,
    pub service: String,
    pub working_dir: String,
    pub config_files: Vec<String>,
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

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DockerComposeActionResult {
    pub host_id: String,
    pub container_id: String,
    pub action: DockerComposeAction,
    pub project: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub service: Option<String>,
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

#[tauri::command(rename_all = "camelCase")]
pub async fn docker_compose_action(
    host_id: String,
    container_id: String,
    action: DockerComposeAction,
    state: State<'_, AppState>,
) -> Result<DockerComposeActionResult, AppError> {
    let host = state.config_store.get_host(&host_id)?;
    let container_id = normalize_container_identifier(&container_id)?;
    let output = state
        .ssh_pool
        .client()
        .exec(&host, RemoteCommand::DockerContainerList)
        .await
        .map_err(map_docker_error)?;
    let containers = parse_docker_container_list(&output)?;
    let container = containers
        .into_iter()
        .find(|container| container.id == container_id || container.name == container_id)
        .ok_or_else(|| {
            AppError::config_invalid("Docker container does not have Compose metadata")
        })?;
    let compose = container.compose.ok_or_else(|| {
        AppError::config_invalid("Docker container does not have Compose metadata")
    })?;
    let service = match action {
        DockerComposeAction::RestartService | DockerComposeAction::RebuildService => {
            Some(compose.service.clone())
        }
        DockerComposeAction::RebuildProject => None,
    };

    state
        .ssh_pool
        .client()
        .exec(
            &host,
            RemoteCommand::DockerComposeAction {
                project: compose.project.clone(),
                working_dir: compose.working_dir.clone(),
                config_files: compose.config_files.clone(),
                service: service.clone(),
                action,
            },
        )
        .await
        .map_err(map_docker_error)?;

    Ok(DockerComposeActionResult {
        host_id,
        container_id,
        action,
        project: compose.project,
        service,
        completed_at: unix_ms(),
    })
}

fn parse_docker_container_list(output: &str) -> Result<Vec<DockerContainer>, AppError> {
    let mut containers = Vec::new();

    for (index, line) in output.lines().enumerate() {
        let row = line.trim_end_matches('\r');
        if row.trim().is_empty() {
            continue;
        }

        let columns: Vec<&str> = row.split('\t').collect();
        if columns.len() != 5 && columns.len() != 9 {
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
            compose: if columns.len() == 9 {
                parse_compose_metadata(columns[5], columns[6], columns[7], columns[8])?
            } else {
                None
            },
        });
    }

    containers.sort_by_key(|container| !container.state.eq_ignore_ascii_case("running"));
    Ok(containers)
}

fn parse_compose_metadata(
    project: &str,
    service: &str,
    working_dir: &str,
    config_files: &str,
) -> Result<Option<DockerComposeMetadata>, AppError> {
    if [project, service, working_dir, config_files]
        .iter()
        .any(|value| value.trim().is_empty())
    {
        return Ok(None);
    }

    Ok(Some(DockerComposeMetadata {
        project: normalize_safe_compose_identifier(project, "Docker Compose project")?,
        service: normalize_safe_compose_identifier(service, "Docker Compose service")?,
        working_dir: normalize_absolute_label_path(
            working_dir,
            "Docker Compose working directory",
        )?,
        config_files: normalize_compose_config_files(config_files)?,
    }))
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

fn normalize_safe_compose_identifier(value: &str, label: &str) -> Result<String, AppError> {
    let trimmed = value.trim();
    if trimmed.is_empty() || trimmed.len() > 128 || trimmed.starts_with('-') {
        return Err(AppError::config_invalid(format!("{label} is invalid")));
    }

    if !trimmed
        .bytes()
        .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'_' | b'.' | b'-'))
    {
        return Err(AppError::config_invalid(format!(
            "{label} contains unsupported characters"
        )));
    }

    Ok(trimmed.to_string())
}

fn normalize_absolute_label_path(value: &str, label: &str) -> Result<String, AppError> {
    let trimmed = value.trim();
    if trimmed.is_empty()
        || trimmed.len() > MAX_COMPOSE_LABEL_LENGTH
        || !trimmed.starts_with('/')
        || trimmed.bytes().any(|byte| byte.is_ascii_control())
    {
        return Err(AppError::config_invalid(format!("{label} is invalid")));
    }

    Ok(trimmed.to_string())
}

fn normalize_compose_config_files(value: &str) -> Result<Vec<String>, AppError> {
    let files: Result<Vec<_>, _> = value
        .split(',')
        .map(|file| normalize_absolute_label_path(file, "Docker Compose config file"))
        .collect();
    let files = files?;

    if files.is_empty() {
        return Err(AppError::config_invalid(
            "Docker Compose config files are required",
        ));
    }

    Ok(files)
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
    fn parses_optional_compose_metadata() {
        let output = "\
a83f7fca5fb1\tflux-logic-api\tflux-logic-api:latest\trunning\tUp 5 hours\tflux-logic\tapi\t/srv/flux logic\t/srv/flux logic/compose.yml,/srv/flux logic/compose.prod.yml
fb2e571ebd80\tstandalone\tnginx:latest\trunning\tUp 2 hours\t\t\t\t
c113bb9a0f01\tpartial\tnginx:latest\trunning\tUp 1 hour\tflux-logic\tapi\t\t
";

        let containers = parse_docker_container_list(output).expect("parse containers");
        let compose = containers[0].compose.as_ref().expect("compose metadata");

        assert_eq!(compose.project, "flux-logic");
        assert_eq!(compose.service, "api");
        assert_eq!(compose.working_dir, "/srv/flux logic");
        assert_eq!(
            compose.config_files,
            vec![
                "/srv/flux logic/compose.yml".to_string(),
                "/srv/flux logic/compose.prod.yml".to_string()
            ]
        );
        assert!(containers[1].compose.is_none());
        assert!(containers[2].compose.is_none());
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
    fn rejects_unsafe_compose_metadata() {
        let error =
            parse_compose_metadata("flux", "bad/service", "/srv/flux", "/srv/flux/compose.yml")
                .expect_err("invalid service");
        assert_eq!(error.code, AppErrorCode::ConfigInvalid.as_str());

        let error = parse_compose_metadata("flux", "api", "relative/path", "/srv/flux/compose.yml")
            .expect_err("invalid working dir");
        assert_eq!(error.code, AppErrorCode::ConfigInvalid.as_str());
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

    #[test]
    fn renders_fixed_compose_commands() {
        let service_command = RemoteCommand::DockerComposeAction {
            project: "flux".to_string(),
            working_dir: "/srv/flux".to_string(),
            config_files: vec!["/srv/flux/compose.yml".to_string()],
            service: Some("api".to_string()),
            action: DockerComposeAction::RebuildService,
        };
        assert_eq!(
            service_command.as_fixed_command(),
            "docker compose --project-directory /srv/flux -f /srv/flux/compose.yml -p flux up -d --build api"
        );

        let project_command = RemoteCommand::DockerComposeAction {
            project: "flux".to_string(),
            working_dir: "/srv/flux".to_string(),
            config_files: vec!["/srv/flux/compose.yml".to_string()],
            service: None,
            action: DockerComposeAction::RebuildProject,
        };
        assert_eq!(
            project_command.as_fixed_command(),
            "docker compose --project-directory /srv/flux -f /srv/flux/compose.yml -p flux up -d --build"
        );
    }
}
