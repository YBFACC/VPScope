export type HostId = string;

export type AppError = {
  code:
    | "CONFIG_INVALID"
    | "HOST_NOT_FOUND"
    | "SSH_AUTH_FAILED"
    | "SSH_CONNECT_FAILED"
    | "SSH_HOST_KEY_CHANGED"
    | "SSH_HOST_KEY_UNKNOWN"
    | "REMOTE_COMMAND_FAILED"
    | "REMOTE_UNSUPPORTED"
    | "PARSER_FAILED"
    | "INTERNAL";
  message: string;
  detail?: string;
  retryable: boolean;
};

export type HostAuth =
  | {
      type: "password";
      username: string;
      passwordRef?: string;
    }
  | {
      type: "private_key";
      username: string;
      keyPath?: string;
      keyRef?: string;
      passphraseRef?: string;
    }
  | {
      type: "ssh_agent";
      username: string;
    };

export type HostConfig = {
  id: HostId;
  name: string;
  address: string;
  port: number;
  auth: HostAuth;
  refreshIntervalMs: number;
  tags: string[];
  createdAt: number;
  updatedAt: number;
};

export type HostListPayload = Record<string, never>;
export type HostListResult = HostConfig[];

export type SshConfigHost = {
  alias: string;
  hostName: string;
  user?: string;
  port: number;
  identityFile?: string;
};

export type HostConnectionState = {
  hostId: HostId;
  status: "disconnected" | "connecting" | "connected" | "error";
  message?: string;
  latencyMs?: number;
  lastConnectedAt?: number;
  lastError?: AppError;
};

export type HostCreatePayload = {
  name: string;
  address: string;
  port: number;
  auth: HostAuth;
  refreshIntervalMs: number;
  tags?: string[];
};

export type HostCreateResult = HostConfig;

export type HostUpdatePayload = {
  id: HostId;
  patch: Partial<Omit<HostConfig, "id" | "createdAt" | "updatedAt">>;
};

export type HostUpdateResult = HostConfig;

export type HostDeletePayload = {
  id: HostId;
};

export type HostDeleteResult = {
  ok: true;
};

export type HostTestConnectionPayload = {
  id?: HostId;
  draft?: HostCreatePayload;
};

export type HostTestConnectionResult = {
  ok: true;
  latencyMs: number;
  hostname: string;
  os: string;
  kernel?: string;
  fingerprint?: string;
};

export type CollectionProfile = "active" | "overview" | "tray";

export type MetricsSubscribePayload = {
  hostId: HostId;
  intervalMs?: number;
  profile?: CollectionProfile;
};

export type MetricsLastSnapshotPayload = {
  hostId: HostId;
};

export type MetricsLastSnapshotResult = HostSnapshot | null;

export type MetricsSubscribeResult = {
  subscriptionId: string;
};

export type MetricsUnsubscribePayload = {
  subscriptionId: string;
};

export type MetricsUnsubscribeResult = {
  ok: true;
};

export type TrayItemDisplayMode = "text" | "rings";

export type TraySettingsItem = {
  hostId: HostId;
  label: string;
  displayMode: TrayItemDisplayMode;
};

export type TraySettings = {
  items: TraySettingsItem[];
};

export type AlertMetric = "cpu";

export type AlertRule = {
  id: string;
  hostId: HostId;
  metric: AlertMetric;
  enabled: boolean;
  thresholdPercent: number;
  cooldownMs: number;
  createdAt: number;
  updatedAt: number;
};

export type AlertSettings = {
  rules: AlertRule[];
};

export type ProcessListPayload = {
  hostId: HostId;
  sortBy: "cpu" | "memory" | "pid" | "name";
  sortDirection: "asc" | "desc";
  filter?: string;
  limit?: number;
};

export type ProcessListResult = ProcessInfo[];

export type ProcessInfo = {
  pid: number;
  ppid?: number;
  user: string;
  command: string;
  name: string;
  cpuPercent: number;
  memoryBytes: number;
  memoryPercent?: number;
  state?: string;
  startedAt?: number;
};

export type HostSnapshot = {
  hostId: HostId;
  ts: number;
  system: {
    hostname: string;
    os: string;
    kernel?: string;
    arch?: string;
    uptimeSec: number;
    loadAvg: [number, number, number];
  };
  cpu: {
    totalPercent: number;
    cores: Array<{ id: string; percent: number }>;
  };
  memory: {
    totalBytes: number;
    usedBytes: number;
    availableBytes: number;
    cachedBytes: number;
    swapTotalBytes: number;
    swapUsedBytes: number;
  };
  disks: Array<{
    mount: string;
    fs: string;
    totalBytes: number;
    usedBytes: number;
    readBytesPerSec?: number;
    writeBytesPerSec?: number;
  }>;
  network: Array<{
    iface: string;
    rxBytesPerSec: number;
    txBytesPerSec: number;
    rxTotalBytes: number;
    txTotalBytes: number;
  }>;
  processes: ProcessInfo[];
};

export type MetricsSnapshotEvent = HostSnapshot;

export type MetricsErrorEvent = {
  hostId: HostId;
  ts: number;
  error: AppError;
};

export type VpscopeEventPayloads = {
  "host://connection-state": HostConnectionState;
  "metrics://snapshot": MetricsSnapshotEvent;
  "metrics://error": MetricsErrorEvent;
};

export type VpscopeCommandPayloads = {
  host_list: HostListPayload;
  host_create: HostCreatePayload;
  host_update: HostUpdatePayload;
  host_delete: HostDeletePayload;
  host_ssh_config_list: Record<string, never>;
  host_test_connection: HostTestConnectionPayload;
  metrics_last_snapshot: MetricsLastSnapshotPayload;
  metrics_subscribe: MetricsSubscribePayload;
  metrics_unsubscribe: MetricsUnsubscribePayload;
  process_list: ProcessListPayload;
  tray_settings_get: Record<string, never>;
  tray_settings_update: TraySettings;
  alert_settings_get: Record<string, never>;
  alert_settings_update: { settings: AlertSettings };
};

export type VpscopeCommandResults = {
  host_list: HostListResult;
  host_create: HostCreateResult;
  host_update: HostUpdateResult;
  host_delete: HostDeleteResult;
  host_ssh_config_list: SshConfigHost[];
  host_test_connection: HostTestConnectionResult;
  metrics_last_snapshot: MetricsLastSnapshotResult;
  metrics_subscribe: MetricsSubscribeResult;
  metrics_unsubscribe: MetricsUnsubscribeResult;
  process_list: ProcessListResult;
  tray_settings_get: TraySettings;
  tray_settings_update: TraySettings;
  alert_settings_get: AlertSettings;
  alert_settings_update: AlertSettings;
};
