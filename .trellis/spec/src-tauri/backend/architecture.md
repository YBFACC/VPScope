# 架构与目录

> 来源：`AGENTS.md`、`docs/roles/backend-rust.md`、`docs/vpscope-plan.md`、`src-tauri/src/`。

## 后端 Rust 智能体

在 `/src-tauri` 目录内工作。

职责：

- 构建 Tauri v2 应用配置和 Rust 命令处理器。
- 实现主机配置 CRUD、SSH 连接测试、会话复用、指标收集、解析器逻辑、事件流、凭据存储和 known_hosts 验证。
- 保持所有远程服务器命令固定并列入白名单。
- 序列化 Rust 结构体以匹配 `docs/roles/contracts.md`。
- 为解析器和数据转换逻辑提供单元测试。

不要做：

- 更改 `/web/src/components` 或 `/web/src/features` 中的视觉布局或组件样式，除非明确要求。
- 向前端暴露 shell 执行权限。
- 在普通配置文件中存储密码、私钥或密码短语 (passphrases)。

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

## 实现风格

- 保持后端解析与 SSH 执行分离。
- 保持调度器逻辑与一次性收集逻辑分离。
- 将凭证处理放在一个狭窄的接口后面。
- 避免无关的重构。
- 不要静默更改产品范围。
- 优先选择短函数、浅层嵌套、尽早返回、具名常量和较少的参数。
- 保持业务逻辑与具体实现解耦；通过参数或接口注入依赖项。
- 优先考虑不可变数据流。返回新值而不是改变参数或全局状态。
- 注释应解释意图或权衡，而不是重述代码已经说明的内容。
- 如果更改行为，除非明确需要兼容性，否则保持 diff 具有针对性，同时删除死代码。
- 处理边缘情况时使用清晰的失败路径，而不是假设理想的输入。

## 当前文件示例

- `src-tauri/src/app_state.rs`
- `src-tauri/src/commands/hosts.rs`
- `src-tauri/src/commands/metrics.rs`
- `src-tauri/src/config/host_config.rs`
- `src-tauri/src/errors.rs`
- `src-tauri/src/events.rs`
- `src-tauri/src/metrics/collector.rs`
- `src-tauri/src/metrics/scheduler.rs`
- `src-tauri/src/parsers/cpu.rs`
- `src-tauri/src/ssh/client.rs`
- `src-tauri/src/ssh/session_pool.rs`
