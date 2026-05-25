import type { HostConnectionState, HostSnapshot, MetricsErrorEvent, ProcessInfo } from "@/types/contracts";

const mib = 1024 ** 2;
const gib = 1024 ** 3;
const baseTs = 1_735_689_600_000;

function processRow(index: number): ProcessInfo {
  const services = ["nginx", "postgres", "node", "redis-server", "sshd", "systemd", "containerd", "journald"];
  const name = services[index % services.length];
  const isLongCommand = index === 17 || index === 211;

  return {
    pid: 1_200 + index,
    ppid: index % 9 === 0 ? 1 : 1_100 + (index % 40),
    user: index % 5 === 0 ? "root" : index % 3 === 0 ? "postgres" : "ubuntu",
    name,
    command: isLongCommand
      ? `/usr/bin/${name} --config /etc/vpscope/services/${name}/production.conf --listen 0.0.0.0:${8_000 + index} --worker-label very-long-command-line-used-to-check-process-table-truncation-${index} --feature-flags alpha,beta,gamma,delta`
      : `/usr/bin/${name} --service vpscope-${index}`,
    cpuPercent: Number(((index * 7) % 100 / 10).toFixed(1)),
    memoryBytes: (24 + ((index * 13) % 512)) * mib,
    memoryPercent: Number((0.1 + ((index * 11) % 90) / 10).toFixed(1)),
    state: index % 13 === 0 ? "S" : index % 29 === 0 ? "R" : "I",
    startedAt: baseTs - index * 45_000,
  };
}

export const idleHost: HostSnapshot = {
  hostId: "mock-idle-ubuntu",
  ts: baseTs,
  system: {
    hostname: "idle-vps",
    os: "Ubuntu 22.04.4 LTS",
    kernel: "5.15.0-107-generic",
    arch: "x86_64",
    uptimeSec: 178_260,
    loadAvg: [0.03, 0.04, 0.01],
  },
  cpu: {
    totalPercent: 6.2,
    cores: [
      { id: "cpu0", percent: 3.5 },
      { id: "cpu1", percent: 8.9 },
    ],
  },
  memory: {
    totalBytes: 2 * gib,
    usedBytes: 522 * mib,
    availableBytes: 1_282 * mib,
    cachedBytes: 710 * mib,
    swapTotalBytes: 0,
    swapUsedBytes: 0,
  },
  disks: [
    {
      mount: "/",
      fs: "ext4",
      totalBytes: 39 * gib,
      usedBytes: 8.4 * gib,
      readBytesPerSec: 12 * 1024,
      writeBytesPerSec: 4 * 1024,
    },
    {
      mount: "/var/log",
      fs: "ext4",
      totalBytes: 12 * gib,
      usedBytes: 2.1 * gib,
      readBytesPerSec: 0,
      writeBytesPerSec: 18 * 1024,
    },
  ],
  network: [
    {
      iface: "eth0",
      rxBytesPerSec: 8 * 1024,
      txBytesPerSec: 3 * 1024,
      rxTotalBytes: 1.7 * gib,
      txTotalBytes: 820 * mib,
    },
    {
      iface: "tailscale0",
      rxBytesPerSec: 640,
      txBytesPerSec: 920,
      rxTotalBytes: 218 * mib,
      txTotalBytes: 134 * mib,
    },
  ],
  processes: [processRow(0), processRow(1), processRow(2), processRow(17), processRow(29)],
};

export const busyHost: HostSnapshot = {
  hostId: "mock-busy-ubuntu",
  ts: baseTs + 2_000,
  system: {
    hostname: "build-runner-01",
    os: "Ubuntu 24.04.1 LTS",
    kernel: "6.8.0-41-generic",
    arch: "x86_64",
    uptimeSec: 2_941_880,
    loadAvg: [7.82, 6.44, 5.91],
  },
  cpu: {
    totalPercent: 88.4,
    cores: [
      { id: "cpu0", percent: 91.2 },
      { id: "cpu1", percent: 83.1 },
      { id: "cpu2", percent: 96.4 },
      { id: "cpu3", percent: 75.8 },
      { id: "cpu4", percent: 89.6 },
      { id: "cpu5", percent: 92.9 },
      { id: "cpu6", percent: 84.7 },
      { id: "cpu7", percent: 93.4 },
    ],
  },
  memory: {
    totalBytes: 32 * gib,
    usedBytes: 27.8 * gib,
    availableBytes: 2.4 * gib,
    cachedBytes: 5.6 * gib,
    swapTotalBytes: 8 * gib,
    swapUsedBytes: 3.2 * gib,
  },
  disks: [
    {
      mount: "/",
      fs: "ext4",
      totalBytes: 120 * gib,
      usedBytes: 98 * gib,
      readBytesPerSec: 18.4 * mib,
      writeBytesPerSec: 42.7 * mib,
    },
    {
      mount: "/srv/build-cache",
      fs: "xfs",
      totalBytes: 480 * gib,
      usedBytes: 391 * gib,
      readBytesPerSec: 112 * mib,
      writeBytesPerSec: 86 * mib,
    },
    {
      mount: "/mnt/object-sync/very/long/mount/path/that/should/not/stretch/the/disk/panel",
      fs: "nfs4",
      totalBytes: 2_048 * gib,
      usedBytes: 1_194 * gib,
      readBytesPerSec: 7.5 * mib,
      writeBytesPerSec: 2.1 * mib,
    },
  ],
  network: [
    {
      iface: "eth0",
      rxBytesPerSec: 54 * mib,
      txBytesPerSec: 31 * mib,
      rxTotalBytes: 8_284 * gib,
      txTotalBytes: 3_392 * gib,
    },
    {
      iface: "eth1",
      rxBytesPerSec: 14 * mib,
      txBytesPerSec: 22 * mib,
      rxTotalBytes: 1_408 * gib,
      txTotalBytes: 1_822 * gib,
    },
    {
      iface: "wg0",
      rxBytesPerSec: 620 * 1024,
      txBytesPerSec: 711 * 1024,
      rxTotalBytes: 490 * gib,
      txTotalBytes: 511 * gib,
    },
  ],
  processes: Array.from({ length: 240 }, (_, index) => processRow(index)),
};

export const errorHost: HostSnapshot = {
  hostId: "mock-error-degraded",
  ts: baseTs + 4_000,
  system: {
    hostname: "unknown",
    os: "remote unsupported",
    uptimeSec: 0,
    loadAvg: [0, 0, 0],
  },
  cpu: {
    totalPercent: 0,
    cores: [],
  },
  memory: {
    totalBytes: 0,
    usedBytes: 0,
    availableBytes: 0,
    cachedBytes: 0,
    swapTotalBytes: 0,
    swapUsedBytes: 0,
  },
  disks: [],
  network: [],
  processes: [],
};

export const mockConnectionStates: HostConnectionState[] = [
  {
    hostId: idleHost.hostId,
    status: "connected",
    latencyMs: 18,
    lastConnectedAt: baseTs - 30_000,
  },
  {
    hostId: busyHost.hostId,
    status: "connected",
    latencyMs: 61,
    lastConnectedAt: baseTs - 12_000,
  },
  {
    hostId: errorHost.hostId,
    status: "error",
    message: "Parser failed while reading /proc/meminfo",
    lastError: {
      code: "PARSER_FAILED",
      message: "Unable to parse memory snapshot",
      detail: "MemTotal field was missing from /proc/meminfo output",
      retryable: true,
    },
  },
];

export const mockMetricsError: MetricsErrorEvent = {
  hostId: errorHost.hostId,
  ts: errorHost.ts,
  error: {
    code: "REMOTE_UNSUPPORTED",
    message: "Some metrics are unavailable on this host",
    detail: "process list returned no rows; retaining last valid snapshot",
    retryable: true,
  },
};

export const mockSnapshots = {
  idleHost,
  busyHost,
  errorHost,
};

export const mockSnapshot = idleHost;

export function createMockSnapshot(hostId: string): HostSnapshot {
  const source =
    hostId === "mock-vps-2" || hostId === busyHost.hostId
      ? busyHost
      : hostId === errorHost.hostId
        ? errorHost
        : idleHost;

  return {
    ...source,
    hostId,
    ts: Date.now(),
    system: { ...source.system },
    cpu: {
      totalPercent: source.cpu.totalPercent,
      cores: source.cpu.cores.map((core) => ({ ...core })),
    },
    memory: { ...source.memory },
    disks: source.disks.map((disk) => ({ ...disk })),
    network: source.network.map((iface) => ({ ...iface })),
    processes: source.processes.map((process) => ({ ...process })),
  };
}
