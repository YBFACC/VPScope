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

## Scenario: 只读 Docker 日志命令

### 1. Scope / Trigger

- Trigger: Docker 日志查看器新增跨层 command，并通过 SSH 执行远程 Docker CLI。
- Scope: 列容器和读取 bounded tail logs；日志命令本身不允许 stop/start/restart/delete/exec/follow。
- Safety: Docker 命令必须由后端固定构造，前端不能传入 shell 字符串或任意 Docker 子命令。

### 2. Signatures

```rust
docker_container_list(host_id: String) -> Result<Vec<DockerContainer>, AppError>
docker_container_logs(host_id: String, container_id: String, tail_lines: DockerLogTailLines) -> Result<DockerContainerLogsResult, AppError>
```

### 3. Contracts

- `docker_container_list` request: `hostId: string`
- `docker_container_list` response item: `id`, `name`, `image`, `state`, `status`, optional `createdAt`
- `docker_container_logs` request: `hostId: string`, `containerId: string`, `tailLines: 100 | 300 | 1000`
- `docker_container_logs` response: `hostId`, `containerId`, `tailLines`, `logs`, `fetchedAt` (Unix milliseconds)
- `containerId` must come from discovered Docker containers and must be validated before command construction.

### 4. Validation & Error Matrix

- Missing host -> `HOST_NOT_FOUND`
- Empty / unsafe `containerId` -> `CONFIG_INVALID`
- Unsupported `tailLines` -> `CONFIG_INVALID`
- Missing Docker binary / unsupported remote -> `REMOTE_UNSUPPORTED`
- Docker permission denied or command failure -> `REMOTE_COMMAND_FAILED`
- SSH authentication / connection / host-key failures -> existing SSH error mapping

### 5. Good/Base/Bad Cases

- Good: `docker_container_logs(host, "abc123", 300)` fetches raw recent logs without enabling follow mode.
- Base: exited containers are listed and can still return historical logs.
- Bad: any payload field that tries to include shell metacharacters, Docker subcommands, or arbitrary flags must be rejected before SSH execution.

### 6. Tests Required

- Parser test: running containers sort before non-running containers.
- Parser test: malformed container list rows fail with a stable `PARSER_FAILED` / command error path.
- Validation test: only `100`, `300`, `1000` tail sizes are accepted.
- Validation test: empty or unsafe container identifiers are rejected.
- Contract check: docs, TypeScript types, Rust serde structs, mocks, and command registration are updated together.

### 7. Wrong vs Correct

#### Wrong

```rust
// Frontend-controlled command string can smuggle arbitrary shell.
ssh.exec(host_id, RemoteCommand::Raw(format!("docker logs {}", payload.command)));
```

#### Correct

```rust
// Backend-owned command shape; only bounded tail and validated container id vary.
ssh.exec(host_id, RemoteCommand::DockerLogs { container_id, tail_lines });
```

验收：

- 前端无法让后端执行任意 shell。
- SSH 连接失败能区分认证失败、网络失败、host key 问题。

## Scenario: Docker 容器管理命令

### 1. Scope / Trigger

- Trigger: Docker 面板明确扩展为轻量管理工作区。
- Scope: 允许单容器 `start`、`stop`、`restart`、`remove`、`forceRemove`。
- Safety: 管理动作必须是后端固定枚举；前端不能传 Docker 子命令、flags 或 shell 字符串。
- Out of scope: `exec`、任意 flags、image/volume/network 管理、Compose 操作。

### 2. Signatures

```rust
docker_container_action(host_id: String, container_id: String, action: DockerContainerAction) -> Result<DockerContainerActionResult, AppError>
```

### 3. Contracts

- request: `hostId`, `containerId`, `action: "start" | "stop" | "restart" | "remove" | "forceRemove"`
- response: `hostId`, `containerId`, `action`, `completedAt` (Unix milliseconds)
- `containerId` must be validated before command construction.

### 4. Fixed Command Mapping

- `start` -> `docker start <container>`
- `stop` -> `docker stop <container>`
- `restart` -> `docker restart <container>`
- `remove` -> `docker rm <container>`
- `forceRemove` -> `docker rm -f <container>`

### 5. Validation & Error Matrix

- Missing host -> `HOST_NOT_FOUND`
- Empty / unsafe `containerId` -> `CONFIG_INVALID`
- Missing Docker binary / unsupported remote -> `REMOTE_UNSUPPORTED`
- Docker permission denied or command failure -> `REMOTE_COMMAND_FAILED`
- SSH authentication / connection / host-key failures -> existing SSH error mapping

### 6. Tests Required

- Validation test: empty or unsafe container identifiers are rejected.
- Serialization test: `forceRemove` round-trips as camelCase.
- Command mapping test: `forceRemove` renders fixed `docker rm -f <container>`.
- Contract check: docs, TypeScript types, Rust serde structs, mocks, and command registration are updated together.

## Scenario: Docker Compose 管理命令

### 1. Scope / Trigger

- Trigger: Docker 面板扩展为 Compose-aware 工作区。
- Scope: 允许基于 Docker Compose labels 的 `restartService`、`rebuildService`、`rebuildProject`。
- Safety: Compose 命令必须由后端固定枚举和 label-derived metadata 构造；前端不能传 Compose path、service、flags 或 shell 字符串。
- Out of scope: 编辑 compose 文件、任意 profiles/env files/flags、`down`、volume 删除、image prune、network 删除、数据库 reset。

### 2. Signatures

```rust
docker_compose_action(host_id: String, container_id: String, action: DockerComposeAction) -> Result<DockerComposeActionResult, AppError>
```

### 3. Contracts

- `docker_container_list` response item may include `compose?: { project, service, workingDir, configFiles }`.
- `docker_compose_action` request: `hostId`, `containerId`, `action: "restartService" | "rebuildService" | "rebuildProject"`
- `docker_compose_action` response: `hostId`, `containerId`, `action`, `project`, optional `service`, `completedAt` (Unix milliseconds)
- Compose metadata comes only from Docker labels:
  - `com.docker.compose.project`
  - `com.docker.compose.service`
  - `com.docker.compose.project.working_dir`
  - `com.docker.compose.project.config_files`

### 4. Validation & Error Matrix

- Missing host -> `HOST_NOT_FOUND`
- Empty / unsafe `containerId` -> `CONFIG_INVALID`
- Missing or incomplete Compose labels -> `CONFIG_INVALID` for `docker_compose_action`
- Unsafe project/service identifier -> `CONFIG_INVALID`
- Non-absolute or control-character-containing working/config path -> `CONFIG_INVALID`
- Missing Docker / Compose support on remote -> `REMOTE_UNSUPPORTED` or `REMOTE_COMMAND_FAILED` depending on CLI error shape
- Docker permission denied or command failure -> `REMOTE_COMMAND_FAILED`
- SSH authentication / connection / host-key failures -> existing SSH error mapping
- `docker_container_list` parser must preserve trailing empty label columns from Docker format output; incomplete Compose labels are omitted from list metadata so the UI hides Compose controls, while `docker_compose_action` still returns `CONFIG_INVALID`.

### 5. Good/Base/Bad Cases

- Good: selected Compose service with safe labels can run `rebuildService` through fixed args.
- Base: non-Compose containers are still listed, but `compose` is omitted and UI hides Compose controls.
- Bad: frontend cannot provide a custom `-f`, `--profile`, `down`, `exec`, or shell fragment.

### 6. Tests Required

- Parser test: Compose labels produce optional metadata.
- Parser test: non-Compose rows keep `compose` omitted.
- Validation test: unsafe service names and non-absolute paths are rejected.
- Command mapping test: service rebuild and project rebuild render fixed command strings.
- Contract check: docs, TypeScript types, Rust serde structs, mocks, and command registration are updated together.

### 7. Wrong vs Correct

#### Wrong

```rust
ssh.exec(host_id, RemoteCommand::Raw(payload.compose_command));
```

#### Correct

```rust
ssh.exec(host, RemoteCommand::DockerComposeAction {
    project,
    working_dir,
    config_files,
    service,
    action,
});
```

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
