use serde::Serialize;
use std::{error::Error, fmt, io};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum AppErrorCode {
    ConfigInvalid,
    HostNotFound,
    SshAuthFailed,
    SshConnectFailed,
    SshHostKeyChanged,
    SshHostKeyUnknown,
    RemoteCommandFailed,
    RemoteUnsupported,
    ParserFailed,
    Internal,
}

impl AppErrorCode {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::ConfigInvalid => "CONFIG_INVALID",
            Self::HostNotFound => "HOST_NOT_FOUND",
            Self::SshAuthFailed => "SSH_AUTH_FAILED",
            Self::SshConnectFailed => "SSH_CONNECT_FAILED",
            Self::SshHostKeyChanged => "SSH_HOST_KEY_CHANGED",
            Self::SshHostKeyUnknown => "SSH_HOST_KEY_UNKNOWN",
            Self::RemoteCommandFailed => "REMOTE_COMMAND_FAILED",
            Self::RemoteUnsupported => "REMOTE_UNSUPPORTED",
            Self::ParserFailed => "PARSER_FAILED",
            Self::Internal => "INTERNAL",
        }
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppError {
    pub code: String,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub detail: Option<String>,
    pub retryable: bool,
}

impl AppError {
    pub fn new(code: AppErrorCode, message: impl Into<String>) -> Self {
        Self {
            code: code.as_str().to_string(),
            message: message.into(),
            detail: None,
            retryable: matches!(
                code,
                AppErrorCode::SshConnectFailed
                    | AppErrorCode::RemoteCommandFailed
                    | AppErrorCode::RemoteUnsupported
                    | AppErrorCode::ParserFailed
            ),
        }
    }

    pub fn with_detail(mut self, detail: impl Into<String>) -> Self {
        self.detail = Some(detail.into());
        self
    }

    pub fn config_invalid(message: impl Into<String>) -> Self {
        Self::new(AppErrorCode::ConfigInvalid, message)
    }

    pub fn host_not_found(host_id: &str) -> Self {
        Self::new(AppErrorCode::HostNotFound, "Host was not found")
            .with_detail(format!("hostId={host_id}"))
    }

    pub fn internal(message: impl Into<String>) -> Self {
        Self::new(AppErrorCode::Internal, message)
    }
}

impl fmt::Display for AppError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}: {}", self.code, self.message)
    }
}

impl Error for AppError {}

impl From<io::Error> for AppError {
    fn from(value: io::Error) -> Self {
        AppError::internal("Filesystem operation failed").with_detail(value.to_string())
    }
}
