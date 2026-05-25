use crate::errors::{AppError, AppErrorCode};
use std::sync::RwLock;

#[derive(Debug, Default)]
pub struct CredentialStore {
    // This is intentionally only a placeholder index for the MVP skeleton.
    // A production implementation should replace it with macOS Keychain calls.
    deleted_hosts: RwLock<Vec<String>>,
}

impl CredentialStore {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn save_password(
        &self,
        host_id: &str,
        _username: &str,
        _password: &str,
    ) -> Result<String, AppError> {
        Ok(format!("vpscope://credential/{host_id}/password"))
    }

    pub fn get_password(&self, _credential_ref: &str) -> Result<String, AppError> {
        Err(AppError::new(
            AppErrorCode::ConfigInvalid,
            "CredentialStore is not backed by Keychain yet",
        ))
    }

    pub fn save_passphrase(&self, host_id: &str, _passphrase: &str) -> Result<String, AppError> {
        Ok(format!("vpscope://credential/{host_id}/passphrase"))
    }

    pub fn get_passphrase(&self, _credential_ref: &str) -> Result<String, AppError> {
        Err(AppError::new(
            AppErrorCode::ConfigInvalid,
            "CredentialStore is not backed by Keychain yet",
        ))
    }

    pub fn delete_for_host(&self, host_id: &str) -> Result<(), AppError> {
        self.deleted_hosts
            .write()
            .map_err(|_| AppError::internal("Credential store lock is poisoned"))?
            .push(host_id.to_string());
        Ok(())
    }
}

pub mod keychain {
    pub use super::CredentialStore;
}
