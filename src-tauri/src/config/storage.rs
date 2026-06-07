use super::{
    alert_settings::{AlertMetric, AlertRule, AlertSettings},
    host_config::{HostAuth, HostConfig, HostCreatePayload, HostPatch},
    terminal_settings::TerminalSettings,
    tray_settings::{TraySettings, TraySettingsItem},
};
use crate::errors::AppError;
use std::{
    fs,
    path::{Path, PathBuf},
    sync::RwLock,
    time::{SystemTime, UNIX_EPOCH},
};
use uuid::Uuid;

#[derive(Debug)]
pub struct ConfigStore {
    hosts_path: PathBuf,
    tray_settings_path: PathBuf,
    alert_settings_path: PathBuf,
    terminal_settings_path: PathBuf,
    hosts: RwLock<Vec<HostConfig>>,
    tray_settings: RwLock<TraySettings>,
    alert_settings: RwLock<AlertSettings>,
    terminal_settings: RwLock<TerminalSettings>,
}

impl ConfigStore {
    pub fn new(config_dir: PathBuf) -> Result<Self, AppError> {
        fs::create_dir_all(&config_dir)?;
        let hosts_path = config_dir.join("hosts.json");
        let tray_settings_path = config_dir.join("tray-settings.json");
        let alert_settings_path = config_dir.join("alert-settings.json");
        let terminal_settings_path = config_dir.join("terminal-settings.json");
        let hosts = if hosts_path.exists() {
            let content = fs::read_to_string(&hosts_path)?;
            if content.trim().is_empty() {
                Vec::new()
            } else {
                serde_json::from_str(&content).map_err(|err| {
                    AppError::config_invalid("Saved host configuration is invalid")
                        .with_detail(err.to_string())
                })?
            }
        } else {
            Vec::new()
        };
        let tray_settings =
            read_json_or_default(&tray_settings_path, "Saved tray settings are invalid")?;
        let alert_settings =
            read_json_or_default(&alert_settings_path, "Saved alert settings are invalid")?;
        let terminal_settings = read_json_or_default(
            &terminal_settings_path,
            "Saved terminal settings are invalid",
        )?;
        validate_alert_settings(&alert_settings, &hosts)?;

        Ok(Self {
            hosts_path,
            tray_settings_path,
            alert_settings_path,
            terminal_settings_path,
            hosts: RwLock::new(hosts),
            tray_settings: RwLock::new(tray_settings),
            alert_settings: RwLock::new(alert_settings),
            terminal_settings: RwLock::new(terminal_settings),
        })
    }

    pub fn list_hosts(&self) -> Result<Vec<HostConfig>, AppError> {
        Ok(self
            .hosts
            .read()
            .map_err(|_| AppError::internal("Host config lock is poisoned"))?
            .clone())
    }

    pub fn get_host(&self, id: &str) -> Result<HostConfig, AppError> {
        self.hosts
            .read()
            .map_err(|_| AppError::internal("Host config lock is poisoned"))?
            .iter()
            .find(|host| host.id == id)
            .cloned()
            .ok_or_else(|| AppError::host_not_found(id))
    }

    pub fn validate_host_create(&self, payload: &HostCreatePayload) -> Result<(), AppError> {
        validate_host_fields(
            &payload.name,
            &payload.address,
            payload.port,
            payload.refresh_interval_ms,
        )?;

        let candidate = HostConfig {
            id: String::new(),
            name: payload.name.clone(),
            address: payload.address.clone(),
            port: payload.port,
            auth: payload.auth.clone(),
            refresh_interval_ms: payload.refresh_interval_ms,
            tags: payload.tags.clone(),
            created_at: 0,
            updated_at: 0,
        };
        let hosts = self
            .hosts
            .read()
            .map_err(|_| AppError::internal("Host config lock is poisoned"))?;
        if hosts
            .iter()
            .any(|existing| is_same_endpoint(existing, &candidate))
        {
            return Err(AppError::config_invalid(
                "A host with the same address, port, and username already exists",
            ));
        }

        Ok(())
    }

    pub fn validate_host_update(&self, id: &str, patch: &HostPatch) -> Result<(), AppError> {
        let hosts = self
            .hosts
            .read()
            .map_err(|_| AppError::internal("Host config lock is poisoned"))?;
        let index = hosts
            .iter()
            .position(|host| host.id == id)
            .ok_or_else(|| AppError::host_not_found(id))?;
        let mut updated = hosts[index].clone();
        apply_host_patch(&mut updated, patch.clone());

        validate_host_fields(
            &updated.name,
            &updated.address,
            updated.port,
            updated.refresh_interval_ms,
        )?;
        if hosts
            .iter()
            .any(|candidate| candidate.id != id && is_same_endpoint(candidate, &updated))
        {
            return Err(AppError::config_invalid(
                "A host with the same address, port, and username already exists",
            ));
        }

        Ok(())
    }

    pub fn create_host(&self, payload: HostCreatePayload) -> Result<HostConfig, AppError> {
        self.create_host_with_id(Uuid::new_v4().to_string(), payload)
    }

    pub fn create_host_with_id(
        &self,
        id: String,
        payload: HostCreatePayload,
    ) -> Result<HostConfig, AppError> {
        validate_host_fields(
            &payload.name,
            &payload.address,
            payload.port,
            payload.refresh_interval_ms,
        )?;

        let now = unix_ms();
        let host = HostConfig {
            id,
            name: payload.name,
            address: payload.address,
            port: payload.port,
            auth: payload.auth,
            refresh_interval_ms: payload.refresh_interval_ms,
            tags: payload.tags,
            created_at: now,
            updated_at: now,
        };

        let mut hosts = self
            .hosts
            .write()
            .map_err(|_| AppError::internal("Host config lock is poisoned"))?;
        if hosts
            .iter()
            .any(|existing| is_same_endpoint(existing, &host))
        {
            return Err(AppError::config_invalid(
                "A host with the same address, port, and username already exists",
            ));
        }
        hosts.push(host.clone());
        self.save_locked(&hosts)?;
        Ok(host)
    }

    pub fn update_host(&self, id: &str, patch: HostPatch) -> Result<HostConfig, AppError> {
        let mut hosts = self
            .hosts
            .write()
            .map_err(|_| AppError::internal("Host config lock is poisoned"))?;
        let index = hosts
            .iter()
            .position(|host| host.id == id)
            .ok_or_else(|| AppError::host_not_found(id))?;
        let mut updated = hosts[index].clone();

        apply_host_patch(&mut updated, patch);

        validate_host_fields(
            &updated.name,
            &updated.address,
            updated.port,
            updated.refresh_interval_ms,
        )?;
        if hosts
            .iter()
            .any(|candidate| candidate.id != id && is_same_endpoint(candidate, &updated))
        {
            return Err(AppError::config_invalid(
                "A host with the same address, port, and username already exists",
            ));
        }
        updated.updated_at = unix_ms();
        hosts[index] = updated.clone();
        self.save_locked(&hosts)?;
        Ok(updated)
    }

    pub fn reorder_hosts(
        &self,
        ordered_host_ids: Vec<String>,
    ) -> Result<Vec<HostConfig>, AppError> {
        let mut hosts = self
            .hosts
            .write()
            .map_err(|_| AppError::internal("Host config lock is poisoned"))?;
        let reordered = reorder_hosts_by_ids(&hosts, &ordered_host_ids)?;

        *hosts = reordered;
        self.save_locked(&hosts)?;
        Ok(hosts.clone())
    }

    pub fn delete_host(&self, id: &str) -> Result<(), AppError> {
        let mut hosts = self
            .hosts
            .write()
            .map_err(|_| AppError::internal("Host config lock is poisoned"))?;
        let before = hosts.len();
        hosts.retain(|host| host.id != id);
        if hosts.len() == before {
            return Err(AppError::host_not_found(id));
        }
        self.save_locked(&hosts)?;
        drop(hosts);

        let mut tray_settings = self
            .tray_settings
            .write()
            .map_err(|_| AppError::internal("Tray settings lock is poisoned"))?;
        tray_settings.items.retain(|item| item.host_id != id);
        self.save_tray_settings_locked(&tray_settings)?;
        drop(tray_settings);

        let mut alert_settings = self
            .alert_settings
            .write()
            .map_err(|_| AppError::internal("Alert settings lock is poisoned"))?;
        alert_settings.rules.retain(|rule| rule.host_id != id);
        self.save_alert_settings_locked(&alert_settings)
    }

    pub fn get_tray_settings(&self) -> Result<TraySettings, AppError> {
        Ok(self
            .tray_settings
            .read()
            .map_err(|_| AppError::internal("Tray settings lock is poisoned"))?
            .clone())
    }

    pub fn update_tray_settings(&self, settings: TraySettings) -> Result<TraySettings, AppError> {
        let hosts = self
            .hosts
            .read()
            .map_err(|_| AppError::internal("Host config lock is poisoned"))?;
        validate_tray_settings(&settings, &hosts)?;
        drop(hosts);

        let mut tray_settings = self
            .tray_settings
            .write()
            .map_err(|_| AppError::internal("Tray settings lock is poisoned"))?;
        *tray_settings = settings.clone();
        self.save_tray_settings_locked(&tray_settings)?;
        Ok(settings)
    }

    pub fn get_alert_settings(&self) -> Result<AlertSettings, AppError> {
        Ok(self
            .alert_settings
            .read()
            .map_err(|_| AppError::internal("Alert settings lock is poisoned"))?
            .clone())
    }

    pub fn update_alert_settings(
        &self,
        settings: AlertSettings,
    ) -> Result<AlertSettings, AppError> {
        let hosts = self
            .hosts
            .read()
            .map_err(|_| AppError::internal("Host config lock is poisoned"))?;
        validate_alert_settings(&settings, &hosts)?;
        drop(hosts);

        let mut alert_settings = self
            .alert_settings
            .write()
            .map_err(|_| AppError::internal("Alert settings lock is poisoned"))?;
        *alert_settings = settings.clone();
        self.save_alert_settings_locked(&alert_settings)?;
        Ok(settings)
    }

    pub fn get_terminal_settings(&self) -> Result<TerminalSettings, AppError> {
        Ok(self
            .terminal_settings
            .read()
            .map_err(|_| AppError::internal("Terminal settings lock is poisoned"))?
            .clone())
    }

    pub fn update_terminal_settings(
        &self,
        settings: TerminalSettings,
    ) -> Result<TerminalSettings, AppError> {
        let mut terminal_settings = self
            .terminal_settings
            .write()
            .map_err(|_| AppError::internal("Terminal settings lock is poisoned"))?;
        *terminal_settings = settings.clone();
        self.save_terminal_settings_locked(&terminal_settings)?;
        Ok(settings)
    }

    fn save_locked(&self, hosts: &[HostConfig]) -> Result<(), AppError> {
        let parent = self.hosts_path.parent().unwrap_or_else(|| Path::new("."));
        fs::create_dir_all(parent)?;
        let temp_path = self.hosts_path.with_extension("json.tmp");
        let bytes = serde_json::to_vec_pretty(hosts).map_err(|err| {
            AppError::internal("Failed to serialize host configuration")
                .with_detail(err.to_string())
        })?;
        fs::write(&temp_path, bytes)?;
        fs::rename(temp_path, &self.hosts_path)?;
        Ok(())
    }

    fn save_tray_settings_locked(&self, settings: &TraySettings) -> Result<(), AppError> {
        write_json_atomic(
            &self.tray_settings_path,
            settings,
            "Failed to serialize tray settings",
        )
    }

    fn save_alert_settings_locked(&self, settings: &AlertSettings) -> Result<(), AppError> {
        write_json_atomic(
            &self.alert_settings_path,
            settings,
            "Failed to serialize alert settings",
        )
    }

    fn save_terminal_settings_locked(&self, settings: &TerminalSettings) -> Result<(), AppError> {
        write_json_atomic(
            &self.terminal_settings_path,
            settings,
            "Failed to serialize terminal settings",
        )
    }
}

fn read_json_or_default<T>(path: &Path, invalid_message: &str) -> Result<T, AppError>
where
    T: serde::de::DeserializeOwned + Default,
{
    if !path.exists() {
        return Ok(T::default());
    }

    let content = fs::read_to_string(path)?;
    if content.trim().is_empty() {
        return Ok(T::default());
    }

    serde_json::from_str(&content)
        .map_err(|err| AppError::config_invalid(invalid_message).with_detail(err.to_string()))
}

fn write_json_atomic<T>(path: &Path, value: &T, message: &str) -> Result<(), AppError>
where
    T: serde::Serialize,
{
    let parent = path.parent().unwrap_or_else(|| Path::new("."));
    fs::create_dir_all(parent)?;
    let temp_path = path.with_extension("json.tmp");
    let bytes = serde_json::to_vec_pretty(value)
        .map_err(|err| AppError::internal(message).with_detail(err.to_string()))?;
    fs::write(&temp_path, bytes)?;
    fs::rename(temp_path, path)?;
    Ok(())
}

fn is_same_endpoint(left: &HostConfig, right: &HostConfig) -> bool {
    left.address.trim() == right.address.trim()
        && left.port == right.port
        && auth_username(&left.auth).trim() == auth_username(&right.auth).trim()
}

fn auth_username(auth: &HostAuth) -> &str {
    match auth {
        HostAuth::PrivateKey { username, .. } | HostAuth::SshAgent { username } => username,
    }
}

fn apply_host_patch(host: &mut HostConfig, patch: HostPatch) {
    if let Some(name) = patch.name {
        host.name = name;
    }
    if let Some(address) = patch.address {
        host.address = address;
    }
    if let Some(port) = patch.port {
        host.port = port;
    }
    if let Some(auth) = patch.auth {
        host.auth = auth;
    }
    if let Some(refresh_interval_ms) = patch.refresh_interval_ms {
        host.refresh_interval_ms = refresh_interval_ms;
    }
    if let Some(tags) = patch.tags {
        host.tags = tags;
    }
}

fn reorder_hosts_by_ids(
    hosts: &[HostConfig],
    ordered_host_ids: &[String],
) -> Result<Vec<HostConfig>, AppError> {
    if ordered_host_ids.len() != hosts.len() {
        return Err(AppError::config_invalid(
            "Host reorder payload must include every saved host exactly once",
        ));
    }

    let mut reordered = Vec::with_capacity(hosts.len());

    for host_id in ordered_host_ids {
        if reordered
            .iter()
            .any(|host: &HostConfig| host.id == *host_id)
        {
            return Err(AppError::config_invalid(
                "Host reorder payload contains a duplicate host id",
            ));
        }

        let host = hosts
            .iter()
            .find(|candidate| candidate.id == *host_id)
            .cloned()
            .ok_or_else(|| AppError::host_not_found(host_id))?;
        reordered.push(host);
    }

    Ok(reordered)
}

fn validate_tray_settings(settings: &TraySettings, hosts: &[HostConfig]) -> Result<(), AppError> {
    let mut seen = Vec::<&str>::new();

    for item in &settings.items {
        validate_tray_item(item, hosts, &mut seen)?;
    }

    Ok(())
}

fn validate_tray_item<'a>(
    item: &'a TraySettingsItem,
    hosts: &[HostConfig],
    seen: &mut Vec<&'a str>,
) -> Result<(), AppError> {
    if !hosts.iter().any(|host| host.id == item.host_id) {
        return Err(AppError::host_not_found(&item.host_id));
    }

    if seen.contains(&item.host_id.as_str()) {
        return Err(AppError::config_invalid(
            "A host can only appear once in menu bar settings",
        ));
    }
    seen.push(item.host_id.as_str());

    let label = item.label.trim();
    if label.is_empty() {
        return Err(AppError::config_invalid("Menu bar label is required"));
    }
    if label.chars().count() > 12 {
        return Err(AppError::config_invalid(
            "Menu bar label must be 12 characters or less",
        ));
    }

    if !item.metrics.cpu && !item.metrics.memory && !item.metrics.disk && !item.metrics.network {
        return Err(AppError::config_invalid(
            "Menu bar item must display at least one metric",
        ));
    }

    Ok(())
}

fn validate_alert_settings(settings: &AlertSettings, hosts: &[HostConfig]) -> Result<(), AppError> {
    let mut seen = Vec::<(&str, AlertMetric)>::new();

    for rule in &settings.rules {
        validate_alert_rule(rule, hosts, &mut seen)?;
    }

    Ok(())
}

fn validate_alert_rule<'a>(
    rule: &'a AlertRule,
    hosts: &[HostConfig],
    seen: &mut Vec<(&'a str, AlertMetric)>,
) -> Result<(), AppError> {
    if rule.id.trim().is_empty() {
        return Err(AppError::config_invalid("Alert rule id is required"));
    }

    if !hosts.iter().any(|host| host.id == rule.host_id) {
        return Err(AppError::host_not_found(&rule.host_id));
    }

    if seen
        .iter()
        .any(|(host_id, metric)| *host_id == rule.host_id.as_str() && *metric == rule.metric)
    {
        return Err(AppError::config_invalid(
            "A host can only have one alert rule per metric",
        ));
    }
    seen.push((rule.host_id.as_str(), rule.metric));

    if !(1.0..=100.0).contains(&rule.threshold_percent) {
        return Err(AppError::config_invalid(
            "Alert threshold must be between 1 and 100 percent",
        ));
    }

    if !(60_000..=3_600_000).contains(&rule.cooldown_ms) {
        return Err(AppError::config_invalid(
            "Alert cooldown must be between 1 and 60 minutes",
        ));
    }

    Ok(())
}

pub fn unix_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis() as u64)
        .unwrap_or(0)
}

fn validate_host_fields(
    name: &str,
    address: &str,
    port: u16,
    refresh_interval_ms: u64,
) -> Result<(), AppError> {
    if name.trim().is_empty() {
        return Err(AppError::config_invalid("Host name is required"));
    }
    if address.trim().is_empty() {
        return Err(AppError::config_invalid("Host address is required"));
    }
    if address.trim().starts_with('-') {
        return Err(AppError::config_invalid("Host address is invalid"));
    }
    if port == 0 {
        return Err(AppError::config_invalid(
            "Host port must be greater than zero",
        ));
    }
    if !(500..=10_000).contains(&refresh_interval_ms) {
        return Err(AppError::config_invalid(
            "Refresh interval must be between 500ms and 10000ms",
        ));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::config::{AlertMetric, HostAuth, HostCreatePayload, TerminalApp, TerminalSettings};
    use std::env;

    fn temp_config_dir(name: &str) -> PathBuf {
        env::temp_dir().join(format!("vpscope-{name}-{}", Uuid::new_v4()))
    }

    fn create_store(name: &str) -> ConfigStore {
        ConfigStore::new(temp_config_dir(name)).expect("config store")
    }

    fn create_named_test_host(store: &ConfigStore, name: &str, address: &str) -> HostConfig {
        store
            .create_host(HostCreatePayload {
                name: name.to_string(),
                address: address.to_string(),
                port: 22,
                auth: HostAuth::SshAgent {
                    username: "ubuntu".to_string(),
                },
                refresh_interval_ms: 2_000,
                tags: Vec::new(),
            })
            .expect("host")
    }

    fn create_test_host(store: &ConfigStore) -> HostConfig {
        create_named_test_host(store, "prod-1", "203.0.113.10")
    }

    fn cpu_rule(id: &str, host_id: &str) -> AlertRule {
        AlertRule {
            id: id.to_string(),
            host_id: host_id.to_string(),
            metric: AlertMetric::Cpu,
            enabled: true,
            threshold_percent: 90.0,
            cooldown_ms: 600_000,
            created_at: 1,
            updated_at: 1,
        }
    }

    #[test]
    fn alert_settings_round_trip_to_disk() {
        let config_dir = temp_config_dir("alert-round-trip");
        let store = ConfigStore::new(config_dir.clone()).expect("store");
        let host = create_test_host(&store);
        let settings = AlertSettings {
            rules: vec![cpu_rule("cpu-prod-1", &host.id)],
        };

        store
            .update_alert_settings(settings)
            .expect("save alert settings");

        let reloaded = ConfigStore::new(config_dir)
            .expect("reload store")
            .get_alert_settings()
            .expect("read alert settings");

        assert_eq!(reloaded.rules.len(), 1);
        assert_eq!(reloaded.rules[0].host_id, host.id);
        assert_eq!(reloaded.rules[0].threshold_percent, 90.0);
    }

    #[test]
    fn alert_settings_reject_duplicate_metric_for_host() {
        let store = create_store("alert-duplicate");
        let host = create_test_host(&store);

        let error = store
            .update_alert_settings(AlertSettings {
                rules: vec![cpu_rule("cpu-a", &host.id), cpu_rule("cpu-b", &host.id)],
            })
            .expect_err("duplicate rule must fail");

        assert_eq!(error.code, "CONFIG_INVALID");
    }

    #[test]
    fn alert_settings_validate_host_threshold_and_cooldown() {
        let store = create_store("alert-validate");
        let host = create_test_host(&store);

        let unknown_host_error = store
            .update_alert_settings(AlertSettings {
                rules: vec![cpu_rule("cpu-missing", "missing-host")],
            })
            .expect_err("unknown host must fail");
        assert_eq!(unknown_host_error.code, "HOST_NOT_FOUND");

        let mut low_threshold = cpu_rule("cpu-low", &host.id);
        low_threshold.threshold_percent = 0.0;
        let threshold_error = store
            .update_alert_settings(AlertSettings {
                rules: vec![low_threshold],
            })
            .expect_err("low threshold must fail");
        assert_eq!(threshold_error.code, "CONFIG_INVALID");

        let mut low_cooldown = cpu_rule("cpu-cooldown", &host.id);
        low_cooldown.cooldown_ms = 59_000;
        let cooldown_error = store
            .update_alert_settings(AlertSettings {
                rules: vec![low_cooldown],
            })
            .expect_err("low cooldown must fail");
        assert_eq!(cooldown_error.code, "CONFIG_INVALID");
    }

    #[test]
    fn deleting_host_removes_alert_rules() {
        let store = create_store("alert-delete");
        let host = create_test_host(&store);

        store
            .update_alert_settings(AlertSettings {
                rules: vec![cpu_rule("cpu-prod-1", &host.id)],
            })
            .expect("save alert settings");

        store.delete_host(&host.id).expect("delete host");

        let settings = store.get_alert_settings().expect("alert settings");
        assert!(settings.rules.is_empty());
    }

    #[test]
    fn reorder_hosts_round_trip_to_disk_without_touching_timestamps() {
        let config_dir = temp_config_dir("host-reorder-round-trip");
        let store = ConfigStore::new(config_dir.clone()).expect("store");
        let first = create_named_test_host(&store, "prod-1", "203.0.113.10");
        let second = create_named_test_host(&store, "prod-2", "203.0.113.11");
        let third = create_named_test_host(&store, "prod-3", "203.0.113.12");

        let reordered = store
            .reorder_hosts(vec![third.id.clone(), first.id.clone(), second.id.clone()])
            .expect("reorder hosts");

        assert_eq!(
            reordered
                .iter()
                .map(|host| host.id.as_str())
                .collect::<Vec<_>>(),
            vec![third.id.as_str(), first.id.as_str(), second.id.as_str()]
        );
        assert_eq!(reordered[1].updated_at, first.updated_at);

        let reloaded = ConfigStore::new(config_dir)
            .expect("reload store")
            .list_hosts()
            .expect("list hosts");

        assert_eq!(
            reloaded
                .iter()
                .map(|host| host.id.as_str())
                .collect::<Vec<_>>(),
            vec![third.id.as_str(), first.id.as_str(), second.id.as_str()]
        );
    }

    #[test]
    fn reorder_hosts_rejects_invalid_id_lists_without_changing_order() {
        let store = create_store("host-reorder-invalid");
        let first = create_named_test_host(&store, "prod-1", "203.0.113.10");
        let second = create_named_test_host(&store, "prod-2", "203.0.113.11");
        let original_ids = vec![first.id.clone(), second.id.clone()];

        let missing_error = store
            .reorder_hosts(vec![second.id.clone()])
            .expect_err("missing host id must fail");
        assert_eq!(missing_error.code, "CONFIG_INVALID");

        let duplicate_error = store
            .reorder_hosts(vec![first.id.clone(), first.id.clone()])
            .expect_err("duplicate host id must fail");
        assert_eq!(duplicate_error.code, "CONFIG_INVALID");

        let unknown_error = store
            .reorder_hosts(vec![second.id.clone(), "missing-host".to_string()])
            .expect_err("unknown host id must fail");
        assert_eq!(unknown_error.code, "HOST_NOT_FOUND");

        let current_ids = store
            .list_hosts()
            .expect("list hosts")
            .into_iter()
            .map(|host| host.id)
            .collect::<Vec<_>>();
        assert_eq!(current_ids, original_ids);
    }

    #[test]
    fn terminal_settings_default_to_terminal_app() {
        let store = create_store("terminal-default");

        let settings = store
            .get_terminal_settings()
            .expect("read terminal settings");

        assert_eq!(settings.app, TerminalApp::TerminalApp);
    }

    #[test]
    fn terminal_settings_round_trip_to_disk() {
        let config_dir = temp_config_dir("terminal-round-trip");
        let store = ConfigStore::new(config_dir.clone()).expect("store");

        store
            .update_terminal_settings(TerminalSettings {
                app: TerminalApp::Iterm2,
            })
            .expect("save terminal settings");

        let reloaded = ConfigStore::new(config_dir)
            .expect("reload store")
            .get_terminal_settings()
            .expect("read terminal settings");

        assert_eq!(reloaded.app, TerminalApp::Iterm2);
    }
}
