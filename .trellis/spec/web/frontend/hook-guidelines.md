# Hook 规范 (Hook Guidelines)

> 来源：`AGENTS.md`、`docs/roles/frontend.md`、`web/src/lib/tauriClient.ts`、`web/src/i18n/useI18n.ts`。

## Tauri 访问规则

- 组件不能直接导入 Tauri API。
- 对命令和事件使用前端客户端抽象。
- 将 Mock 和真实客户端置于相同的接口后面。

## Tauri Client 抽象

创建 `/web/src/lib/tauriClient.ts`：

- 包装 `invoke`。
- 包装 `listen`。
- 统一把后端错误转换成 `AppError`。
- 暴露前端只需要的函数。

同时创建 `/web/src/mocks/mockTauriClient.ts`，使用同样接口返回假数据。这样前端可以在后端没完成前继续开发。

验收：

- `mock` 和 `tauri` 两种 client 可以通过环境变量或运行时开关切换。
- 组件不直接 import `@tauri-apps/api`。

## 当前文件示例

- `web/src/lib/tauriClient.ts`
- `web/src/mocks/mockTauriClient.ts`
- `web/src/i18n/useI18n.ts`

## 常见错误

- 执行 SSH。
- 在远程服务器上运行 shell 命令。
- 直接读取远程文件。
- 存储凭据。
