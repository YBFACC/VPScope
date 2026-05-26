use serde::{Deserialize, Serialize};

pub type HostId = String;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(
    tag = "type",
    rename_all = "snake_case",
    rename_all_fields = "camelCase"
)]
pub enum HostAuth {
    Password {
        username: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        password_ref: Option<String>,
    },
    PrivateKey {
        username: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        key_path: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none")]
        key_ref: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none")]
        passphrase_ref: Option<String>,
    },
    SshAgent {
        username: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
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
#[serde(rename_all = "camelCase")]
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
#[serde(rename_all = "camelCase")]
pub struct HostPatch {
    pub name: Option<String>,
    pub address: Option<String>,
    pub port: Option<u16>,
    pub auth: Option<HostAuth>,
    pub refresh_interval_ms: Option<u64>,
    pub tags: Option<Vec<String>>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HostUpdatePayload {
    pub id: HostId,
    pub patch: HostPatch,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HostReorderPayload {
    pub ordered_host_ids: Vec<HostId>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HostDeletePayload {
    pub id: HostId,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OkResult {
    pub ok: bool,
}
