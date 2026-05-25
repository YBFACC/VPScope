# VPScope 接口契约

本文档定义前端 `/web` 与后端 `/src-tauri` 的通信契约。前端只依赖这些命令和事件，不依赖后端内部实现；后端只保证这些结构稳定，不关心前端具体布局。

## 通信方式

- 请求/响应：Tauri `invoke(command, payload)`。
- 实时数据：Tauri event。
- 错误返回：所有命令返回统一 `AppError`。
- 时间字段：统一使用 Unix milliseconds。
- 字节字段：统一使用 bytes。
- 百分比字段：统一使用 `0` 到 `100` 的 number。

## TypeScript 类型

前端应在 `/web/src/types/contracts.ts` 中维护这些类型。后端 Rust 结构体应通过 `serde` 序列化出相同字段名。

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

用途：新增服务器配置，并把敏感凭据写入 Keychain。

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

用途：更新服务器配置。敏感字段为空时表示保持原凭据。

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

### `host_delete`

用途：删除服务器配置，并清理关联凭据。

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

`profile` 用于控制采集成本：

- `active`：当前详情页，默认使用 host 的 `refreshIntervalMs`，限制在 500ms 到 10000ms，并按需采集进程列表。
- `overview`：多 host 总览，限制在 5000ms 到 30000ms，不采集进程列表。
- `tray`：窗口隐藏或菜单栏展示，限制在 30000ms 到 300000ms，不采集进程列表。

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
  }>;
};
```

### `tray_settings_update`

用途：更新 macOS 菜单栏展示配置，并立即刷新后端菜单栏状态项。支持多个 VPS 同时展示；文本模式显示 `label cpu mem disk`，圆环模式显示 `label` 和进度环。

请求：

```ts
type TraySettingsUpdatePayload = TraySettings;
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

规则：

- `hostId` 必须指向现有 host。
- 每个 `hostId + metric` 最多一条规则。
- `thresholdPercent` 必须在 `1..100`。
- `cooldownMs` 必须在 `60000..3600000`。
- 删除 host 时后端会同步删除对应预警规则。

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

触发频率：

- `active` 默认使用 host 的 `refreshIntervalMs`，限制在 500ms 到 10000ms。
- `overview` 默认不低于 5000ms，限制在 5000ms 到 30000ms。
- `tray` 默认 30000ms，限制在 30000ms 到 300000ms。

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

## 错误展示约定

前端根据 `AppError.code` 做稳定展示：

- `SSH_AUTH_FAILED`: 显示“认证失败”，引导用户检查密码、密钥或 passphrase。
- `SSH_CONNECT_FAILED`: 显示“连接失败”，展示 address、port 和 retry。
- `SSH_HOST_KEY_UNKNOWN`: 弹出 fingerprint 确认。
- `SSH_HOST_KEY_CHANGED`: 强警告，需要用户重新确认，不自动连接。
- `REMOTE_UNSUPPORTED`: 某些指标不可用，Dashboard 降级展示。
- `PARSER_FAILED`: 展示“数据解析失败”，保留上一次有效 snapshot。
