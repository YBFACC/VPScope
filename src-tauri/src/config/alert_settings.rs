use serde::{Deserialize, Serialize};

use super::HostId;

pub const DEFAULT_ALERT_THRESHOLD_PERCENT: f64 = 90.0;
pub const DEFAULT_ALERT_COOLDOWN_MS: u64 = 600_000;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AlertSettings {
    #[serde(default)]
    pub rules: Vec<AlertRule>,
}

impl Default for AlertSettings {
    fn default() -> Self {
        Self { rules: Vec::new() }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AlertRule {
    pub id: String,
    pub host_id: HostId,
    pub metric: AlertMetric,
    pub enabled: bool,
    pub threshold_percent: f64,
    pub cooldown_ms: u64,
    pub created_at: u64,
    pub updated_at: u64,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum AlertMetric {
    Cpu,
}
