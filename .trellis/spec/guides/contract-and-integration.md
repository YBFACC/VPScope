# 契约与联调规范

> 来源：已归档的 `AGENTS.md`、`docs/roles/contracts.md`、`docs/roles/README.md`、`docs/roles/integration-test.md`、`docs/roles/integration-checklist.md`。

## 事实来源

- `docs/roles/contracts.md`：前端/后端命令、事件和数据契约。
- 前端应在 `/web/src/types/contracts.ts` 中维护这些类型。后端 Rust 结构体应通过 `serde` 序列化出相同字段名。
- 前端只依赖这些命令和事件，不依赖后端内部实现；后端只保证这些结构稳定，不关心前端具体布局。

## 全局契约约定

- 请求/响应：Tauri `invoke(command, payload)`。
- 实时数据：Tauri event。
- 错误返回：所有命令返回统一 `AppError`。
- 时间字段：统一使用 Unix milliseconds。
- 字节字段：统一使用 bytes。
- 百分比字段：统一使用 `0` 到 `100` 的 number。
- 实时指标通过 Tauri 事件推送。

## 契约变更规则

当更改命令、事件、数据形状或错误代码时：

1. 更新 `docs/roles/contracts.md`。
2. 更新前端 TypeScript 类型。
3. 更新 Rust serde 结构体。
4. 更新 Mock 数据和测试。
5. 验证 UI 组件或解析器代码中是否遗留了旧的假设。

命令、事件、数据结构或错误码发生变化时，必须同步更新契约文档、前端类型、Rust serde 结构、mock 数据和测试。

## 错误代码

使用来自契约的稳定错误代码，包括：

- `CONFIG_INVALID`
- `HOST_NOT_FOUND`
- `SSH_AUTH_FAILED`
- `SSH_CONNECT_FAILED`
- `SSH_HOST_KEY_CHANGED`
- `SSH_HOST_KEY_UNKNOWN`
- `REMOTE_COMMAND_FAILED`
- `REMOTE_UNSUPPORTED`
- `PARSER_FAILED`
- `INTERNAL`

前端应该向用户展示这些代码对应的面向用户的状态。后端应该在不泄漏机密的情况下保留有用的调试细节。

## 联调检查

- 验证 TypeScript 类型、Rust serde 输出、命令、事件和 Mock 数据是否符合契约。
- 为空闲、繁忙和错误状态创建 Mock 快照。
- 为 Linux 命令输出添加解析器 fixtures。
- 当用户提供凭据时，在真实的 SSH VPS 上验证应用程序的行为。
- 前后端字段完全一致。
- Mock 数据覆盖主要 UI 状态。
- 真实 VPS 可以连接并采集。
- 错误状态可恢复。
- Parser 有测试。
- 打包产物能运行。

## 验证顺序

在适用的情况下，按以下顺序运行验证：

1. 针对更改行为的有针对性的单元测试。
2. 类型检查或 Lint 检查。
3. 受影响包的构建检查。
4. 最小的冒烟测试。

后端单元测试必须有 60 秒的硬超时限制。
