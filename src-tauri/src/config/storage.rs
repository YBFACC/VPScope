use super::{
    host_config::{HostAuth, HostConfig, HostCreatePayload, HostPatch},
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
    hosts: RwLock<Vec<HostConfig>>,
    tray_settings: RwLock<TraySettings>,
}

impl ConfigStore {
    pub fn new(config_dir: PathBuf) -> Result<Self, AppError> {
        fs::create_dir_all(&config_dir)?;
        let hosts_path = config_dir.join("hosts.json");
        let tray_settings_path = config_dir.join("tray-settings.json");
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

        Ok(Self {
            hosts_path,
            tray_settings_path,
            hosts: RwLock::new(hosts),
            tray_settings: RwLock::new(tray_settings),
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

    pub fn create_host(&self, payload: HostCreatePayload) -> Result<HostConfig, AppError> {
        validate_host_fields(
            &payload.name,
            &payload.address,
            payload.port,
            payload.refresh_interval_ms,
        )?;

        let now = unix_ms();
        let host = HostConfig {
            id: Uuid::new_v4().to_string(),
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

        if let Some(name) = patch.name {
            updated.name = name;
        }
        if let Some(address) = patch.address {
            updated.address = address;
        }
        if let Some(port) = patch.port {
            updated.port = port;
        }
        if let Some(auth) = patch.auth {
            updated.auth = auth;
        }
        if let Some(refresh_interval_ms) = patch.refresh_interval_ms {
            updated.refresh_interval_ms = refresh_interval_ms;
        }
        if let Some(tags) = patch.tags {
            updated.tags = tags;
        }

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
        self.save_tray_settings_locked(&tray_settings)
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
        HostAuth::Password { username, .. }
        | HostAuth::PrivateKey { username, .. }
        | HostAuth::SshAgent { username } => username,
    }
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
