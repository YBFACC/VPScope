use crate::{
    config::ConfigStore, errors::AppError, metrics::MetricsScheduler, ssh::SshSessionPool,
    tray::TrayState,
};
use std::{path::PathBuf, sync::Arc};

#[derive(Clone)]
pub struct AppState {
    pub config_store: Arc<ConfigStore>,
    pub ssh_pool: Arc<SshSessionPool>,
    pub metrics_scheduler: Arc<MetricsScheduler>,
    pub tray_state: Arc<TrayState>,
}

impl AppState {
    pub fn new(config_dir: PathBuf) -> Result<Self, AppError> {
        let config_store = Arc::new(ConfigStore::new(config_dir)?);
        let tray_state = Arc::new(TrayState::new(config_store.get_tray_settings()?));
        Ok(Self {
            config_store,
            ssh_pool: Arc::new(SshSessionPool::new_openssh()),
            metrics_scheduler: Arc::new(MetricsScheduler::new(tray_state.clone())),
            tray_state,
        })
    }
}
