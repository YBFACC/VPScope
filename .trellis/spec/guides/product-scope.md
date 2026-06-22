# 产品范围规范

> 来源：已归档的 `AGENTS.md`、`docs/roles/README.md`。

项目约束使用来源文档原句，不做词替换。

## 产品定位

VPScope 通过原生桌面体验监控服务器健康和资源使用情况。

主要产品目标：

- 构建一个基于 Tauri v2 的 macOS 优先的桌面应用。
- 前端使用 React、TypeScript、Vite 和 Tailwind CSS。
- 在 Tauri 的后端使用 Rust，用于处理 SSH、服务器交互、本地配置、凭证、解析和事件流。
- 作为 MVP 路径，支持基于 SSH 的无 Agent VPS 监控。
- 显示 CPU、内存、磁盘、网络、负载、正常运行时间 (uptime) 和进程信息。
- 保持 UI 密集、快速、稳定，适合长时间运行的监控。
- 保持视觉样式由主题驱动。不要在组件中硬编码核心的视觉决定。

MVP 的非目标：

- 不要构建营销落地页。
- 不要求在 VPS 上安装服务器 agent。
- 不实现破坏性的远程操作，如 kill、重启、删除或服务控制。
- 不添加 Docker、Kubernetes、GPU、告警、历史数据库或多主机聚合仪表板，除非后续任务明确要求。

## 当前事实来源

- `.trellis/spec/guides/product-scope.md`
- `.trellis/spec/guides/contract-and-integration.md`
- `.trellis/spec/web/frontend/index.md`
- `.trellis/spec/src-tauri/backend/index.md`
- `docs/roles/contracts.md`：API shape 参考。

## 归档规则

- 项目约束归档到 `.trellis/spec/` 后，原文档中对应约束必须删除，只保留入口链接或 API shape 参考。
- 不要让 `AGENTS.md`、`Style.md`、`README.md`、`docs/vpscope-plan.md` 或 `docs/roles/` 与 `.trellis/spec/` 保留同一条项目约束。
- 检查方式：用原句搜索源文档，确认归档内容只在 `.trellis/spec/` 中命中。

## 基本原则

- 前端不直接执行 SSH 或 shell 命令。
- 后端不处理视觉布局，但需要提供稳定、类型清晰的数据结构。
- 所有跨边界通信都通过 Tauri command 或 event。
- 主题样式只通过 theme token 和 CSS variables 暴露给组件。
- 远程服务器操作必须默认只读，MVP 不实现 kill/restart 等破坏性动作。

## 硬性红线

不要做：

- 将 SSH 逻辑放在前端。
- 允许前端执行任意的本地或远程 shell 命令。
- 将机密信息存储在普通配置文件中。
- 跳过 known_hosts 处理。
- 在 MVP 中实现破坏性的远程操作。
- 将视觉主题硬编码到仪表板组件中。
- 用登陆页面或通用管理模板替换该应用程序。
- 在不更新文档、前端类型、后端结构体、Mocks 和测试的情况下更改接口契约。
