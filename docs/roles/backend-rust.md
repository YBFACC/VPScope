# 后端角色：Tauri Rust Core + SSH Metrics

## 角色目标

后端角色负责在 `/src-tauri` 中实现 Tauri 应用核心、SSH 连接、远程服务器指标采集、配置存储、凭据存储、数据解析和事件推送。后端不负责 Dashboard 视觉布局，但必须提供稳定、可验证、类型清晰的数据。

最终交付：

- Tauri v2 Rust 后端。
- Host 配置 CRUD。
- SSH 连接测试和连接状态管理。
- 基于 SSH 的 agentless 指标采集。
- Tauri commands 和 events。
- 安全的凭据管理和 known_hosts 校验。
- parser 单元测试。

## 目录边界

后端只修改：

```text
src-tauri/
  Cargo.toml
  tauri.conf.json
  capabilities/
  src/
```

后端不要修改：

```text
web/src/components/
web/src/features/
```

如果后端需要调整前端字段，先修改 [接口契约](/Users/ybf/code/VPScope/docs/roles/contracts.md)，再同步前端。

## 推荐目录结构

```text
src-tauri/src/
  main.rs
  app_state.rs
  commands/
    mod.rs
    hosts.rs
    metrics.rs
    processes.rs
    settings.rs
  config/
    mod.rs
    host_config.rs
    storage.rs
  ssh/
    mod.rs
    client.rs
    session_pool.rs
  metrics/
    mod.rs
    collector.rs
    snapshot.rs
    scheduler.rs
  parsers/
    mod.rs
    cpu.rs
    memory.rs
    disk.rs
    network.rs
    process.rs
    system.rs
  errors.rs
  events.rs
```

## 技术要求

- 使用 `serde` 定义所有 command payload/result。
- Rust 字段通过 `#[serde(rename_all = "camelCase")]` 输出给前端。
- 不把 password、private key 内容或 passphrase 写入普通配置文件。
- MVP 不实现 app-managed password/passphrase；认证必须走系统 OpenSSH password-less 路径。
- 前端不可传入任意命令字符串。
- 所有远程命令必须在后端白名单内。
- SSH session 需要复用，避免每次刷新重连。
- 采集任务需要可取消，切换 host 或取消订阅后停止推送。

## 详细实现步骤

### Step 1: 初始化 `/src-tauri`

1. 创建 Tauri v2 项目结构。
2. 配置 `tauri.conf.json` 指向 `/web/dist`。
3. 开发模式指向 `/web` Vite dev server。
4. 建立最小 `main.rs`，注册 commands。
5. 建立 `AppState`，放入 config store、ssh session pool、metrics scheduler。

`AppState` 建议：

```rust
pub struct AppState {
    pub config_store: Arc<ConfigStore>,
    pub ssh_pool: Arc<SshSessionPool>,
    pub metrics_scheduler: Arc<MetricsScheduler>,
}
```

验收：

- Tauri app 能启动。
- 前端能 invoke 一个 `health_check` 测试命令。

### Step 2: 定义错误模型

创建 `/src-tauri/src/errors.rs`：

- 定义 `AppErrorCode`。
- 定义 `AppError`。
- 实现 `Serialize`。
- 实现从 SSH、IO、parser 错误转换。

字段必须匹配前端：

```rust
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppError {
    pub code: String,
    pub message: String,
    pub detail: Option<String>,
    pub retryable: bool,
}
```

验收：

- command 返回错误时，前端能拿到稳定 code。
- 日志里不包含 password、private key 内容和 passphrase。
- 后端不得接受 `password`、`passwordRef`、`passphrase`、`passphraseRef` 或 `keyRef` 字段。

### Step 3: 实现 Host 配置存储

Host 配置存放在 app config dir，例如：

```text
~/Library/Application Support/VPScope/hosts.json
```

配置中可以保存：

- id
- name
- address
- port
- username
- auth type
- key path
- refresh interval
- tags
- created/updated

配置中不能保存：

- password 明文
- private key 明文
- passphrase 明文

实现 commands：

- `host_list`
- `host_create`
- `host_update`
- `host_delete`

实现要求：

- `host_create` 生成稳定 UUID。
- `host_update` 更新 `updatedAt`。
- `host_delete` 同时清理 tray/alert 等普通偏好引用。
- 写文件使用原子写入，避免崩溃时损坏配置。

验收：

- 重启 app 后 host 列表仍存在。
- 删除 host 后相关普通偏好引用也被清理。

### Step 4: 明确 SSH 认证边界

MVP 只支持 password-less OpenSSH 认证路径：`ssh_agent`、只读导入的 `~/.ssh/config` alias，以及已经可由系统 OpenSSH、`ssh-agent` 或系统 Keychain 无交互使用的 private key file。

实现规则：

- `HostAuth` 只允许 `ssh_agent` 与 `private_key`。
- `private_key` 只保存 `username` 和可选 `keyPath`。
- 旧 `password` auth 或旧 app-managed 字段必须在 serde/校验阶段返回 `CONFIG_INVALID`，不得静默忽略。
- 后端不保存、不读取 password 或 private key passphrase。
- 需要 passphrase 的 key 必须由系统 OpenSSH、`ssh-agent` 或系统 Keychain 预先解锁。

验收：

- 配置文件中不出现 `passwordRef`、`passphraseRef` 或 `keyRef`。
- 旧 app-managed credential 字段反序列化失败并映射到 `CONFIG_INVALID`。

### Step 5: 选择并封装 SSH Client

建议先调研并确定一个 Rust SSH 方案：

- `openssh`: 借助系统 ssh，兼容用户现有 ssh config 和 agent。MVP 当前采用此路径，并启用 `native-mux`，通过 OpenSSH control master 保持连接、通过 native mux socket 执行后续 command，减少本机 `ssh` 子进程 churn。
- `ssh2`: libssh2 绑定，成熟但 host key、agent、key 格式支持需要测试。
- `russh`: 纯 Rust，控制力强，但实现成本可能更高。

无论选哪个，都封装成内部 trait，避免业务代码绑定具体库：

```rust
pub trait SshClient: Send + Sync {
    fn test_connection(&self, host: &HostConfig) -> Result<ConnectionInfo, AppError>;
    fn exec(&self, host_id: &str, command: RemoteCommand) -> Result<String, AppError>;
    fn disconnect_host(&self, host_id: &str) -> Result<(), AppError>;
}
```

实现要求：

- 按 host 复用 SSH session，不允许每个指标或每次刷新都重新建立 SSH 连接。
- session cache 需要随 host 地址、端口、认证配置或更新时间变化而失效。
- 采集订阅结束且该 host 没有其它活跃订阅时，需要释放对应 session。
- 连接中断时允许丢弃缓存 session 并重连重试一次。
- 监控采集优先使用固定批量脚本，脚本内容必须在后端常量中维护，不能由前端传入。

`RemoteCommand` 使用枚举，不使用自由字符串：

```rust
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
}
```

验收：

- 前端无法让后端执行任意 shell。
- SSH 连接失败能区分认证失败、网络失败、host key 问题。

### Step 6: 实现 known_hosts 校验

需要处理三种状态：

- known host: fingerprint 匹配，直接连接。
- unknown host: 返回 `SSH_HOST_KEY_UNKNOWN`，前端让用户确认。
- changed host: 返回 `SSH_HOST_KEY_CHANGED`，强警告，不自动覆盖。

实现要求：

- fingerprint 使用清晰格式，例如 `SHA256:xxxx`。
- 使用系统 OpenSSH 默认 `~/.ssh/known_hosts` 作为唯一信任源，不维护 VPScope 私有 known_hosts 文件。
- 用户确认后，通过系统 OpenSSH `StrictHostKeyChecking=accept-new` 写入 known_hosts。
- host key changed 必须阻断连接。

验收：

- 第一次连接新 VPS 时会返回 fingerprint。
- 用户确认后再次连接不再提示。
- 服务器 key 变化时会阻断。

### Step 7: 实现指标 parser

每个 parser 独立文件，输入是远程命令输出字符串，输出结构化数据。

Parser 列表：

- `cpu.rs`: 解析 `/proc/stat`，计算 total 和 per-core 使用率。
- `memory.rs`: 解析 `/proc/meminfo`。
- `system.rs`: 解析 `/proc/loadavg`、`/proc/uptime`、`uname`。
- `network.rs`: 解析 `/proc/net/dev`，计算 rx/tx rate。
- `disk.rs`: 解析 `df -P` 和 `/proc/diskstats`。
- `process.rs`: 解析 `ps` 输出。

CPU 使用率注意：

- `/proc/stat` 是累计计数，必须用两次采样差值计算。
- 第一次采样可以返回 `0` 或标记 warming up。
- per-core 也需要保存上一次计数。

Network rate 注意：

- `/proc/net/dev` 是累计 bytes。
- 需要用本次和上次差值除以时间间隔。

Disk IO 注意：

- `/proc/diskstats` 是累计 sector。
- sector size 通常按 512 bytes 计算，但需要允许后续修正。

Process parser 建议命令：

```bash
ps -eo pid,ppid,user,stat,pcpu,pmem,rss,args
```

验收：

- 每个 parser 至少有 2 组 fixture 测试。
- parser 失败返回 `PARSER_FAILED`，不能 panic。

### Step 8: 实现 Metrics Collector

Collector 负责合成一次完整 `HostSnapshot`，但采集按 profile 和批量模式分层：

1. 快路径每个刷新周期读取 `/proc/loadavg`、`/proc/uptime`、`/proc/stat`、`/proc/meminfo`、`/proc/net/dev`、`/proc/diskstats`。
2. 读取 CPU 原始计数并计算差值。
3. 读取内存。
4. 读取磁盘 IO 累计值并计算速率。
5. 读取网络累计值并计算速率。
6. 慢路径按 profile 低频刷新 `uname`、`df -P`，并复用系统静态信息和磁盘容量。
7. 进程路径只在 `active` profile 按需刷新 `ps`；`overview` 和 `tray` 不采集进程列表。
8. 合成 `HostSnapshot`，并把最近一次成功 snapshot 缓存在内存中供 `metrics_last_snapshot` 读取。

采集执行要求：

- 快路径、慢路径和进程路径都通过 `SshClient::collect_metrics` 的固定批量命令执行，避免一个刷新周期内串行发出多条 SSH command。
- 首次 `active` 采集必须使用 full batch，保证 snapshot 有系统信息、磁盘容量和进程列表。
- 首次 `overview`/`tray` 采集只需要 slow batch，不运行 `ps`。
- 在高频刷新间隔下，不能每帧运行 `ps`、`df -P` 或 `uname`。
- `/proc/diskstats` 速率按累计 sector 差值计算，默认 sector size 为 512 bytes。

建议结构：

```rust
pub struct MetricsCollector {
    ssh: Arc<dyn SshClient>,
    previous: Mutex<HashMap<String, PreviousCounters>>,
}

impl MetricsCollector {
    pub async fn collect(&self, host_id: &str) -> Result<HostSnapshot, AppError> {
        // execute whitelisted commands and parse output
    }
}
```

验收：

- 连续采集时 CPU、网络速率不是固定 0。
- 单个指标失败时可以降级，除非核心命令不可用。
- snapshot 字段符合 `contracts.md`。

### Step 9: 实现订阅调度

`metrics_subscribe`：

- 创建 subscription id。
- 启动后台任务。
- 按 `CollectionProfile` 解析 interval 并调用 collector。
- 通过 `metrics://snapshot` 推送。
- 失败时通过 `metrics://error` 推送。

`metrics_unsubscribe`：

- 根据 subscription id 取消任务。
- 如果该 host 没有其他订阅，安排 idle timeout 后释放 SSH session。

`metrics_last_snapshot`：

- 返回后端内存中最近一次成功采集的 `HostSnapshot`。
- 没有缓存时返回 `null`。
- 用于前端打开窗口或切换 host 时先显示最近状态。

实现要求：

- `active` 刷新间隔限制在 500ms 到 10000ms。
- `overview` 刷新间隔限制在 5000ms 到 30000ms。
- `tray` 刷新间隔限制在 30000ms 到 300000ms。
- 后台任务必须可取消。
- app 退出时停止所有任务。
- 不要把同一个 host 的多个面板变成多个采集循环。

验收：

- 切换 host 后旧 host 不再持续推送。
- 重复订阅不会无限创建 SSH 连接。
- 后端长时间运行没有任务泄漏。

### Step 10: 实现进程列表命令

`process_list` 用于按需获取进程列表。

要求：

- 支持 sortBy: cpu/memory/pid/name。
- 支持 sortDirection。
- 支持 filter。
- 支持 limit。
- filter 在后端做一次，前端也可以本地再过滤。

验收：

- 进程列表和 `ps/top` 基本一致。
- limit 生效。
- filter 不会注入 shell，因为命令仍然固定，过滤在 Rust 内存中做。

### Step 11: Tauri 权限配置

配置 capability，只允许前端调用必要 command。

建议起步：

```json
{
  "identifier": "main-capability",
  "windows": ["main"],
  "permissions": ["core:default"]
}
```

自定义 commands 由 Rust 注册，不开放 shell plugin 给前端。
打开外部终端 SSH 会话也必须保持为受控本机启动动作：前端只传 `hostId`，后端从已保存 `HostConfig` 生成固定 `ssh` 命令并调用 macOS 终端，不接受前端传入 shell 字符串。

验收：

- 前端不能调用任意 shell。
- 只暴露合同里定义的命令。

## 后端验收清单

- `host_list/create/update/delete` 可用。
- SSH 测试连接可用。
- 凭据不落明文配置。
- known_hosts 流程完整。
- `metrics_subscribe` 能持续推送 snapshot。
- `metrics_unsubscribe` 能停止任务。
- parser 有 fixture 测试。
- 错误 code 与 contracts 一致。
- 长时间采集没有明显连接泄漏或任务泄漏。
