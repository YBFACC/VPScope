# VPScope

VPScope 是一个面向 macOS 的 VPS 监控桌面应用，目标是提供接近 `btop` 的信息密度、刷新速度和操作效率，同时保留原生桌面应用更稳定、更适合长期挂着查看的体验。

项目使用 `Tauri v2 + Rust + React + TypeScript + Tailwind CSS` 构建，MVP 采用 agentless SSH 方案：不在服务器安装 agent，通过 SSH 读取系统指标并在本地桌面中展示。

## Why VPScope

- 面向运维和开发者的高密度监控 UI，不是营销型 dashboard
- macOS-first，优先关注桌面常驻、快速切换、多主机查看体验
- agentless SSH，尽量复用已有 `~/.ssh/config`、key 和 agent 工作流
- 前后端边界清晰：前端负责展示，Rust 后端负责 SSH、解析、事件流和本地安全存储
- 主题驱动设计，颜色和核心视觉规则不硬编码在业务组件里

## Current Status

仓库当前已经不是纯文档状态，已经包含一版可继续迭代的应用骨架：

- `web/` 中的 React 桌面监控界面
- `src-tauri/` 中的 Tauri v2 + Rust 后端
- 主机配置管理、连接测试、指标订阅、进程列表、托盘设置等命令入口
- mock 数据模式，前端可在后端未完全联通时独立开发和预览
- CPU、内存、磁盘、网络、进程、详情等监控面板
- `/proc`、`df -P`、`ps` 等 Linux 指标解析基础模块

目前项目仍处于早期开发阶段，重点是把产品方向、契约层和核心监控体验先打稳。

## MVP Scope

MVP 目标包含：

- 通过 SSH 监控远程 VPS
- 展示 CPU、内存、磁盘、网络、负载、运行时间、进程信息
- 处理 `known_hosts`、连接错误、认证失败、部分数据失败等状态
- 支持 mock 模式和真实 Tauri/Rust 模式两套前端接入方式

MVP 明确不包含：

- 在服务器上安装 agent 作为前置条件
- destructive remote actions，例如 kill、restart、service control
- Docker、Kubernetes、GPU、历史数据库、告警系统、多主机聚合大盘

## Tech Stack

- Desktop: `Tauri v2`
- Backend: `Rust`
- Frontend: `React 19 + TypeScript + Vite`
- Styling: `Tailwind CSS v4 + CSS variables`
- State: `Zustand`
- Virtualized list: `@tanstack/react-virtual`
- SSH: Rust 层通过 `openssh` 维护连接与采集

## Project Structure

```text
VPScope/
  docs/                 Product, contract, and role documents
  web/                  React + TypeScript + Tailwind frontend
  src-tauri/            Tauri v2 Rust backend
  AGENTS.md             Working contract for coding agents
```

## Quick Start

### Requirements

- macOS
- Node.js 20+
- `pnpm`
- Rust toolchain
- Tauri v2 build prerequisites

### Install

```bash
pnpm install
```

### Run Frontend In Mock Mode

适合只看 UI 或前端开发：

```bash
pnpm web:dev
```

默认会走 mock client，不依赖 Tauri 运行时。

### Run Desktop App

启动完整 Tauri 桌面应用：

```bash
pnpm dev
```

### Build

```bash
pnpm build
```

## Scripts

```bash
pnpm web:dev         # 仅启动前端开发服务器
pnpm web:typecheck   # 前端 TypeScript 检查
pnpm web:build       # 构建前端
pnpm dev             # 启动 Tauri 桌面应用
pnpm build           # 构建桌面应用
```

## Architecture

```text
React UI
  -> Tauri commands / events
Rust app core
  -> host config / credentials / SSH / parsers / metrics scheduler
Remote VPS
  -> /proc + fixed read-only commands
```

设计原则：

- 前端不直接执行 SSH
- 前端不拼接任意 shell 命令
- 远程采集命令固定且白名单化
- 敏感凭据不落普通配置文件
- 主题通过 token 和 CSS variables 驱动

## Documentation

- [产品方案](./docs/vpscope-plan.md)
- [角色协作说明](./docs/roles/README.md)
- [前后端契约](./docs/roles/contracts.md)
- [前端执行文档](./docs/roles/frontend.md)
- [后端执行文档](./docs/roles/backend-rust.md)
- [联调与验证](./docs/roles/integration-test.md)

## Roadmap

- 完善真实 SSH 采集链路和 session 复用
- 打磨连接状态、错误态和 known_hosts 交互
- 提升进程表、历史曲线和高频刷新下的稳定性
- 优化托盘展示和多主机切换体验
- 在 macOS 之外逐步评估 Linux / Windows 桌面支持

## Contributing

欢迎 issue、讨论和 PR。提交改动前，建议先阅读：

- [`AGENTS.md`](./AGENTS.md)
- [`docs/roles/contracts.md`](./docs/roles/contracts.md)

如果你的改动涉及前后端数据结构、命令或事件，请同步更新契约文档、类型定义、mock 数据和测试。

## License

This project is licensed under the [MIT License](./LICENSE).
