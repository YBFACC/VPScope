use crate::errors::{AppError, AppErrorCode};
use std::sync::Arc;

const KEYCHAIN_SERVICE: &str = "com.vpscope.credentials";
const CREDENTIAL_SCHEME: &str = "vpscope://credential/";
const PASSWORD_KIND: &str = "password";
const PASSPHRASE_KIND: &str = "passphrase";

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum CredentialKind {
    Password,
    Passphrase,
}

impl CredentialKind {
    fn as_str(self) -> &'static str {
        match self {
            Self::Password => PASSWORD_KIND,
            Self::Passphrase => PASSPHRASE_KIND,
        }
    }
}

trait CredentialBackend: Send + Sync + std::fmt::Debug {
    fn set_secret(&self, account: &str, secret: &str) -> Result<(), AppError>;
    fn get_secret(&self, account: &str) -> Result<String, AppError>;
    fn delete_secret(&self, account: &str) -> Result<(), AppError>;
}

#[derive(Debug)]
pub struct CredentialStore {
    backend: Arc<dyn CredentialBackend>,
}

impl CredentialStore {
    pub fn new() -> Self {
        Self {
            backend: Arc::new(KeychainCredentialBackend),
        }
    }

    #[cfg(test)]
    pub(crate) fn new_in_memory() -> Self {
        Self {
            backend: Arc::new(InMemoryCredentialBackend::default()),
        }
    }

    pub fn save_password(
        &self,
        host_id: &str,
        _username: &str,
        password: &str,
    ) -> Result<String, AppError> {
        self.save_secret(host_id, CredentialKind::Password, password)
    }

    pub fn get_password(&self, credential_ref: &str) -> Result<String, AppError> {
        self.get_secret(credential_ref, CredentialKind::Password)
    }

    pub fn save_passphrase(&self, host_id: &str, passphrase: &str) -> Result<String, AppError> {
        self.save_secret(host_id, CredentialKind::Passphrase, passphrase)
    }

    pub fn get_passphrase(&self, credential_ref: &str) -> Result<String, AppError> {
        self.get_secret(credential_ref, CredentialKind::Passphrase)
    }

    pub fn delete_for_host(&self, host_id: &str) -> Result<(), AppError> {
        self.delete_kind_for_host(host_id, CredentialKind::Password)?;
        self.delete_kind_for_host(host_id, CredentialKind::Passphrase)
    }

    pub fn delete_password_for_host(&self, host_id: &str) -> Result<(), AppError> {
        self.delete_kind_for_host(host_id, CredentialKind::Password)
    }

    pub fn delete_passphrase_for_host(&self, host_id: &str) -> Result<(), AppError> {
        self.delete_kind_for_host(host_id, CredentialKind::Passphrase)
    }

    fn save_secret(
        &self,
        host_id: &str,
        kind: CredentialKind,
        secret: &str,
    ) -> Result<String, AppError> {
        validate_host_id(host_id)?;
        self.backend
            .set_secret(&account_for(host_id, kind), secret)
            .map(|_| credential_ref_for(host_id, kind))
    }

    fn get_secret(&self, credential_ref: &str, kind: CredentialKind) -> Result<String, AppError> {
        let parsed = parse_credential_ref(credential_ref)?;
        if parsed.kind != kind {
            return Err(AppError::config_invalid(
                "Credential reference does not match the requested credential kind",
            ));
        }

        self.backend.get_secret(&account_for(&parsed.host_id, kind))
    }

    fn delete_kind_for_host(&self, host_id: &str, kind: CredentialKind) -> Result<(), AppError> {
        validate_host_id(host_id)?;
        self.backend.delete_secret(&account_for(host_id, kind))
    }
}

impl Default for KeychainCredentialBackend {
    fn default() -> Self {
        Self
    }
}

#[derive(Debug)]
struct KeychainCredentialBackend;

impl CredentialBackend for KeychainCredentialBackend {
    fn set_secret(&self, account: &str, secret: &str) -> Result<(), AppError> {
        let entry = keyring_entry(account)?;
        entry
            .set_password(secret)
            .map_err(|err| keychain_error("Failed to save credential in Keychain", err))
    }

    fn get_secret(&self, account: &str) -> Result<String, AppError> {
        let entry = keyring_entry(account)?;
        entry
            .get_password()
            .map_err(|err| keychain_error("Failed to read credential from Keychain", err))
    }

    fn delete_secret(&self, account: &str) -> Result<(), AppError> {
        let entry = keyring_entry(account)?;
        match entry.delete_credential() {
            Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
            Err(err) => Err(keychain_error(
                "Failed to delete credential from Keychain",
                err,
            )),
        }
    }
}

fn keyring_entry(account: &str) -> Result<keyring::Entry, AppError> {
    keyring::Entry::new(KEYCHAIN_SERVICE, account)
        .map_err(|err| keychain_error("Failed to open Keychain credential entry", err))
}

fn keychain_error(message: &'static str, err: keyring::Error) -> AppError {
    match err {
        keyring::Error::NoEntry => AppError::new(AppErrorCode::ConfigInvalid, message),
        other => AppError::internal(message).with_detail(other.to_string()),
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct ParsedCredentialRef {
    host_id: String,
    kind: CredentialKind,
}

fn parse_credential_ref(credential_ref: &str) -> Result<ParsedCredentialRef, AppError> {
    let Some(rest) = credential_ref.strip_prefix(CREDENTIAL_SCHEME) else {
        return Err(AppError::config_invalid(
            "Credential reference must use the vpscope credential scheme",
        ));
    };
    let mut parts = rest.split('/');
    let host_id = parts.next().unwrap_or_default();
    let kind = match parts.next() {
        Some(PASSWORD_KIND) => CredentialKind::Password,
        Some(PASSPHRASE_KIND) => CredentialKind::Passphrase,
        _ => {
            return Err(AppError::config_invalid(
                "Credential reference kind is invalid",
            ))
        }
    };

    if parts.next().is_some() {
        return Err(AppError::config_invalid(
            "Credential reference must not contain extra path segments",
        ));
    }
    validate_host_id(host_id)?;

    Ok(ParsedCredentialRef {
        host_id: host_id.to_string(),
        kind,
    })
}

fn credential_ref_for(host_id: &str, kind: CredentialKind) -> String {
    format!("{CREDENTIAL_SCHEME}{host_id}/{}", kind.as_str())
}

fn account_for(host_id: &str, kind: CredentialKind) -> String {
    format!("{host_id}:{}", kind.as_str())
}

fn validate_host_id(host_id: &str) -> Result<(), AppError> {
    if host_id.trim().is_empty() || host_id.contains('/') || host_id.contains(':') {
        return Err(AppError::config_invalid("Credential host id is invalid"));
    }
    Ok(())
}

pub mod keychain {
    pub use super::CredentialStore;
}

#[cfg(test)]
#[derive(Debug, Default)]
struct InMemoryCredentialBackend {
    secrets: std::sync::RwLock<std::collections::HashMap<String, String>>,
}

#[cfg(test)]
impl CredentialBackend for InMemoryCredentialBackend {
    fn set_secret(&self, account: &str, secret: &str) -> Result<(), AppError> {
        self.secrets
            .write()
            .map_err(|_| AppError::internal("Credential test store lock is poisoned"))?
            .insert(account.to_string(), secret.to_string());
        Ok(())
    }

    fn get_secret(&self, account: &str) -> Result<String, AppError> {
        self.secrets
            .read()
            .map_err(|_| AppError::internal("Credential test store lock is poisoned"))?
            .get(account)
            .cloned()
            .ok_or_else(|| {
                AppError::new(
                    AppErrorCode::ConfigInvalid,
                    "Failed to read credential from Keychain",
                )
            })
    }

    fn delete_secret(&self, account: &str) -> Result<(), AppError> {
        self.secrets
            .write()
            .map_err(|_| AppError::internal("Credential test store lock is poisoned"))?
            .remove(account);
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_valid_credential_refs() {
        let parsed =
            parse_credential_ref("vpscope://credential/host-1/password").expect("password ref");
        assert_eq!(parsed.host_id, "host-1");
        assert_eq!(parsed.kind, CredentialKind::Password);

        let parsed =
            parse_credential_ref("vpscope://credential/host-1/passphrase").expect("passphrase ref");
        assert_eq!(parsed.host_id, "host-1");
        assert_eq!(parsed.kind, CredentialKind::Passphrase);
    }

    #[test]
    fn rejects_invalid_credential_refs() {
        for credential_ref in [
            "host-1/password",
            "vpscope://credential//password",
            "vpscope://credential/host-1/token",
            "vpscope://credential/host-1/password/extra",
            "vpscope://credential/host/one/password",
        ] {
            let error = parse_credential_ref(credential_ref).expect_err("invalid ref");
            assert_eq!(error.code, "CONFIG_INVALID");
        }
    }

    #[test]
    fn saves_reads_and_deletes_secrets() {
        let store = CredentialStore::new_in_memory();

        let password_ref = store
            .save_password("host-1", "ubuntu", "correct horse")
            .expect("save password");
        let passphrase_ref = store
            .save_passphrase("host-1", "battery staple")
            .expect("save passphrase");

        assert_eq!(password_ref, "vpscope://credential/host-1/password");
        assert_eq!(passphrase_ref, "vpscope://credential/host-1/passphrase");
        assert_eq!(
            store.get_password(&password_ref).expect("get password"),
            "correct horse"
        );
        assert_eq!(
            store
                .get_passphrase(&passphrase_ref)
                .expect("get passphrase"),
            "battery staple"
        );

        store
            .delete_for_host("host-1")
            .expect("delete host secrets");

        assert_eq!(
            store
                .get_password(&password_ref)
                .expect_err("deleted password")
                .code,
            "CONFIG_INVALID"
        );
        assert_eq!(
            store
                .get_passphrase(&passphrase_ref)
                .expect_err("deleted passphrase")
                .code,
            "CONFIG_INVALID"
        );
    }

    #[test]
    fn rejects_cross_kind_reads() {
        let store = CredentialStore::new_in_memory();
        let password_ref = store
            .save_password("host-1", "ubuntu", "secret")
            .expect("save password");

        let error = store
            .get_passphrase(&password_ref)
            .expect_err("password ref is not passphrase ref");
        assert_eq!(error.code, "CONFIG_INVALID");
    }
}
