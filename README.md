# VPScope

VPScope 是一个面向 macOS 的 VPS 监控桌面应用，目标是提供接近 `btop` 的信息密度、刷新速度和操作效率，同时保留原生桌面应用更稳定、更适合长期挂着查看的体验。

项目使用 `Tauri v2 + Rust + React + TypeScript + Tailwind CSS` 构建，MVP 采用 agentless SSH 方案：不在服务器安装 agent，通过 SSH 读取系统指标并在本地桌面中展示。

## Screenshots

![VPScope dashboard](./docs/images/image1.png)

<p align="center">
  <img src="./docs/images/image2.png" alt="VPScope overview" width="49%" />
  <img src="./docs/images/image3.png" alt="VPScope host details" width="49%" />
</p>

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
- CPU、内存、磁盘、网络、进程、详情等监控面板，支持面板排序、折叠和高密度展示
- `/proc`、`df -P`、`ps` 等 Linux 指标解析基础模块，以及采集 profile、最后快照缓存和 mock 数据刷新链路
- CPU 告警通知、终端打开、设置页、托盘常驻和 macOS release workflow 等桌面应用配套能力

目前项目仍处于早期开发阶段，重点是把产品方向、契约层和核心监控体验先打稳。

## Recent Updates

最近几天（2026-05-25 至 2026-05-27）的提交主要补齐了这些能力：

- Dashboard 交互：支持监控面板排序和折叠，优化 CPU、内存、磁盘、网络、进程和详情面板的视觉密度，并修正网络 sparkline、进度条和图表字号在紧凑布局中的表现。
- 监控数据链路：加入 metrics collection profiles 和 last snapshot cache，改善空闲断连后的稳定性，减少进程列表刷新时的闪烁。
- 通知与设置：新增 CPU 使用率告警通知、通知权限接入和告警设置存储，同时稳定设置弹窗布局。
- 主机与终端：支持从主机侧边栏打开终端，新增终端设置存储，并修正 WezTerm 启动逻辑以复用新 tab。
- 桌面体验：关闭主窗口时隐藏到后台而不是直接退出，支持不同层级的常驻监控模式。
- 发布与维护：新增 macOS release workflow、签名和 notarization 文档，更新应用图标，并加入前端 mock 模式测试说明。

### Resident Modes

VPScope 的常驻体验分成几种模式，方便在信息密度和资源占用之间切换：

- 主窗口详情模式：选中单台主机时使用 `active` 采集 profile，刷新更频繁，并包含进程列表等完整面板数据。
- 总览模式：主窗口打开但查看多主机总览时使用 `overview` profile，适合快速扫视多台 VPS 的 CPU、内存、磁盘和网络状态。
- 菜单栏常驻模式：关闭主窗口后应用不会退出，会隐藏到后台并继续用 `tray` profile 做低频轻量采样；菜单栏可显示文字状态或圆环状态。
- 告警后台模式：启用 CPU 告警的主机即使不在当前详情页、甚至主窗口隐藏，也会保持轻量 `tray` profile 采样，用于触发 macOS 通知。
- 退出模式：只有通过 Cmd+Q 或菜单栏中的 Quit VPScope 才真正退出应用并停止后台任务。

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

### macOS Release Signing

GitHub Actions 会在打 tag 时生成 draft release。macOS 从浏览器下载的 `.app`/`.dmg` 需要代码签名；面向普通用户分发时，还需要使用 `Developer ID Application` 证书完成 Apple notarization。否则 Gatekeeper 可能提示应用“已损坏，无法打开”。

仓库当前的 release workflow 分两种情况：

- 默认：不需要 Apple Developer secrets，使用 ad-hoc signing，仅适合开发和内测分发；用户仍可能需要在系统设置中手动允许运行，或移除 quarantine 标记。
- 正式分发：把 GitHub repository variable `MACOS_RELEASE_SIGNING` 设为 `true`，并配置 Developer ID 证书和 notarization secrets。只有这条路径会把 Apple 签名变量传给 Tauri。

要发布 Gatekeeper-ready 构建，先在 GitHub repository variables 中配置：

```text
MACOS_RELEASE_SIGNING=true
```

再在 GitHub repository secrets 中配置：

```text
APPLE_CERTIFICATE          # Developer ID Application .p12 的 base64 内容
APPLE_CERTIFICATE_PASSWORD # 导出 .p12 时设置的密码
```

然后选择一种 notarization 凭据：

```text
APPLE_ID
APPLE_PASSWORD             # Apple ID app-specific password
APPLE_TEAM_ID
```

或：

```text
APPLE_API_ISSUER
APPLE_API_KEY
APPLE_API_KEY_PRIVATE      # App Store Connect AuthKey_*.p8 文件内容
```

如果已经下载到本地的旧构建仍出现“已损坏”提示，可以先删除 quarantine 标记用于本机验证：

```bash
xattr -dr com.apple.quarantine /Applications/VPScope.app
```

这只是开发/内测绕过方式，正式 release 应以签名和公证后的产物为准。

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
