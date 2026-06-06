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

`disks` 表示适合监控展示的文件系统挂载，不是 `df -P` 的原始全量输出。后端应过滤 `tmpfs`、`devtmpfs`、`efivarfs`、`proc`、`sysfs`、`cgroup*`、`overlay` 等虚拟或运行时文件系统，以及 `/proc`、`/sys`、`/run`、`/dev` 下的运行时挂载。

`sampleState` 表示当前采样是否已有上一帧 counter：

- `warming`: 当前 collector 还没有上一帧 counter。`cpu.totalPercent`、`cpu.cores[].percent`、`network[].rxBytesPerSec`、`network[].txBytesPerSec`、`disks[].readBytesPerSec`、`disks[].writeBytesPerSec` 不是有效 delta 值，前端不能把它们当作真实 `0` 写入历史或展示为真实 rate。
- `live`: collector 已有上一帧 counter，CPU/network/disk IO delta 指标可展示并写入历史。

`warming` 样本仍可携带 system、memory、disk capacity、network total counters 和 process 等非 delta 信息，用于避免首次采集时 UI 空白。

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

用途：新增 password-less SSH 服务器配置。MVP 只支持 `ssh_agent` 和可由系统 OpenSSH/ssh-agent 无交互使用的 `private_key`。

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

规则：

- 后端不得接受 `password`、`passwordRef`、`passphrase`、`passphraseRef` 或 `keyRef` 字段；旧配置或请求携带这些字段时返回 `CONFIG_INVALID`。
- VPScope 不保存、不读取密码或私钥口令；加密私钥的解锁必须由系统 OpenSSH、`ssh-agent` 或系统 Keychain 处理。

### `host_update`

用途：更新 password-less SSH 服务器配置。

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

规则：

- `patch.auth` 只能更新为 `ssh_agent` 或 `private_key`。
- 后端不得接受 app-managed credential 字段；旧配置或请求携带这些字段时返回 `CONFIG_INVALID`。

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

规则：

- `orderedHostIds` 必须包含当前所有 host id，且每个 id 只能出现一次。
- 该命令只调整保存数组顺序，不修改单个 `HostConfig.updatedAt`。
- 缺失或重复 id 返回 `CONFIG_INVALID`；未知 id 返回 `HOST_NOT_FOUND`。

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

用途：为已保存 host 打开一个本机 macOS 终端，并在终端中启动受控 SSH 会话。前端只传 `hostId`；后端从 `HostConfig` 读取用户名、地址、端口和可选 `keyPath` 生成 `ssh` 命令。该命令不读取、不传递、不打印密码、私钥内容或 passphrase，也不允许前端传入任意 shell 字符串。

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

规则：

- 只支持 `Terminal.app`、`iTerm2`、`WezTerm`、`Ghostty`、`Alacritty` 和 `kitty`。
- `Terminal.app` 和 `iTerm2` 通过 AppleScript 打开并写入受控 `ssh` 命令；`WezTerm` 直接执行已安装的 `wezterm` binary，并使用 `start --new-tab -- ssh ...` 打开新 tab；其他终端通过 `/usr/bin/open -a <app> --args ...` 传递参数。
- 密码、私钥口令和 agent 交互由系统 `ssh` 在外部终端中处理。
- 这是本机受控启动动作，不是远程命令执行能力；不复用指标采集的 SSH mux session。
- `hostId` 不存在返回 `HOST_NOT_FOUND`，host 用户名或地址为空返回 `CONFIG_INVALID`。

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

用途：用户确认首次连接的 SSH host key 后，让系统 OpenSSH 将该 key 写入默认 `~/.ssh/known_hosts`。该命令只接受结构化 host payload 和用户确认过的 fingerprint，不允许前端传入任意 shell 字符串。

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

规则：

- 后端会重新扫描目标 host key，并确认扫描到的 fingerprint 与请求中的 `fingerprint` 完全一致。
- fingerprint 不一致时返回 `SSH_HOST_KEY_CHANGED` 或 `CONFIG_INVALID`，且不得写入 known_hosts。
- 写入动作由系统 OpenSSH 通过 `StrictHostKeyChecking=accept-new` 完成，VPScope 不拼接、不覆盖、不维护私有 known_hosts 文件。
- `SSH_HOST_KEY_CHANGED` 只阻断连接，用户需要用系统 SSH 工具人工检查或清理 known_hosts。

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

- `SSH_AUTH_FAILED`: 显示“认证失败”，引导用户检查 ssh-agent、系统 SSH 配置或密钥文件是否可无交互认证。
- `SSH_CONNECT_FAILED`: 显示“连接失败”，展示 address、port 和 retry。
- `SSH_HOST_KEY_UNKNOWN`: 弹出 fingerprint 确认。
- `SSH_HOST_KEY_CHANGED`: 强警告，需要用户重新确认，不自动连接。
- `REMOTE_UNSUPPORTED`: 某些指标不可用，Dashboard 降级展示。
- `PARSER_FAILED`: 展示“数据解析失败”，保留上一次有效 snapshot。
