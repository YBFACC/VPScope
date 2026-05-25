use crate::{
    config::HostConfig,
    errors::AppError,
    metrics::snapshot::{
        CpuCore, CpuInfo, DiskInfo, HostSnapshot, MemoryInfo, NetworkInfo, ProcessInfo, SystemInfo,
    },
    parsers::{
        cpu::{parse_proc_stat, CpuSample},
        disk::{parse_df_p, parse_diskstats, DiskIoCounters},
        memory::parse_meminfo,
        network::parse_proc_net_dev,
        process::parse_ps_output,
        system::{parse_loadavg, parse_uptime_sec},
    },
    ssh::{DynSshClient, MetricsBatchMode, RemoteMetricsOutput},
};
use std::collections::HashMap;

const SLOW_METRICS_REFRESH_MS: u64 = 5_000;

#[derive(Debug, Default)]
struct PreviousCounters {
    ts: u64,
    cpu_samples: Vec<CpuSample>,
    network: Vec<NetworkInfo>,
    disk_io: Vec<DiskIoCounters>,
}

#[derive(Debug, Clone)]
struct CachedSlowMetrics {
    ts: u64,
    os: String,
    kernel: Option<String>,
    arch: Option<String>,
    disks: Vec<DiskInfo>,
    processes: Vec<ProcessInfo>,
}

#[derive(Debug, Default)]
pub struct MetricsCollector {
    previous: Option<PreviousCounters>,
    slow: Option<CachedSlowMetrics>,
}

impl MetricsCollector {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn warming_snapshot(host: &HostConfig, ts: u64) -> HostSnapshot {
        HostSnapshot {
            host_id: host.id.clone(),
            ts,
            system: SystemInfo {
                hostname: host.name.clone(),
                os: "warming".to_string(),
                kernel: None,
                arch: None,
                uptime_sec: 0,
                load_avg: [0.0, 0.0, 0.0],
            },
            cpu: CpuInfo {
                total_percent: 0.0,
                cores: Vec::new(),
            },
            memory: MemoryInfo {
                total_bytes: 0,
                used_bytes: 0,
                available_bytes: 0,
                cached_bytes: 0,
                swap_total_bytes: 0,
                swap_used_bytes: 0,
            },
            disks: Vec::new(),
            network: Vec::new(),
            processes: Vec::new(),
        }
    }

    pub async fn collect_once(
        host: &HostConfig,
        ssh: DynSshClient,
        ts: u64,
    ) -> Result<HostSnapshot, AppError> {
        let mut collector = Self::new();
        collector.collect(host, ssh, ts).await
    }

    pub async fn collect(
        &mut self,
        host: &HostConfig,
        ssh: DynSshClient,
        ts: u64,
    ) -> Result<HostSnapshot, AppError> {
        let mode = if self.needs_slow_refresh(ts) {
            MetricsBatchMode::Full
        } else {
            MetricsBatchMode::Fast
        };
        let output = ssh.collect_metrics(host, mode).await?;
        if mode == MetricsBatchMode::Full {
            self.update_slow_metrics(&output, ts)?;
        }

        let cpu_samples = parse_proc_stat(&output.proc_stat);
        let network = parse_proc_net_dev(&output.net_dev)?;
        let disk_io = parse_diskstats(&output.diskstats)?;
        let previous = self.previous.as_ref();
        let cores = cpu_samples
            .iter()
            .filter(|sample| sample.id != "cpu")
            .map(|sample| CpuCore {
                id: sample.id.clone(),
                percent: cpu_sample_percent(sample, previous),
            })
            .collect::<Vec<_>>();
        let total_percent = cpu_samples
            .iter()
            .find(|sample| sample.id == "cpu")
            .map(|sample| cpu_sample_percent(sample, previous))
            .unwrap_or(0.0);
        let network = network_rates(network, previous, ts);
        let slow = self.slow.as_ref().ok_or_else(|| {
            AppError::internal("Slow metrics cache is empty after full metrics refresh")
        })?;
        let disks = disk_rates(slow.disks.clone(), &disk_io, previous, ts);

        let snapshot = HostSnapshot {
            host_id: host.id.clone(),
            ts,
            system: SystemInfo {
                hostname: host.name.clone(),
                os: slow.os.clone(),
                kernel: slow.kernel.clone(),
                arch: slow.arch.clone(),
                uptime_sec: parse_uptime_sec(&output.uptime)?,
                load_avg: parse_loadavg(&output.loadavg)?,
            },
            cpu: CpuInfo {
                total_percent,
                cores,
            },
            memory: parse_meminfo(&output.meminfo)?,
            disks,
            network,
            processes: slow.processes.clone(),
        };

        self.previous = Some(PreviousCounters {
            ts,
            cpu_samples,
            network: snapshot.network.clone(),
            disk_io,
        });

        Ok(snapshot)
    }

    fn needs_slow_refresh(&self, ts: u64) -> bool {
        self.slow
            .as_ref()
            .map(|slow| ts.saturating_sub(slow.ts) >= SLOW_METRICS_REFRESH_MS)
            .unwrap_or(true)
    }

    fn update_slow_metrics(
        &mut self,
        output: &RemoteMetricsOutput,
        ts: u64,
    ) -> Result<(), AppError> {
        let uname = output
            .uname
            .as_deref()
            .ok_or_else(|| AppError::internal("Full metrics batch did not include uname output"))?;
        let df = output
            .df
            .as_deref()
            .ok_or_else(|| AppError::internal("Full metrics batch did not include df output"))?;
        let ps = output
            .ps
            .as_deref()
            .ok_or_else(|| AppError::internal("Full metrics batch did not include ps output"))?;
        let (os, kernel, arch) = parse_uname_parts(uname);

        self.slow = Some(CachedSlowMetrics {
            ts,
            os,
            kernel,
            arch,
            disks: parse_df_p(df)?,
            processes: parse_ps_output(ps)?,
        });

        Ok(())
    }
}

fn parse_uname_parts(uname: &str) -> (String, Option<String>, Option<String>) {
    let uname_parts = uname.split_whitespace().collect::<Vec<_>>();
    let os = uname_parts.first().copied().unwrap_or("Linux").to_string();
    let kernel = uname_parts.get(2).map(|value| (*value).to_string());
    let arch = uname_parts.last().map(|value| (*value).to_string());

    (os, kernel, arch)
}

fn cpu_sample_percent(sample: &CpuSample, previous: Option<&PreviousCounters>) -> f64 {
    let Some(previous_sample) = previous.and_then(|previous| {
        previous
            .cpu_samples
            .iter()
            .find(|candidate| candidate.id == sample.id)
    }) else {
        return 0.0;
    };

    let total_delta = sample.total.saturating_sub(previous_sample.total);
    if total_delta == 0 {
        return 0.0;
    }

    let busy = sample.total.saturating_sub(sample.idle);
    let previous_busy = previous_sample.total.saturating_sub(previous_sample.idle);
    let busy_delta = busy.saturating_sub(previous_busy);

    (busy_delta as f64 / total_delta as f64 * 100.0).clamp(0.0, 100.0)
}

fn network_rates(
    mut current: Vec<NetworkInfo>,
    previous: Option<&PreviousCounters>,
    ts: u64,
) -> Vec<NetworkInfo> {
    let Some(previous) = previous else {
        return current;
    };

    let elapsed_sec = ts.saturating_sub(previous.ts) as f64 / 1_000.0;
    if elapsed_sec <= 0.0 {
        return current;
    }

    let previous_by_iface = previous
        .network
        .iter()
        .map(|iface| (iface.iface.as_str(), iface))
        .collect::<HashMap<_, _>>();

    for iface in &mut current {
        if let Some(previous_iface) = previous_by_iface.get(iface.iface.as_str()) {
            iface.rx_bytes_per_sec = counter_rate(
                iface.rx_total_bytes,
                previous_iface.rx_total_bytes,
                elapsed_sec,
            );
            iface.tx_bytes_per_sec = counter_rate(
                iface.tx_total_bytes,
                previous_iface.tx_total_bytes,
                elapsed_sec,
            );
        }
    }

    current
}

fn disk_rates(
    mut disks: Vec<DiskInfo>,
    current: &[DiskIoCounters],
    previous: Option<&PreviousCounters>,
    ts: u64,
) -> Vec<DiskInfo> {
    let Some(previous) = previous else {
        return disks;
    };

    let elapsed_sec = ts.saturating_sub(previous.ts) as f64 / 1_000.0;
    if elapsed_sec <= 0.0 {
        return disks;
    }

    let current_by_device = current
        .iter()
        .map(|disk| (disk.device.as_str(), disk))
        .collect::<HashMap<_, _>>();
    let previous_by_device = previous
        .disk_io
        .iter()
        .map(|disk| (disk.device.as_str(), disk))
        .collect::<HashMap<_, _>>();

    for disk in &mut disks {
        let Some(device) = disk_device_name(&disk.fs) else {
            continue;
        };
        let (Some(current), Some(previous)) = (
            current_by_device.get(device),
            previous_by_device.get(device),
        ) else {
            continue;
        };

        disk.read_bytes_per_sec = Some(counter_rate(
            current.read_bytes,
            previous.read_bytes,
            elapsed_sec,
        ));
        disk.write_bytes_per_sec = Some(counter_rate(
            current.write_bytes,
            previous.write_bytes,
            elapsed_sec,
        ));
    }

    disks
}

fn disk_device_name(fs: &str) -> Option<&str> {
    fs.strip_prefix("/dev/")
        .and_then(|device| device.rsplit('/').next())
        .filter(|device| !device.is_empty())
}

fn counter_rate(current: u64, previous: u64, elapsed_sec: f64) -> f64 {
    if current < previous {
        return 0.0;
    }

    (current - previous) as f64 / elapsed_sec
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{
        config::HostAuth,
        ssh::{client::OpenSshClient, ConnectionInfo, DynSshClient, RemoteCommand, SshClient},
    };
    use async_trait::async_trait;
    use std::sync::{Arc, Mutex};

    #[derive(Debug, Default)]
    struct RecordingSshClient {
        modes: Mutex<Vec<MetricsBatchMode>>,
        calls: Mutex<u64>,
    }

    #[async_trait]
    impl SshClient for RecordingSshClient {
        async fn test_connection(&self, _host: &HostConfig) -> Result<ConnectionInfo, AppError> {
            unimplemented!("collector tests only exercise metrics collection")
        }

        async fn exec(
            &self,
            _host: &HostConfig,
            _command: RemoteCommand,
        ) -> Result<String, AppError> {
            unimplemented!("collector tests only exercise metrics collection")
        }

        async fn collect_metrics(
            &self,
            _host: &HostConfig,
            mode: MetricsBatchMode,
        ) -> Result<RemoteMetricsOutput, AppError> {
            self.modes.lock().unwrap().push(mode);
            let mut calls = self.calls.lock().unwrap();
            *calls += 1;
            Ok(test_metrics_output(mode, *calls))
        }
    }

    fn test_metrics_output(mode: MetricsBatchMode, call: u64) -> RemoteMetricsOutput {
        RemoteMetricsOutput {
            uname: (mode == MetricsBatchMode::Full)
                .then(|| "Linux vps 6.8.0-71-generic x86_64".to_string()),
            loadavg: "0.10 0.20 0.30 1/2 3".to_string(),
            uptime: "100.0 0.0".to_string(),
            proc_stat: format!(
                "cpu  {} 0 0 {}\ncpu0 {} 0 0 {}\n",
                call * 10,
                100 - call,
                call * 10,
                100 - call
            ),
            meminfo: "MemTotal: 1000 kB\nMemAvailable: 400 kB\nCached: 100 kB\nSwapTotal: 0 kB\nSwapFree: 0 kB\n".to_string(),
            df: (mode == MetricsBatchMode::Full).then(|| {
                "Filesystem 1024-blocks Used Available Capacity Mounted on\n/dev/vda1 1000 200 800 20% /\n".to_string()
            }),
            net_dev: format!(
                "Inter-| Receive | Transmit\neth0: {} 0 0 0 0 0 0 0 {} 0 0 0 0 0 0 0\n",
                call * 1_000,
                call * 2_000
            ),
            diskstats: format!(
                "253 0 vda1 0 0 {} 0 0 0 {} 0 0 0 0\n",
                call * 2,
                call * 4
            ),
            ps: (mode == MetricsBatchMode::Full).then(|| {
                "PID PPID USER STAT %CPU %MEM RSS COMMAND\n1 0 root S 0.0 0.1 100 init\n"
                    .to_string()
            }),
        }
    }

    fn test_host() -> HostConfig {
        HostConfig {
            id: "test-host".to_string(),
            name: "test-vps".to_string(),
            address: "127.0.0.1".to_string(),
            port: 22,
            auth: HostAuth::SshAgent {
                username: "ubuntu".to_string(),
            },
            refresh_interval_ms: 500,
            tags: Vec::new(),
            created_at: 0,
            updated_at: 0,
        }
    }

    #[tokio::test]
    async fn collector_uses_fast_batches_between_slow_refreshes() {
        let mut collector = MetricsCollector::new();
        let ssh = Arc::new(RecordingSshClient::default());
        let host = test_host();

        let first = collector.collect(&host, ssh.clone(), 1).await.unwrap();
        let second = collector.collect(&host, ssh.clone(), 1_001).await.unwrap();
        let third = collector.collect(&host, ssh.clone(), 6_001).await.unwrap();

        assert_eq!(
            *ssh.modes.lock().unwrap(),
            vec![
                MetricsBatchMode::Full,
                MetricsBatchMode::Fast,
                MetricsBatchMode::Full
            ]
        );
        assert_eq!(first.processes.len(), 1);
        assert_eq!(second.processes.len(), 1);
        assert_eq!(third.processes.len(), 1);
        assert_eq!(second.disks[0].read_bytes_per_sec, Some(1_024.0));
        assert_eq!(second.disks[0].write_bytes_per_sec, Some(2_048.0));
    }

    #[tokio::test]
    async fn collects_snapshot_from_configured_ssh_host_when_enabled() {
        let Ok(address) = std::env::var("VPSCOPE_TEST_SSH_HOST") else {
            return;
        };
        let username =
            std::env::var("VPSCOPE_TEST_SSH_USER").unwrap_or_else(|_| "ubuntu".to_string());
        let host = HostConfig {
            id: "ssh-test".to_string(),
            name: address.clone(),
            address,
            port: 22,
            auth: HostAuth::SshAgent { username },
            refresh_interval_ms: 2_000,
            tags: Vec::new(),
            created_at: 0,
            updated_at: 0,
        };
        let ssh: DynSshClient = Arc::new(OpenSshClient::new());

        let snapshot = MetricsCollector::collect_once(&host, ssh, 1).await.unwrap();

        assert_eq!(snapshot.host_id, "ssh-test");
        assert!(snapshot.memory.total_bytes > 0);
        assert!(!snapshot.disks.is_empty());
        assert!(!snapshot.network.is_empty());
        assert!(!snapshot.processes.is_empty());
    }
}
