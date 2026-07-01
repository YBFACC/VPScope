use crate::{
    config::{HostAuth, HostConfig},
    errors::{AppError, AppErrorCode},
};
use async_trait::async_trait;
use openssh::{KnownHosts, Session, SessionBuilder};
use serde::{Deserialize, Serialize};
use std::{
    collections::HashMap,
    io::{ErrorKind, Write},
    path::Path,
    process::{Command, Stdio},
    sync::{Arc, Mutex},
    time::Instant,
};

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ConnectionInfo {
    pub ok: bool,
    pub latency_ms: u64,
    pub hostname: String,
    pub os: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub kernel: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub fingerprint: Option<String>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum DockerContainerAction {
    Start,
    Stop,
    Restart,
    Remove,
    ForceRemove,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum RemoteCommand {
    ProcStat,
    ProcMeminfo,
    ProcLoadavg,
    ProcUptime,
    ProcNetDev,
    ProcDiskstats,
    Df,
    Ps,
    Uname,
    DockerContainerList,
    DockerContainerLogs {
        container_id: String,
        tail_lines: u16,
    },
    DockerContainerAction {
        container_id: String,
        action: DockerContainerAction,
    },
}

impl RemoteCommand {
    pub fn as_fixed_command(&self) -> String {
        match self {
            Self::ProcStat => "cat /proc/stat".to_string(),
            Self::ProcMeminfo => "cat /proc/meminfo".to_string(),
            Self::ProcLoadavg => "cat /proc/loadavg".to_string(),
            Self::ProcUptime => "cat /proc/uptime".to_string(),
            Self::ProcNetDev => "cat /proc/net/dev".to_string(),
            Self::ProcDiskstats => "cat /proc/diskstats".to_string(),
            Self::Df => "df -P".to_string(),
            Self::Ps => "ps -eo pid,ppid,user,stat,pcpu,pmem,rss,args".to_string(),
            Self::Uname => "uname -a".to_string(),
            Self::DockerContainerList => {
                "docker ps -a --format {{.ID}}\\t{{.Names}}\\t{{.Image}}\\t{{.State}}\\t{{.Status}}"
                    .to_string()
            }
            Self::DockerContainerLogs {
                container_id,
                tail_lines,
            } => {
                format!("docker logs --tail {tail_lines} {container_id}")
            }
            Self::DockerContainerAction {
                container_id,
                action,
            } => match action {
                DockerContainerAction::Start => format!("docker start {container_id}"),
                DockerContainerAction::Stop => format!("docker stop {container_id}"),
                DockerContainerAction::Restart => format!("docker restart {container_id}"),
                DockerContainerAction::Remove => format!("docker rm {container_id}"),
                DockerContainerAction::ForceRemove => format!("docker rm -f {container_id}"),
            },
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum MetricsBatchMode {
    Fast,
    Slow,
    Process,
    Full,
}

impl MetricsBatchMode {
    fn includes_slow_metrics(self) -> bool {
        matches!(self, Self::Slow | Self::Full)
    }

    fn includes_process_metrics(self) -> bool {
        matches!(self, Self::Process | Self::Full)
    }
}

#[derive(Debug, Clone)]
pub struct RemoteMetricsOutput {
    pub uname: Option<String>,
    pub loadavg: String,
    pub uptime: String,
    pub proc_stat: String,
    pub meminfo: String,
    pub df: Option<String>,
    pub net_dev: String,
    pub diskstats: String,
    pub ps: Option<String>,
}

#[async_trait]
pub trait SshClient: Send + Sync {
    async fn test_connection(&self, host: &HostConfig) -> Result<ConnectionInfo, AppError>;
    async fn exec(&self, host: &HostConfig, command: RemoteCommand) -> Result<String, AppError>;
    async fn accept_host_key(
        &self,
        _host: &HostConfig,
        _expected_fingerprint: &str,
    ) -> Result<String, AppError> {
        Err(AppError::new(
            AppErrorCode::RemoteUnsupported,
            "SSH host key confirmation is not supported by this client",
        ))
    }
    fn disconnect_host(&self, _host_id: &str) -> Result<(), AppError> {
        Ok(())
    }

    async fn collect_metrics(
        &self,
        host: &HostConfig,
        mode: MetricsBatchMode,
    ) -> Result<RemoteMetricsOutput, AppError> {
        let uname = if mode.includes_slow_metrics() {
            Some(self.exec(host, RemoteCommand::Uname).await?)
        } else {
            None
        };
        let loadavg = self.exec(host, RemoteCommand::ProcLoadavg).await?;
        let uptime = self.exec(host, RemoteCommand::ProcUptime).await?;
        let proc_stat = self.exec(host, RemoteCommand::ProcStat).await?;
        let meminfo = self.exec(host, RemoteCommand::ProcMeminfo).await?;
        let df = if mode.includes_slow_metrics() {
            Some(self.exec(host, RemoteCommand::Df).await?)
        } else {
            None
        };
        let net_dev = self.exec(host, RemoteCommand::ProcNetDev).await?;
        let diskstats = self.exec(host, RemoteCommand::ProcDiskstats).await?;
        let ps = if mode.includes_process_metrics() {
            Some(self.exec(host, RemoteCommand::Ps).await?)
        } else {
            None
        };

        Ok(RemoteMetricsOutput {
            uname,
            loadavg,
            uptime,
            proc_stat,
            meminfo,
            df,
            net_dev,
            diskstats,
            ps,
        })
    }
}

#[derive(Debug, Default)]
pub struct MockSshClient;

#[async_trait]
impl SshClient for MockSshClient {
    async fn test_connection(&self, host: &HostConfig) -> Result<ConnectionInfo, AppError> {
        let started = Instant::now();
        if host.address.trim().is_empty() {
            return Err(AppError::new(
                AppErrorCode::SshConnectFailed,
                "Host address is empty",
            ));
        }

        Ok(ConnectionInfo {
            ok: true,
            latency_ms: started.elapsed().as_millis() as u64,
            hostname: host.name.clone(),
            os: "mock-linux".to_string(),
            kernel: Some("mock-kernel".to_string()),
            fingerprint: None,
        })
    }

    async fn exec(&self, _host: &HostConfig, command: RemoteCommand) -> Result<String, AppError> {
        Err(AppError::new(
            AppErrorCode::RemoteUnsupported,
            "Real SSH execution is not implemented yet",
        )
        .with_detail(format!("fixedCommand={}", command.as_fixed_command())))
    }

    async fn accept_host_key(
        &self,
        _host: &HostConfig,
        expected_fingerprint: &str,
    ) -> Result<String, AppError> {
        Ok(expected_fingerprint.to_string())
    }
}

#[derive(Debug, Clone)]
struct CachedSession {
    signature: String,
    session: Arc<Session>,
}

#[derive(Debug, Default)]
pub struct OpenSshClient {
    sessions: Mutex<HashMap<String, CachedSession>>,
}

impl OpenSshClient {
    pub fn new() -> Self {
        Self::default()
    }

    fn builder_for(host: &HostConfig, known_hosts: KnownHosts) -> Result<SessionBuilder, AppError> {
        let mut builder = SessionBuilder::default();
        builder
            .port(host.port)
            .known_hosts_check(known_hosts)
            .connect_timeout(std::time::Duration::from_secs(8))
            .server_alive_interval(std::time::Duration::from_secs(15));

        match &host.auth {
            HostAuth::PrivateKey { username, .. } | HostAuth::SshAgent { username } => {
                builder.user(username.clone());
            }
        }

        if let HostAuth::PrivateKey {
            key_path: Some(key_path),
            ..
        } = &host.auth
        {
            builder.keyfile(key_path);
        }

        Ok(builder)
    }

    async fn connect(host: &HostConfig, known_hosts: KnownHosts) -> Result<Session, AppError> {
        Self::connect_with_known_hosts_file(host, known_hosts, None).await
    }

    async fn connect_with_known_hosts_file(
        host: &HostConfig,
        known_hosts: KnownHosts,
        known_hosts_file: Option<&Path>,
    ) -> Result<Session, AppError> {
        if host.address.trim().is_empty() {
            return Err(AppError::config_invalid("Host address is required"));
        }

        let mut builder = Self::builder_for(host, known_hosts)?;
        if let Some(known_hosts_file) = known_hosts_file {
            builder.user_known_hosts_file(known_hosts_file);
        }

        match builder.connect_mux(host.address.trim()).await {
            Ok(session) => Ok(session),
            Err(error) => {
                let app_error = map_openssh_connect_error(error);
                if app_error.code == AppErrorCode::SshHostKeyUnknown.as_str() {
                    return Err(
                        match scan_host_key_fingerprints(host)
                            .and_then(|fingerprints| preferred_host_key_fingerprint(&fingerprints))
                        {
                            Ok(fingerprint) => app_error.with_fingerprint(fingerprint),
                            Err(scan_error) => {
                                let detail =
                                    app_error.detail.as_deref().unwrap_or_default().to_string();
                                app_error
                                    .with_detail(format!("{detail}; fingerprintScan={scan_error}"))
                            }
                        },
                    );
                }

                Err(app_error)
            }
        }
    }

    fn session_signature(host: &HostConfig) -> String {
        let auth = match &host.auth {
            HostAuth::PrivateKey { username, key_path } => format!(
                "private_key:{username}:{}",
                key_path.as_deref().unwrap_or_default()
            ),
            HostAuth::SshAgent { username } => format!("ssh_agent:{username}"),
        };

        format!(
            "{}:{}:{}:{}",
            host.address.trim(),
            host.port,
            host.updated_at,
            auth
        )
    }

    fn cached_session(&self, host: &HostConfig) -> Result<Option<Arc<Session>>, AppError> {
        let signature = Self::session_signature(host);
        let mut sessions = self
            .sessions
            .lock()
            .map_err(|_| AppError::internal("SSH session cache lock is poisoned"))?;

        let Some(cached) = sessions.get(&host.id) else {
            return Ok(None);
        };

        if cached.signature == signature {
            return Ok(Some(Arc::clone(&cached.session)));
        }

        sessions.remove(&host.id);
        Ok(None)
    }

    fn store_session(&self, host: &HostConfig, session: Arc<Session>) -> Result<(), AppError> {
        self.sessions
            .lock()
            .map_err(|_| AppError::internal("SSH session cache lock is poisoned"))?
            .insert(
                host.id.clone(),
                CachedSession {
                    signature: Self::session_signature(host),
                    session,
                },
            );
        Ok(())
    }

    fn drop_cached_session(&self, host_id: &str) -> Result<(), AppError> {
        self.sessions
            .lock()
            .map_err(|_| AppError::internal("SSH session cache lock is poisoned"))?
            .remove(host_id);
        Ok(())
    }

    async fn session_for(&self, host: &HostConfig) -> Result<Arc<Session>, AppError> {
        if let Some(session) = self.cached_session(host)? {
            return Ok(session);
        }

        let session = Arc::new(Self::connect(host, KnownHosts::Strict).await?);
        self.store_session(host, Arc::clone(&session))?;
        Ok(session)
    }

    #[cfg(test)]
    async fn session_for_with_known_hosts_file(
        host: &HostConfig,
        known_hosts_file: &Path,
    ) -> Result<Session, AppError> {
        Self::connect_with_known_hosts_file(host, KnownHosts::Strict, Some(known_hosts_file)).await
    }

    async fn accept_new_host_key(
        &self,
        host: &HostConfig,
        expected_fingerprint: &str,
    ) -> Result<String, AppError> {
        self.accept_new_host_key_with_known_hosts_file(host, expected_fingerprint, None)
            .await
    }

    async fn accept_new_host_key_with_known_hosts_file(
        &self,
        host: &HostConfig,
        expected_fingerprint: &str,
        known_hosts_file: Option<&Path>,
    ) -> Result<String, AppError> {
        let fingerprints = scan_host_key_fingerprints(host)?;
        validate_expected_fingerprint(&fingerprints, expected_fingerprint)?;

        let session =
            Self::connect_with_known_hosts_file(host, KnownHosts::Add, known_hosts_file).await?;
        drop(session);
        self.drop_cached_session(&host.id)?;
        Ok(expected_fingerprint.to_string())
    }

    async fn exec_program(
        session: &Session,
        program: &str,
        args: &[&str],
    ) -> Result<String, AppError> {
        let output = session
            .command(program)
            .args(args)
            .output()
            .await
            .map_err(map_openssh_command_error)?;

        output_to_string(output)
    }

    async fn exec_shell(session: &Session, script: &str) -> Result<String, AppError> {
        let output = session
            .shell(script)
            .output()
            .await
            .map_err(map_openssh_command_error)?;

        output_to_string(output)
    }

    async fn exec_remote_command(
        session: &Session,
        command: &RemoteCommand,
    ) -> Result<String, AppError> {
        match command {
            RemoteCommand::ProcStat => Self::exec_program(session, "cat", &["/proc/stat"]).await,
            RemoteCommand::ProcMeminfo => {
                Self::exec_program(session, "cat", &["/proc/meminfo"]).await
            }
            RemoteCommand::ProcLoadavg => {
                Self::exec_program(session, "cat", &["/proc/loadavg"]).await
            }
            RemoteCommand::ProcUptime => {
                Self::exec_program(session, "cat", &["/proc/uptime"]).await
            }
            RemoteCommand::ProcNetDev => {
                Self::exec_program(session, "cat", &["/proc/net/dev"]).await
            }
            RemoteCommand::ProcDiskstats => {
                Self::exec_program(session, "cat", &["/proc/diskstats"]).await
            }
            RemoteCommand::Df => Self::exec_program(session, "df", &["-P"]).await,
            RemoteCommand::Ps => {
                Self::exec_program(
                    session,
                    "ps",
                    &["-eo", "pid,ppid,user,stat,pcpu,pmem,rss,args"],
                )
                .await
            }
            RemoteCommand::Uname => Self::exec_program(session, "uname", &["-a"]).await,
            RemoteCommand::DockerContainerList => {
                Self::exec_program(
                    session,
                    "docker",
                    &[
                        "ps",
                        "-a",
                        "--format",
                        "{{.ID}}\t{{.Names}}\t{{.Image}}\t{{.State}}\t{{.Status}}",
                    ],
                )
                .await
            }
            RemoteCommand::DockerContainerLogs {
                container_id,
                tail_lines,
            } => {
                let tail_lines = tail_lines.to_string();
                Self::exec_program(
                    session,
                    "docker",
                    &["logs", "--tail", tail_lines.as_str(), container_id.as_str()],
                )
                .await
            }
            RemoteCommand::DockerContainerAction {
                container_id,
                action,
            } => match action {
                DockerContainerAction::Start => {
                    Self::exec_program(session, "docker", &["start", container_id.as_str()]).await
                }
                DockerContainerAction::Stop => {
                    Self::exec_program(session, "docker", &["stop", container_id.as_str()]).await
                }
                DockerContainerAction::Restart => {
                    Self::exec_program(session, "docker", &["restart", container_id.as_str()]).await
                }
                DockerContainerAction::Remove => {
                    Self::exec_program(session, "docker", &["rm", container_id.as_str()]).await
                }
                DockerContainerAction::ForceRemove => {
                    Self::exec_program(session, "docker", &["rm", "-f", container_id.as_str()])
                        .await
                }
            },
        }
    }

    async fn exec_with_reconnect(
        &self,
        host: &HostConfig,
        command: RemoteCommand,
    ) -> Result<String, AppError> {
        let session = self.session_for(host).await?;
        match Self::exec_remote_command(&session, &command).await {
            Ok(output) => Ok(output),
            Err(error) if should_retry_with_fresh_session(&error) => {
                self.drop_cached_session(&host.id)?;
                let session = self.session_for(host).await?;
                Self::exec_remote_command(&session, &command).await
            }
            Err(error) => Err(error),
        }
    }

    async fn collect_metrics_with_reconnect(
        &self,
        host: &HostConfig,
        mode: MetricsBatchMode,
    ) -> Result<RemoteMetricsOutput, AppError> {
        let session = self.session_for(host).await?;
        match Self::exec_metrics_batch(&session, mode).await {
            Ok(output) => Ok(output),
            Err(error) if should_retry_with_fresh_session(&error) => {
                self.drop_cached_session(&host.id)?;
                let session = self.session_for(host).await?;
                Self::exec_metrics_batch(&session, mode).await
            }
            Err(error) => Err(error),
        }
    }

    async fn exec_metrics_batch(
        session: &Session,
        mode: MetricsBatchMode,
    ) -> Result<RemoteMetricsOutput, AppError> {
        let script = match mode {
            MetricsBatchMode::Fast => FAST_METRICS_SCRIPT,
            MetricsBatchMode::Slow => SLOW_METRICS_SCRIPT,
            MetricsBatchMode::Process => PROCESS_METRICS_SCRIPT,
            MetricsBatchMode::Full => FULL_METRICS_SCRIPT,
        };

        parse_metrics_batch_output(&Self::exec_shell(session, script).await?, mode)
    }
}

#[async_trait]
impl SshClient for OpenSshClient {
    async fn test_connection(&self, host: &HostConfig) -> Result<ConnectionInfo, AppError> {
        let started = Instant::now();
        let session = self.session_for(host).await?;
        let hostname = Self::exec_program(&session, "hostname", &[])
            .await
            .map(|value| value.trim().to_string())?;
        let uname = Self::exec_program(&session, "uname", &["-srm"])
            .await
            .map(|value| value.trim().to_string())?;
        let os = Self::exec_program(&session, "cat", &["/etc/os-release"])
            .await
            .ok()
            .and_then(|value| parse_pretty_name(&value))
            .unwrap_or_else(|| uname.clone());

        Ok(ConnectionInfo {
            ok: true,
            latency_ms: started.elapsed().as_millis() as u64,
            hostname,
            os,
            kernel: Some(uname),
            fingerprint: None,
        })
    }

    async fn exec(&self, host: &HostConfig, command: RemoteCommand) -> Result<String, AppError> {
        self.exec_with_reconnect(host, command).await
    }

    async fn accept_host_key(
        &self,
        host: &HostConfig,
        expected_fingerprint: &str,
    ) -> Result<String, AppError> {
        self.accept_new_host_key(host, expected_fingerprint).await
    }

    fn disconnect_host(&self, host_id: &str) -> Result<(), AppError> {
        self.drop_cached_session(host_id)
    }

    async fn collect_metrics(
        &self,
        host: &HostConfig,
        mode: MetricsBatchMode,
    ) -> Result<RemoteMetricsOutput, AppError> {
        self.collect_metrics_with_reconnect(host, mode).await
    }
}

fn output_to_string(output: std::process::Output) -> Result<String, AppError> {
    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        return Err(
            AppError::new(AppErrorCode::RemoteCommandFailed, "Remote command failed").with_detail(
                if stderr.is_empty() {
                    format!("exitStatus={}", output.status)
                } else {
                    stderr
                },
            ),
        );
    }

    String::from_utf8(output.stdout).map_err(|err| {
        AppError::new(
            AppErrorCode::ParserFailed,
            "Remote output was not valid UTF-8",
        )
        .with_detail(err.to_string())
    })
}

fn should_retry_with_fresh_session(error: &AppError) -> bool {
    error.code == AppErrorCode::SshConnectFailed.as_str()
}

fn scan_host_key_fingerprints(host: &HostConfig) -> Result<Vec<HostKeyFingerprint>, AppError> {
    let target = resolve_keyscan_target(host)?;
    let keyscan = Command::new("/usr/bin/ssh-keyscan")
        .arg("-T")
        .arg("8")
        .arg("-p")
        .arg(target.port.to_string())
        .arg(&target.hostname)
        .output()
        .map_err(|err| {
            AppError::new(
                AppErrorCode::SshHostKeyUnknown,
                "Failed to run ssh-keyscan for host key fingerprint",
            )
            .with_detail(err.to_string())
        })?;

    if !keyscan.status.success() || keyscan.stdout.is_empty() {
        return Err(AppError::new(
            AppErrorCode::SshHostKeyUnknown,
            "Failed to scan SSH host key fingerprint",
        )
        .with_detail(String::from_utf8_lossy(&keyscan.stderr).trim().to_string()));
    }

    fingerprints_from_known_host_entry(&keyscan.stdout)
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct HostKeyFingerprint {
    algorithm: Option<String>,
    fingerprint: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct KeyscanTarget {
    hostname: String,
    port: u16,
}

fn resolve_keyscan_target(host: &HostConfig) -> Result<KeyscanTarget, AppError> {
    let address = host.address.trim();
    if address.is_empty() {
        return Err(AppError::config_invalid("Host address is required"));
    }
    if address.starts_with('-') {
        return Err(AppError::config_invalid("Host address is invalid"));
    }

    let output = Command::new("/usr/bin/ssh")
        .arg("-G")
        .arg("-p")
        .arg(host.port.to_string())
        .arg("--")
        .arg(address)
        .output();

    let Ok(output) = output else {
        return Ok(KeyscanTarget {
            hostname: address.to_string(),
            port: host.port,
        });
    };

    if !output.status.success() {
        return Ok(KeyscanTarget {
            hostname: address.to_string(),
            port: host.port,
        });
    }

    let config = String::from_utf8_lossy(&output.stdout);
    let hostname = ssh_config_value(&config, "hostname")
        .filter(|value| !value.trim().is_empty())
        .unwrap_or(address)
        .to_string();
    let port = ssh_config_value(&config, "port")
        .and_then(|value| value.parse::<u16>().ok())
        .unwrap_or(host.port);
    if hostname.trim().is_empty() || hostname.starts_with('-') {
        return Err(AppError::config_invalid("Resolved host address is invalid"));
    }

    Ok(KeyscanTarget { hostname, port })
}

fn ssh_config_value<'a>(config: &'a str, key: &str) -> Option<&'a str> {
    config.lines().find_map(|line| {
        let mut parts = line.split_whitespace();
        let candidate_key = parts.next()?;
        let value = parts.next()?;
        (candidate_key.eq_ignore_ascii_case(key)).then_some(value.trim())
    })
}

fn fingerprints_from_known_host_entry(input: &[u8]) -> Result<Vec<HostKeyFingerprint>, AppError> {
    let mut child = Command::new("/usr/bin/ssh-keygen")
        .arg("-l")
        .arg("-E")
        .arg("sha256")
        .arg("-f")
        .arg("-")
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|err| {
            AppError::new(
                AppErrorCode::SshHostKeyUnknown,
                "Failed to run ssh-keygen for host key fingerprint",
            )
            .with_detail(err.to_string())
        })?;

    if let Some(mut stdin) = child.stdin.take() {
        stdin.write_all(input).map_err(|err| {
            AppError::new(
                AppErrorCode::SshHostKeyUnknown,
                "Failed to pass host key to ssh-keygen",
            )
            .with_detail(err.to_string())
        })?;
    }

    let output = child.wait_with_output().map_err(|err| {
        AppError::new(
            AppErrorCode::SshHostKeyUnknown,
            "Failed to read ssh-keygen host key fingerprint",
        )
        .with_detail(err.to_string())
    })?;

    if !output.status.success() {
        return Err(AppError::new(
            AppErrorCode::SshHostKeyUnknown,
            "Failed to parse SSH host key fingerprint",
        )
        .with_detail(String::from_utf8_lossy(&output.stderr).trim().to_string()));
    }

    let fingerprints = parse_ssh_keygen_fingerprints(&String::from_utf8_lossy(&output.stdout));
    if fingerprints.is_empty() {
        return Err(AppError::new(
            AppErrorCode::SshHostKeyUnknown,
            "ssh-keygen did not return a SHA256 host key fingerprint",
        ));
    }

    Ok(fingerprints)
}

fn parse_ssh_keygen_fingerprints(output: &str) -> Vec<HostKeyFingerprint> {
    output
        .lines()
        .filter_map(|line| {
            let fingerprint = line
                .split_whitespace()
                .find(|part| part.starts_with("SHA256:"))?
                .to_string();
            let algorithm = line
                .rsplit_once('(')
                .and_then(|(_, value)| value.strip_suffix(')'))
                .map(|value| value.to_ascii_lowercase());

            Some(HostKeyFingerprint {
                algorithm,
                fingerprint,
            })
        })
        .collect()
}

fn preferred_host_key_fingerprint(fingerprints: &[HostKeyFingerprint]) -> Result<String, AppError> {
    ["ed25519", "ecdsa", "rsa"]
        .iter()
        .find_map(|preferred| {
            fingerprints
                .iter()
                .find(|key| {
                    key.algorithm
                        .as_deref()
                        .map(|algorithm| algorithm.contains(preferred))
                        .unwrap_or(false)
                })
                .map(|key| key.fingerprint.clone())
        })
        .or_else(|| fingerprints.first().map(|key| key.fingerprint.clone()))
        .ok_or_else(|| {
            AppError::new(
                AppErrorCode::SshHostKeyUnknown,
                "ssh-keygen did not return a SHA256 host key fingerprint",
            )
        })
}

fn validate_expected_fingerprint(
    scanned: &[HostKeyFingerprint],
    expected: &str,
) -> Result<(), AppError> {
    if scanned.iter().any(|key| key.fingerprint == expected) {
        return Ok(());
    }

    let scanned_fingerprint =
        preferred_host_key_fingerprint(scanned).unwrap_or_else(|_| "SHA256:unknown".to_string());

    Err(AppError::new(
        AppErrorCode::SshHostKeyChanged,
        "SSH host key fingerprint changed before confirmation",
    )
    .with_fingerprint(scanned_fingerprint))
}

const FAST_METRICS_SCRIPT: &str = r#"
set -e
section() { printf '\n__VPSCOPE_SECTION:%s__\n' "$1"; }
section loadavg
cat /proc/loadavg
section uptime
cat /proc/uptime
section proc_stat
cat /proc/stat
section meminfo
cat /proc/meminfo
section net_dev
cat /proc/net/dev
section diskstats
cat /proc/diskstats
"#;

const SLOW_METRICS_SCRIPT: &str = r#"
set -e
section() { printf '\n__VPSCOPE_SECTION:%s__\n' "$1"; }
section uname
uname -a
section loadavg
cat /proc/loadavg
section uptime
cat /proc/uptime
section proc_stat
cat /proc/stat
section meminfo
cat /proc/meminfo
section df
df -P
section net_dev
cat /proc/net/dev
section diskstats
cat /proc/diskstats
"#;

const PROCESS_METRICS_SCRIPT: &str = r#"
set -e
section() { printf '\n__VPSCOPE_SECTION:%s__\n' "$1"; }
section loadavg
cat /proc/loadavg
section uptime
cat /proc/uptime
section proc_stat
cat /proc/stat
section meminfo
cat /proc/meminfo
section net_dev
cat /proc/net/dev
section diskstats
cat /proc/diskstats
section ps
ps -eo pid,ppid,user,stat,pcpu,pmem,rss,args
"#;

const FULL_METRICS_SCRIPT: &str = r#"
set -e
section() { printf '\n__VPSCOPE_SECTION:%s__\n' "$1"; }
section uname
uname -a
section loadavg
cat /proc/loadavg
section uptime
cat /proc/uptime
section proc_stat
cat /proc/stat
section meminfo
cat /proc/meminfo
section df
df -P
section net_dev
cat /proc/net/dev
section diskstats
cat /proc/diskstats
section ps
ps -eo pid,ppid,user,stat,pcpu,pmem,rss,args
"#;

fn parse_metrics_batch_output(
    input: &str,
    mode: MetricsBatchMode,
) -> Result<RemoteMetricsOutput, AppError> {
    let sections = split_metrics_sections(input);

    Ok(RemoteMetricsOutput {
        uname: optional_section(&sections, "uname", mode)?,
        loadavg: required_section(&sections, "loadavg")?,
        uptime: required_section(&sections, "uptime")?,
        proc_stat: required_section(&sections, "proc_stat")?,
        meminfo: required_section(&sections, "meminfo")?,
        df: optional_section(&sections, "df", mode)?,
        net_dev: required_section(&sections, "net_dev")?,
        diskstats: required_section(&sections, "diskstats")?,
        ps: optional_process_section(&sections, "ps", mode)?,
    })
}

fn split_metrics_sections(input: &str) -> HashMap<String, String> {
    let mut sections = HashMap::new();
    let mut current = None::<String>;

    for line in input.lines() {
        if let Some(section) = parse_section_marker(line.trim()) {
            sections.entry(section.clone()).or_insert_with(String::new);
            current = Some(section);
            continue;
        }

        let Some(section) = current.as_ref() else {
            continue;
        };
        if let Some(value) = sections.get_mut(section) {
            value.push_str(line);
            value.push('\n');
        }
    }

    sections
}

fn parse_section_marker(line: &str) -> Option<String> {
    line.strip_prefix("__VPSCOPE_SECTION:")
        .and_then(|value| value.strip_suffix("__"))
        .map(str::to_string)
}

fn required_section(
    sections: &HashMap<String, String>,
    name: &'static str,
) -> Result<String, AppError> {
    sections
        .get(name)
        .map(|value| value.trim_end_matches('\n').to_string())
        .filter(|value| !value.trim().is_empty())
        .ok_or_else(|| {
            AppError::new(
                AppErrorCode::ParserFailed,
                format!("Metrics batch is missing {name}"),
            )
        })
}

fn optional_section(
    sections: &HashMap<String, String>,
    name: &'static str,
    mode: MetricsBatchMode,
) -> Result<Option<String>, AppError> {
    if mode.includes_slow_metrics() {
        return required_section(sections, name).map(Some);
    }

    Ok(None)
}

fn optional_process_section(
    sections: &HashMap<String, String>,
    name: &'static str,
    mode: MetricsBatchMode,
) -> Result<Option<String>, AppError> {
    if mode.includes_process_metrics() {
        return required_section(sections, name).map(Some);
    }

    Ok(None)
}

fn map_openssh_connect_error(error: openssh::Error) -> AppError {
    match &error {
        openssh::Error::Connect(io) | openssh::Error::Master(io) => {
            map_ssh_io_error(io, "SSH connection failed")
        }
        openssh::Error::Ssh(io) => AppError::new(
            AppErrorCode::SshConnectFailed,
            "Local ssh command could not be executed",
        )
        .with_detail(io.to_string()),
        _ => AppError::new(AppErrorCode::SshConnectFailed, "SSH connection failed")
            .with_detail(error.to_string()),
    }
}

fn map_ssh_io_error(error: &std::io::Error, fallback_message: &'static str) -> AppError {
    let detail = error.to_string();
    let detail_lower = detail.to_lowercase();

    if detail_lower.contains("remote host identification has changed")
        || detail_lower.contains("offending key")
    {
        return AppError::new(AppErrorCode::SshHostKeyChanged, "SSH host key changed")
            .with_detail(detail);
    }

    if detail_lower.contains("no host key is known")
        || detail_lower.contains("host key is known")
        || detail_lower.contains("host key verification failed")
        || detail_lower.contains("authenticity of host")
        || detail_lower.contains("strict host key checking")
    {
        return AppError::new(AppErrorCode::SshHostKeyUnknown, "SSH host key is unknown")
            .with_detail(detail);
    }

    let code = match error.kind() {
        ErrorKind::PermissionDenied => AppErrorCode::SshAuthFailed,
        _ => AppErrorCode::SshConnectFailed,
    };
    AppError::new(code, fallback_message).with_detail(detail)
}

fn map_openssh_command_error(error: openssh::Error) -> AppError {
    match &error {
        openssh::Error::Remote(io) => AppError::new(
            AppErrorCode::RemoteCommandFailed,
            "Remote command could not be executed",
        )
        .with_detail(io.to_string()),
        openssh::Error::Disconnected | openssh::Error::RemoteProcessTerminated => AppError::new(
            AppErrorCode::SshConnectFailed,
            "SSH connection was interrupted",
        )
        .with_detail(error.to_string()),
        _ => AppError::new(AppErrorCode::RemoteCommandFailed, "Remote command failed")
            .with_detail(error.to_string()),
    }
}

fn parse_pretty_name(input: &str) -> Option<String> {
    input.lines().find_map(|line| {
        let value = line.strip_prefix("PRETTY_NAME=")?;
        Some(value.trim_matches('"').to_string())
    })
}

pub type DynSshClient = Arc<dyn SshClient>;

#[cfg(test)]
mod tests {
    use super::*;
    use std::{env, fs, io, path::Path};

    static REAL_SSH_ENV_LOCK: Mutex<()> = Mutex::new(());

    #[test]
    fn parses_full_metrics_batch_sections() {
        let output = parse_metrics_batch_output(
            r#"
__VPSCOPE_SECTION:uname__
Linux vps 6.8.0-71-generic x86_64
__VPSCOPE_SECTION:loadavg__
0.12 0.34 0.56 1/234 5678
__VPSCOPE_SECTION:uptime__
12345.67 8910.11
__VPSCOPE_SECTION:proc_stat__
cpu  1 2 3 4
__VPSCOPE_SECTION:meminfo__
MemTotal: 1000 kB
__VPSCOPE_SECTION:df__
Filesystem 1024-blocks Used Available Capacity Mounted on
/dev/vda1 1000 100 900 10% /
__VPSCOPE_SECTION:net_dev__
Inter-| Receive | Transmit
eth0: 1 0 0 0 0 0 0 0 2 0 0 0 0 0 0 0
__VPSCOPE_SECTION:diskstats__
253 0 vda 0 0 1 0 0 0 2 0 0 0 0
__VPSCOPE_SECTION:ps__
PID PPID USER STAT %CPU %MEM RSS COMMAND
1 0 root S 0.0 0.1 100 init
"#,
            MetricsBatchMode::Full,
        )
        .unwrap();

        assert!(output.uname.unwrap().contains("6.8.0"));
        assert!(output.df.unwrap().contains("/dev/vda1"));
        assert!(output.ps.unwrap().contains("PID PPID"));
        assert!(output.net_dev.contains("eth0"));
    }

    #[test]
    fn parses_fast_metrics_batch_without_slow_sections() {
        let output = parse_metrics_batch_output(
            r#"
__VPSCOPE_SECTION:loadavg__
0.12 0.34 0.56 1/234 5678
__VPSCOPE_SECTION:uptime__
12345.67 8910.11
__VPSCOPE_SECTION:proc_stat__
cpu  1 2 3 4
__VPSCOPE_SECTION:meminfo__
MemTotal: 1000 kB
__VPSCOPE_SECTION:net_dev__
Inter-| Receive | Transmit
eth0: 1 0 0 0 0 0 0 0 2 0 0 0 0 0 0 0
__VPSCOPE_SECTION:diskstats__
253 0 vda 0 0 1 0 0 0 2 0 0 0 0
"#,
            MetricsBatchMode::Fast,
        )
        .unwrap();

        assert!(output.uname.is_none());
        assert!(output.df.is_none());
        assert!(output.ps.is_none());
        assert!(output.diskstats.contains("vda"));
    }

    #[test]
    fn maps_unknown_host_key_error() {
        let error = map_ssh_io_error(
            &io::Error::new(
                io::ErrorKind::Other,
                "No ED25519 host key is known for example.com and you have requested strict checking.",
            ),
            "SSH connection failed",
        );

        assert_eq!(error.code, "SSH_HOST_KEY_UNKNOWN");
    }

    #[test]
    fn maps_changed_host_key_error() {
        let error = map_ssh_io_error(
            &io::Error::new(
                io::ErrorKind::Other,
                "WARNING: REMOTE HOST IDENTIFICATION HAS CHANGED! Offending key in /Users/me/.ssh/known_hosts:4",
            ),
            "SSH connection failed",
        );

        assert_eq!(error.code, "SSH_HOST_KEY_CHANGED");
    }

    #[test]
    fn parses_sha256_fingerprints_from_ssh_keygen_output() {
        assert_eq!(
            parse_ssh_keygen_fingerprints(
                "256 SHA256:abc123 host.example.com (ED25519)\n\
                 256 SHA256:def456 host.example.com (ECDSA)\n"
            ),
            vec![
                HostKeyFingerprint {
                    algorithm: Some("ed25519".to_string()),
                    fingerprint: "SHA256:abc123".to_string(),
                },
                HostKeyFingerprint {
                    algorithm: Some("ecdsa".to_string()),
                    fingerprint: "SHA256:def456".to_string(),
                },
            ]
        );
    }

    #[test]
    fn rejects_host_key_confirmation_when_fingerprint_changes() {
        let error = validate_expected_fingerprint(
            &[HostKeyFingerprint {
                algorithm: Some("ed25519".to_string()),
                fingerprint: "SHA256:new".to_string(),
            }],
            "SHA256:old",
        )
        .expect_err("changed fingerprint must fail");

        assert_eq!(error.code, "SSH_HOST_KEY_CHANGED");
        assert_eq!(error.fingerprint.as_deref(), Some("SHA256:new"));
    }

    #[test]
    fn accepts_host_key_confirmation_when_expected_fingerprint_is_in_any_scanned_key() {
        let reordered_scan = vec![
            HostKeyFingerprint {
                algorithm: Some("rsa".to_string()),
                fingerprint: "SHA256:rsa".to_string(),
            },
            HostKeyFingerprint {
                algorithm: Some("ed25519".to_string()),
                fingerprint: "SHA256:ed25519".to_string(),
            },
            HostKeyFingerprint {
                algorithm: Some("ecdsa".to_string()),
                fingerprint: "SHA256:ecdsa".to_string(),
            },
        ];

        validate_expected_fingerprint(&reordered_scan, "SHA256:ed25519")
            .expect("matching fingerprint must be accepted regardless of scan order");
    }

    #[test]
    fn prefers_stable_host_key_algorithm_for_display() {
        let fingerprints = vec![
            HostKeyFingerprint {
                algorithm: Some("rsa".to_string()),
                fingerprint: "SHA256:rsa".to_string(),
            },
            HostKeyFingerprint {
                algorithm: Some("ecdsa".to_string()),
                fingerprint: "SHA256:ecdsa".to_string(),
            },
            HostKeyFingerprint {
                algorithm: Some("ed25519".to_string()),
                fingerprint: "SHA256:ed25519".to_string(),
            },
        ];

        assert_eq!(
            preferred_host_key_fingerprint(&fingerprints).unwrap(),
            "SHA256:ed25519"
        );
    }

    #[tokio::test]
    async fn openssh_client_can_connect_to_configured_host_when_enabled() {
        let Some(host) = real_ssh_host_config("ssh-test") else {
            return;
        };

        let client = OpenSshClient::new();
        let connection = client.test_connection(&host).await.unwrap();
        assert!(connection.ok);
        assert!(!connection.hostname.is_empty());

        let loadavg = client
            .exec(&host, RemoteCommand::ProcLoadavg)
            .await
            .unwrap();
        assert!(loadavg.split_whitespace().count() >= 3);
    }

    #[tokio::test(flavor = "current_thread")]
    async fn validates_real_known_hosts_flow_when_enabled() {
        if env::var("VPSCOPE_TEST_KNOWN_HOSTS_FLOW").as_deref() != Ok("1") {
            return;
        }
        let _lock = REAL_SSH_ENV_LOCK.lock().expect("real SSH env lock");
        let Some(host) = real_ssh_host_config("known-hosts-flow") else {
            return;
        };
        let ssh_dir = make_temp_dir("vpscope-known-hosts-flow");
        fs::create_dir_all(&ssh_dir).expect("create temporary .ssh");
        set_private_dir_permissions(&ssh_dir);
        let known_hosts = ssh_dir.join("known_hosts");

        let client = OpenSshClient::new();
        let unknown = OpenSshClient::session_for_with_known_hosts_file(&host, &known_hosts)
            .await
            .expect_err("empty known_hosts must report an unknown host key");
        assert_eq!(unknown.code, "SSH_HOST_KEY_UNKNOWN");
        let fingerprint = unknown
            .fingerprint
            .as_deref()
            .expect("unknown host key error must include a fingerprint");
        assert!(fingerprint.starts_with("SHA256:"));

        let accepted = client
            .accept_new_host_key_with_known_hosts_file(&host, fingerprint, Some(&known_hosts))
            .await
            .expect("matching fingerprint must be accepted");
        assert_eq!(accepted, fingerprint);
        assert!(
            known_hosts.exists(),
            "accepting a host key must write OpenSSH known_hosts"
        );

        let known_connection =
            OpenSshClient::session_for_with_known_hosts_file(&host, &known_hosts)
                .await
                .expect("matching known_hosts entry must connect");
        drop(known_connection);

        write_changed_known_host(&known_hosts);
        let changed = OpenSshClient::session_for_with_known_hosts_file(&host, &known_hosts)
            .await
            .expect_err("mismatched known_hosts entry must block connection");
        assert_eq!(changed.code, "SSH_HOST_KEY_CHANGED");
    }

    fn real_ssh_host_config(id: &str) -> Option<HostConfig> {
        let Ok(address) = env::var("VPSCOPE_TEST_SSH_HOST") else {
            return None;
        };
        let username = env::var("VPSCOPE_TEST_SSH_USER").unwrap_or_else(|_| "ubuntu".to_string());
        let port = env::var("VPSCOPE_TEST_SSH_PORT")
            .ok()
            .and_then(|value| value.parse::<u16>().ok())
            .unwrap_or(22);
        let auth = match env::var("VPSCOPE_TEST_SSH_KEY_PATH") {
            Ok(key_path) if !key_path.trim().is_empty() => HostAuth::PrivateKey {
                username,
                key_path: Some(key_path),
            },
            _ => HostAuth::SshAgent { username },
        };

        Some(HostConfig {
            id: id.to_string(),
            name: address.clone(),
            address,
            port,
            auth,
            refresh_interval_ms: 2_000,
            tags: Vec::new(),
            created_at: 0,
            updated_at: 0,
        })
    }

    fn make_temp_dir(prefix: &str) -> std::path::PathBuf {
        let path = env::temp_dir().join(format!("{prefix}-{}", uuid::Uuid::new_v4()));
        fs::create_dir_all(&path).expect("create temporary directory");
        set_private_dir_permissions(&path);
        path
    }

    fn write_changed_known_host(known_hosts: &Path) {
        let fake_key = known_hosts
            .parent()
            .expect("known_hosts parent")
            .join("wrong_host_key");
        let output = Command::new("/usr/bin/ssh-keygen")
            .arg("-q")
            .arg("-t")
            .arg("ed25519")
            .arg("-N")
            .arg("")
            .arg("-f")
            .arg(&fake_key)
            .output()
            .expect("run ssh-keygen for changed host key fixture");
        assert!(
            output.status.success(),
            "ssh-keygen must generate changed host key fixture: {}",
            String::from_utf8_lossy(&output.stderr)
        );

        let public_key =
            fs::read_to_string(fake_key.with_extension("pub")).expect("read public key");
        let mut parts = public_key.split_whitespace();
        let key_type = parts.next().expect("public key type");
        let key_data = parts.next().expect("public key data");
        let existing_entry = fs::read_to_string(known_hosts).expect("read existing known_hosts");
        let host_pattern = existing_entry
            .lines()
            .find_map(|line| {
                let trimmed = line.trim();
                if trimmed.is_empty() || trimmed.starts_with('#') {
                    return None;
                }
                trimmed.split_whitespace().next().map(str::to_string)
            })
            .expect("existing known_hosts host pattern");
        fs::write(
            known_hosts,
            format!("{host_pattern} {key_type} {key_data}\n"),
        )
        .expect("write changed known_hosts entry");
        set_private_file_permissions(known_hosts);
    }

    #[cfg(unix)]
    fn set_private_dir_permissions(path: &Path) {
        use std::os::unix::fs::PermissionsExt;
        fs::set_permissions(path, fs::Permissions::from_mode(0o700))
            .expect("set private directory permissions");
    }

    #[cfg(not(unix))]
    fn set_private_dir_permissions(_path: &Path) {}

    #[cfg(unix)]
    fn set_private_file_permissions(path: &Path) {
        use std::os::unix::fs::PermissionsExt;
        fs::set_permissions(path, fs::Permissions::from_mode(0o600))
            .expect("set private file permissions");
    }

    #[cfg(not(unix))]
    fn set_private_file_permissions(_path: &Path) {}
}
