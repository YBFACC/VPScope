use serde::{Deserialize, Serialize};

pub type HostId = String;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(
    tag = "type",
    rename_all = "snake_case",
    rename_all_fields = "camelCase",
    deny_unknown_fields
)]
pub enum HostAuth {
    PrivateKey {
        username: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        key_path: Option<String>,
    },
    SshAgent {
        username: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct HostConfig {
    pub id: HostId,
    pub name: String,
    pub address: String,
    pub port: u16,
    pub auth: HostAuth,
    pub refresh_interval_ms: u64,
    pub tags: Vec<String>,
    pub created_at: u64,
    pub updated_at: u64,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct HostCreatePayload {
    pub name: String,
    pub address: String,
    pub port: u16,
    pub auth: HostAuth,
    pub refresh_interval_ms: u64,
    #[serde(default)]
    pub tags: Vec<String>,
}

#[derive(Debug, Clone, Deserialize, Default)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct HostPatch {
    pub name: Option<String>,
    pub address: Option<String>,
    pub port: Option<u16>,
    pub auth: Option<HostAuth>,
    pub refresh_interval_ms: Option<u64>,
    pub tags: Option<Vec<String>>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct HostUpdatePayload {
    pub id: HostId,
    pub patch: HostPatch,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct HostReorderPayload {
    pub ordered_host_ids: Vec<HostId>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct HostDeletePayload {
    pub id: HostId,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OkResult {
    pub ok: bool,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn deserializes_passwordless_host_auth() {
        let agent: HostAuth = serde_json::from_str(r#"{"type":"ssh_agent","username":"ubuntu"}"#)
            .expect("ssh agent auth");
        assert!(matches!(agent, HostAuth::SshAgent { .. }));

        let key: HostAuth = serde_json::from_str(
            r#"{"type":"private_key","username":"ubuntu","keyPath":"~/.ssh/id_ed25519"}"#,
        )
        .expect("private key auth");
        assert!(matches!(key, HostAuth::PrivateKey { .. }));
    }

    #[test]
    fn rejects_legacy_app_managed_auth_fields() {
        for value in [
            r#"{"type":"password","username":"ubuntu","passwordRef":"vpscope://credential/host/password"}"#,
            r#"{"type":"private_key","username":"ubuntu","keyPath":"~/.ssh/id_ed25519","passphraseRef":"vpscope://credential/host/passphrase"}"#,
            r#"{"type":"private_key","username":"ubuntu","keyPath":"~/.ssh/id_ed25519","keyRef":"vpscope://credential/host/key"}"#,
        ] {
            serde_json::from_str::<HostAuth>(value).expect_err("legacy auth must be invalid");
        }
    }
}
