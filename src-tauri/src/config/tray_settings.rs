use serde::{Deserialize, Serialize};

use super::HostId;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TraySettings {
    #[serde(default)]
    pub items: Vec<TraySettingsItem>,
}

impl Default for TraySettings {
    fn default() -> Self {
        Self { items: Vec::new() }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TraySettingsItem {
    pub host_id: HostId,
    pub label: String,
    pub display_mode: TrayItemDisplayMode,
    #[serde(default)]
    pub metrics: TrayMetricSettings,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum TrayItemDisplayMode {
    Text,
    Rings,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TrayMetricSettings {
    #[serde(default = "default_true")]
    pub cpu: bool,
    #[serde(default = "default_true")]
    pub memory: bool,
    #[serde(default = "default_true")]
    pub disk: bool,
    #[serde(default = "default_true")]
    pub network: bool,
}

impl Default for TrayMetricSettings {
    fn default() -> Self {
        Self {
            cpu: true,
            memory: true,
            disk: true,
            network: true,
        }
    }
}

fn default_true() -> bool {
    true
}
