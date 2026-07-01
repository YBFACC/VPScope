# VPScope 接口契约

本文档只保留前端 `/web` 与后端 `/src-tauri` 的 API shape 参考。契约变更规则、跨边界约束和联调要求已归档到 `.trellis/spec/guides/contract-and-integration.md`。

## TypeScript 类型参考

```ts
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
  fingerprint?: string;
  retryable: boolean;
};

export type HostAuth =
  | {
      type: "private_key";
      username: string;
      keyPath?: string;
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

export type TerminalApp = "terminal_app" | "iterm2" | "wezterm" | "ghostty" | "alacritty" | "kitty";

export type TerminalSettings = {
  app: TerminalApp;
};

export type HostOpenTerminalPayload = {
  hostId: HostId;
};

export type HostOpenTerminalResult = {
  ok: true;
  app: TerminalApp;
};

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

export type DockerLogTailLines = 100 | 300 | 1000;

export type DockerContainer = {
  id: string;
  name: string;
  image: string;
  state: string;
  status: string;
};

export type DockerContainerLogsResult = {
  hostId: HostId;
  containerId: string;
  tailLines: DockerLogTailLines;
  logs: string;
  fetchedAt: number;
};

export type SampleState = "warming" | "live";

export type HostSnapshot = {
  hostId: HostId;
  ts: number;
  sampleState: SampleState;
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

export type TrayItemDisplayMode = "text" | "rings";

export type TrayMetricSettings = {
  cpu: boolean;
  memory: boolean;
  disk: boolean;
  network: boolean;
};

export type TraySettingsItem = {
  hostId: HostId;
  label: string;
  displayMode: TrayItemDisplayMode;
  metrics: TrayMetricSettings;
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
```

## Tauri Commands

### `host_list`

用途：读取本地保存的服务器列表。

请求：

```ts
type HostListPayload = {};
```

响应：

```ts
type HostListResult = HostConfig[];
```

### `host_ssh_config_list`

用途：读取本机 `~/.ssh/config` 中可导入的 `Host` 条目，用于新增主机弹窗的导入列表。该命令只读取本机 SSH 配置元信息，不读取私钥内容，不执行 SSH。

请求：

```ts
type HostSshConfigListPayload = {};
```

响应：

```ts
type SshConfigHost = {
  alias: string;
  hostName: string;
  user?: string;
  port: number;
  identityFile?: string;
};

type HostSshConfigListResult = SshConfigHost[];
```

### `host_create`

用途：新增服务器配置。

请求：

```ts
type HostCreatePayload = {
  name: string;
  address: string;
  port: number;
  auth: HostAuth;
  refreshIntervalMs: number;
  tags?: string[];
};
```

响应：

```ts
type HostCreateResult = HostConfig;
```

### `host_update`

用途：更新服务器配置。

请求：

```ts
type HostUpdatePayload = {
  id: HostId;
  patch: Partial<Omit<HostConfig, "id" | "createdAt" | "updatedAt">>;
};
```

响应：

```ts
type HostUpdateResult = HostConfig;
```

### `host_reorder`

用途：调整已保存服务器列表的显示顺序。`host_list` 必须按该保存顺序返回。

请求：

```ts
type HostReorderPayload = {
  orderedHostIds: HostId[];
};
```

响应：

```ts
type HostReorderResult = HostConfig[];
```

### `host_delete`

用途：删除服务器配置，并清理关联的普通偏好引用。

请求：

```ts
type HostDeletePayload = {
  id: HostId;
};
```

响应：

```ts
type HostDeleteResult = {
  ok: true;
};
```

### `host_open_terminal`

用途：为已保存 host 打开一个本机 macOS 终端。

请求：

```ts
type HostOpenTerminalPayload = {
  hostId: HostId;
};
```

响应：

```ts
type HostOpenTerminalResult = {
  ok: true;
  app: "terminal_app" | "iterm2" | "wezterm" | "ghostty" | "alacritty" | "kitty";
};
```

### `host_test_connection`

用途：测试 SSH 是否可连接，并返回系统基础信息。

请求：

```ts
type HostTestConnectionPayload = {
  id?: HostId;
  draft?: HostCreatePayload;
};
```

响应：

```ts
type HostTestConnectionResult = {
  ok: true;
  latencyMs: number;
  hostname: string;
  os: string;
  kernel?: string;
  fingerprint?: string;
};
```

### `host_accept_key`

用途：用户确认首次连接的 SSH host key。

请求：

```ts
type HostAcceptKeyPayload = {
  id?: HostId;
  draft?: HostCreatePayload;
  fingerprint: string;
};
```

响应：

```ts
type HostAcceptKeyResult = {
  ok: true;
  fingerprint: string;
};
```

### `metrics_subscribe`

用途：开始订阅某个 host 的实时指标。后端通过 event 推送数据。

请求：

```ts
type CollectionProfile = "active" | "overview" | "tray";

type MetricsSubscribePayload = {
  hostId: HostId;
  intervalMs?: number;
  profile?: CollectionProfile;
};
```

响应：

```ts
type MetricsSubscribeResult = {
  subscriptionId: string;
};
```

### `metrics_last_snapshot`

用途：读取后端内存中最近一次成功采集的 snapshot。用于打开窗口或切换 host 时先显示最近状态，再等待实时订阅刷新。没有缓存时返回 `null`。

请求：

```ts
type MetricsLastSnapshotPayload = {
  hostId: HostId;
};
```

响应：

```ts
type MetricsLastSnapshotResult = HostSnapshot | null;
```

### `metrics_unsubscribe`

用途：取消实时指标订阅。

请求：

```ts
type MetricsUnsubscribePayload = {
  subscriptionId: string;
};
```

响应：

```ts
type MetricsUnsubscribeResult = {
  ok: true;
};
```

### `tray_settings_get`

用途：读取 macOS 菜单栏展示配置。该配置只包含普通偏好设置，不包含 SSH 凭据或敏感信息。

请求：

```ts
type TraySettingsGetPayload = {};
```

响应：

```ts
type TraySettings = {
  items: Array<{
    hostId: HostId;
    label: string;
    displayMode: "text" | "rings";
    metrics: {
      cpu: boolean;
      memory: boolean;
      disk: boolean;
      network: boolean;
    };
  }>;
};
```

### `tray_settings_update`

用途：更新 macOS 菜单栏展示配置，并立即刷新后端菜单栏状态项。支持多个 VPS 同时展示；文本模式按 `metrics` 开关显示 `label`、CPU、内存、磁盘和网络上下行，圆环模式显示 `label` 和进度环。

请求：

```ts
type TraySettingsUpdatePayload = {
  settings: TraySettings;
};
```

响应：

```ts
type TraySettingsUpdateResult = TraySettings;
```

### `alert_settings_get`

用途：读取 CPU 预警提醒配置。该配置只保存普通偏好，不包含 SSH 凭据、地址或用户名；通知标题由前端用 host 名称和当前 CPU 值生成。

请求：

```ts
type AlertSettingsGetPayload = {};
```

响应：

```ts
type AlertSettings = {
  rules: Array<{
    id: string;
    hostId: HostId;
    metric: "cpu";
    enabled: boolean;
    thresholdPercent: number;
    cooldownMs: number;
    createdAt: number;
    updatedAt: number;
  }>;
};
```

### `alert_settings_update`

用途：更新 CPU 预警提醒配置。第一版只支持 CPU；触发逻辑由前端在接收 `HostSnapshot` 后评估，并通过 Tauri notification 插件发送 macOS 原生通知。

请求：

```ts
type AlertSettingsUpdatePayload = {
  settings: AlertSettings;
};
```

响应：

```ts
type AlertSettingsUpdateResult = AlertSettings;
```

### `terminal_settings_get`

用途：读取主机卡片打开外部终端时使用的 macOS 终端偏好。该配置只保存普通偏好，不包含 SSH 凭据或命令模板。

请求：

```ts
type TerminalSettingsGetPayload = {};
```

响应：

```ts
type TerminalSettings = {
  app: "terminal_app" | "iterm2" | "wezterm" | "ghostty" | "alacritty" | "kitty";
};
```

### `terminal_settings_update`

用途：更新打开 SSH 会话时使用的终端应用。第一版只允许固定终端枚举，不支持自定义命令模板。

请求：

```ts
type TerminalSettingsUpdatePayload = {
  settings: TerminalSettings;
};
```

响应：

```ts
type TerminalSettingsUpdateResult = TerminalSettings;
```

### `process_list`

用途：按需刷新进程列表。实时 snapshot 里也可以包含进程列表，但此命令用于搜索、排序或低频刷新。

请求：

```ts
type ProcessListPayload = {
  hostId: HostId;
  sortBy: "cpu" | "memory" | "pid" | "name";
  sortDirection: "asc" | "desc";
  filter?: string;
  limit?: number;
};
```

响应：

```ts
type ProcessListResult = ProcessInfo[];
```

### `docker_container_list`

用途：通过已保存 host 的 SSH 连接读取远端 Docker 容器列表。该命令只执行后端固定白名单 Docker 查询，不允许前端传入任意命令。

请求：

```ts
type DockerContainerListPayload = {
  hostId: HostId;
};
```

响应：

```ts
type DockerContainerListResult = Array<{
  id: string;
  name: string;
  image: string;
  state: string;
  status: string;
}>;
```

### `docker_container_logs`

用途：读取某个 Docker 容器最近的原始日志。第一版不使用 `docker logs -f`，只做有界 tail 查询。

请求：

```ts
type DockerContainerLogsPayload = {
  hostId: HostId;
  containerId: string;
  tailLines: 100 | 300 | 1000;
};
```

响应：

```ts
type DockerContainerLogsResult = {
  hostId: HostId;
  containerId: string;
  tailLines: 100 | 300 | 1000;
  logs: string;
  fetchedAt: number;
};
```

### `docker_container_action`

用途：对某个 Docker 容器执行固定白名单管理动作。该命令只允许后端定义的动作枚举，不允许前端传入任意 Docker 子命令、flags 或 shell 字符串。

请求：

```ts
type DockerContainerAction = "start" | "stop" | "restart" | "remove" | "forceRemove";

type DockerContainerActionPayload = {
  hostId: HostId;
  containerId: string;
  action: DockerContainerAction;
};
```

响应：

```ts
type DockerContainerActionResult = {
  hostId: HostId;
  containerId: string;
  action: DockerContainerAction;
  completedAt: number;
};
```

动作映射：

- `start`: `docker start <container>`
- `stop`: `docker stop <container>`
- `restart`: `docker restart <container>`
- `remove`: `docker rm <container>`
- `forceRemove`: `docker rm -f <container>`

`forceRemove` 仅用于用户确认删除 running 容器后的固定动作路径。

## Events

### `host://connection-state`

payload:

```ts
HostConnectionState
```

触发场景：

- 开始连接
- 连接成功
- 连接断开
- 认证失败
- host key 变化
- 采集失败超过阈值

### `metrics://snapshot`

payload:

```ts
HostSnapshot
```

### `metrics://error`

payload:

```ts
{
  hostId: HostId;
  ts: number;
  error: AppError;
}
```

触发场景：

- 单次采集失败。
- parser 失败。
- 远程命令不可用。
