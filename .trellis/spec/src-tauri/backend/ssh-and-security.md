# SSH 与安全

> 来源：`AGENTS.md`、`docs/roles/backend-rust.md`、`docs/roles/contracts.md`、`docs/vpscope-plan.md`。

## SSH 规则

- MVP 使用无 Agent 的 SSH。
- SSH 逻辑属于 Rust，而不是前端。
- 尽可能重用每个主机的 SSH 会话。
- 不要为每个面板创建一个新的 SSH 连接。
- 不允许前端提供任意命令字符串。
- 使用内部枚举或固定函数表示远程命令。

## MVP 允许的远程数据源包括

```text
/proc/stat
/proc/meminfo
/proc/loadavg
/proc/uptime
/proc/net/dev
/proc/diskstats
df -P
ps
uname
```

## 安全规则

- 不要记录 (log) 密码、私钥内容、密码短语、令牌或完整的凭据引用。
- 不要在 JSON/TOML 配置中存储密码、私钥内容或密码短语。
- 默认情况下严格对待 `known_hosts`。
- 未知主机密钥需要用户确认。
- 更改的主机密钥必须阻止连接，除非用户明确解决。
- MVP 远程操作是只读的。

## 明确 SSH 认证边界

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

## 选择并封装 SSH Client

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

## known_hosts 校验

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

## 安全基线

- 切勿硬编码机密信息、API 密钥或凭证。使用环境变量、macOS 钥匙串 (Keychain) 或合适的机密管理器。
- 如果添加了数据库代码，请使用参数化查询访问数据库。
- 切勿将用户输入拼接到 SQL、本地 shell 命令或远程命令中。
- 在系统边界验证并清理外部输入。
