# VPScope macOS App 方案

## 目标

VPScope 是一个用于监控本机和远程 VPS 资源使用情况的 macOS 桌面应用。整体体验参考 btop 的信息密度、实时感和键盘友好操作，但交互和视觉不直接复刻终端，而是做成适合桌面应用长期打开的监控面板。

核心目标：

- macOS 桌面应用，优先支持 Apple Silicon 和 Intel Mac。
- 使用 Tauri + React + Tailwind CSS 构建。
- 支持通过 SSH 登录 VPS，无需先在服务器安装 agent。
- 展示 CPU、内存、磁盘、网络、进程、负载、运行时间等指标。
- 样式不写死，所有颜色、字体、间距、图表色阶通过 theme 定义。
- 允许后续扩展到 Windows/Linux 桌面端，以及可选的 server agent 模式。

## Tauri 是否合适

结论：Tauri 很适合这个项目。

原因：

- 桌面壳轻量，macOS 上包体和运行开销通常比 Electron 更克制。
- Rust 后端适合处理 SSH、系统命令、指标采集、并发任务和本地安全存储。
- React + Tailwind CSS 可以快速实现复杂仪表盘 UI。
- Tauri v2 有明确的 capability/permission 模型，适合把前端权限限制在少量自定义命令上，避免前端直接执行任意 shell。
- 后续跨平台空间好，同一套前端可以继续支持 Linux/Windows。

需要注意：

- Tauri 的 WebView 不等于完整 Chrome，部分浏览器 API 和渲染细节需要测试。
- SSH、known_hosts、密钥解密、长连接复用等能力建议放在 Rust 层，不要放到前端。
- 实时图表如果刷新频率高，需要控制 React 重渲染，必要时用 Canvas/WebGL 绘制曲线。

参考：

- Tauri v2: https://v2.tauri.app/
- Tauri Vite 集成: https://v2.tauri.app/start/frontend/vite/
- Tauri Capabilities: https://v2.tauri.app/security/capabilities/
- Tailwind CSS Vite: https://tailwindcss.com/docs/installation/using-vite

## 技术栈

推荐栈：

- Desktop: Tauri v2
- Backend: Rust
- Frontend: React + TypeScript + Vite
- Styling: Tailwind CSS v4 + CSS variables
- State: Zustand 或 TanStack Store
- Data fetching/event stream: Tauri commands + Tauri events
- Charts:
  - 初期：自研 lightweight SVG/Canvas sparkline
  - 高频图：Canvas
  - 表格虚拟滚动：TanStack Virtual
- Local storage:
  - 配置：Tauri app config dir 中的 JSON/TOML
  - 凭据：macOS Keychain
  - 历史指标：SQLite，可作为第二阶段
- SSH:
  - Rust 层实现 session manager
  - 优先 agentless SSH
  - 后续可加 server agent 提升采集精度和性能

## 总体架构

```text
React UI
  |
  | invoke commands / listen events
  v
Tauri Command API
  |
  v
Rust App Core
  |-- Host manager
  |-- SSH session manager
  |-- Metric collectors
  |-- Parser layer
  |-- Theme/config manager
  |-- Credential manager
  v
Remote VPS over SSH
```

### 模块拆分

```text
src/
  app/
    App.tsx
    routes/
    providers/
  features/
    dashboard/
    hosts/
    processes/
    settings/
    themes/
  components/
    panel/
    chart/
    table/
    toolbar/
  theme/
    tokens.ts
    presets/
    applyTheme.ts
src-tauri/
  src/
    main.rs
    commands/
    hosts/
    ssh/
    metrics/
    parsers/
    security/
    config/
```

## SSH 采集方案

### 第一阶段：Agentless SSH

用户配置 VPS：

- host
- port
- username
- auth type: password / private key / ssh-agent
- key path 或 key 内容
- passphrase
- known_hosts 策略
- refresh interval

Rust 后端建立 SSH 连接后，周期性执行只读命令或读取 `/proc` 文件：

```text
/proc/stat         CPU 总量、每核心使用率
/proc/meminfo      内存、缓存、swap
/proc/loadavg      load average
/proc/uptime       uptime
/proc/net/dev      网卡吞吐
/proc/diskstats    磁盘 IO
df -P              文件系统使用率
ps                 进程列表
uname              系统基础信息
```

MVP 当前保留系统 OpenSSH 路径以兼容用户现有 `~/.ssh/config`、key 和 agent，但运行时必须降低连接和命令开销：

- 使用 `openssh` 的 `native-mux`，通过 OpenSSH control master 维持连接，并用 native mux socket 执行后续 command。
- 按 host 复用 SSH session；host 配置变化、连接中断或最后一个订阅取消后进入 idle timeout，再释放缓存 session。
- 默认使用严格 known_hosts 校验；未知或变化的 host key 返回结构化错误，由用户显式确认后再写入 known_hosts。
- 指标刷新使用后端固定批量脚本，不把前端输入拼进远程 shell。
- 快路径每个刷新周期读取 `/proc/loadavg`、`/proc/uptime`、`/proc/stat`、`/proc/meminfo`、`/proc/net/dev`、`/proc/diskstats`。
- 慢路径按 profile 低频刷新 `uname` 和 `df -P`，其它帧复用缓存。
- 进程列表只在当前详情页 `active` profile 刷新；总览和菜单栏 `overview`/`tray` profile 不运行 `ps`。
- 最近一次成功 snapshot 缓存在后端内存中，前端打开窗口或切换 host 时先读取缓存，再等待实时刷新。

前端不传任意 shell 字符串，只传结构化动作：

```ts
invoke("metrics_last_snapshot", { hostId });
invoke("metrics_subscribe", { hostId, intervalMs, profile: "active" });
invoke("process_list", { hostId, sortBy: "cpu", limit: 200 });
```

Rust 内部将动作映射到固定命令白名单。

### 第二阶段：可选 server agent

当用户需要更低延迟、更详细的进程树、容器指标、GPU、温度传感器时，可提供一个轻量 agent：

- VPS 上运行 `vpscope-agent`
- 桌面端通过 SSH tunnel 或 HTTPS 连接
- agent 负责本机采集，桌面端负责展示

这个阶段不是 MVP 必需项。

## 指标数据模型

建议统一成 snapshot/event 两层。

```ts
type HostSnapshot = {
  hostId: string;
  ts: number;
  system: {
    hostname: string;
    os: string;
    uptimeSec: number;
    loadAvg: [number, number, number];
  };
  cpu: {
    totalPercent: number;
    cores: Array<{ id: string; percent: number }>;
    history: number[];
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
  processes: Array<ProcessInfo>;
};
```

采集层保留最近 N 个 snapshot，UI 层只消费派生数据：

- 当前值
- 过去 30/60/300 秒历史
- 排序后的进程列表
- 告警状态

## UI 方案

视觉方向：btop 风格的信息密度 + macOS 原生桌面应用的稳定感。

主界面布局：

```text
┌─────────────────────────────────────────────┐
│ titlebar: host selector / interval / search │
├─────────────────────┬───────────────────────┤
│ CPU panel           │ Process panel          │
├──────────┬──────────┤                       │
│ Memory   │ Disks    │                       │
├──────────┴──────────┼───────────────────────┤
│ Network panel       │ Events / details       │
└─────────────────────┴───────────────────────┘
```

核心组件：

- `MetricPanel`: 带标题、边框、状态色、操作区的通用面板
- `BarMeter`: 类似 btop 的分段条
- `Sparkline`: 小型历史曲线
- `CoreGrid`: CPU core 使用率矩阵
- `ProcessTable`: 支持排序、过滤、虚拟滚动
- `HostSidebar`: 多 VPS 切换和连接状态
- `CommandPalette`: 快速切换 host、搜索进程、打开设置
- `ThemeEditor`: 调整 theme token 并即时预览

交互：

- 支持鼠标和键盘。
- `j/k` 或方向键移动进程选中项。
- `/` 搜索进程。
- `r` 切换排序方向。
- `1/2/3/4` 聚焦 CPU/Mem/Net/Proc 面板。
- 点击 host 可切换服务器。

## Theme 设计

要求：不在组件里写死颜色、边框、阴影、图表色阶。

建议三层：

1. Theme preset: JSON/TS 定义主题名称和 token。
2. CSS variables: 运行时挂到 `:root` 或 `[data-theme="xxx"]`。
3. Tailwind utilities: 通过 CSS variables 使用主题值。

示例 token：

```ts
export type VPScopeTheme = {
  id: string;
  name: string;
  mode: "dark" | "light";
  colors: {
    bg: string;
    panel: string;
    panelMuted: string;
    border: string;
    text: string;
    textMuted: string;
    cpu: string;
    memory: string;
    disk: string;
    networkRx: string;
    networkTx: string;
    warning: string;
    danger: string;
    accent: string;
  };
  radius: {
    panel: string;
    control: string;
  };
  font: {
    ui: string;
    mono: string;
  };
  chart: {
    gridOpacity: number;
    barSteps: string[];
  };
};
```

CSS variables：

```css
:root {
  --color-bg: #050605;
  --color-panel: #090b09;
  --color-border: #314238;
  --color-text: #e8ede8;
  --color-text-muted: #7f887f;
  --color-cpu: #8ff0b4;
  --color-memory: #f4d35e;
  --color-network-rx: #b56cff;
  --color-network-tx: #4dd8ff;
  --radius-panel: 6px;
  --font-ui: Inter, system-ui, sans-serif;
  --font-mono: "JetBrains Mono", "SF Mono", monospace;
}
```

组件示例：

```tsx
<section className="rounded-[var(--radius-panel)] border border-[var(--color-border)] bg-[var(--color-panel)] text-[var(--color-text)]">
  ...
</section>
```

推荐内置主题：

- `btop-classic`: 黑底、高对比、霓虹状态色。
- `mac-graphite`: 更接近 macOS 的深灰低饱和主题。
- `solarized-ops`: 长时间监控更柔和。
- `light-lab`: 浅色调试主题。

## 安全设计

SSH 和系统命令是本项目的主要风险点。

原则：

- 前端不直接执行命令。
- 前端只能调用受控 Tauri command。
- Tauri capability 只开放必要命令。
- Rust 层维护命令白名单。
- 用户凭据存 macOS Keychain，不落普通配置文件。
- private key passphrase 不写日志。
- known_hosts 默认严格校验，首次连接需要用户确认 fingerprint。
- 所有远程命令只读，危险操作不进入 MVP。
- 日志默认脱敏 host、username、token、key path。

Tauri capability 方向：

```json
{
  "identifier": "main-capability",
  "windows": ["main"],
  "permissions": [
    "core:default"
  ]
}
```

自定义命令建议只暴露：

```text
host_list
host_create
host_update
host_delete
host_test_connection
metrics_last_snapshot
metrics_subscribe
metrics_unsubscribe
process_list
theme_list
theme_apply
settings_get
settings_update
```

## 性能策略

- SSH session 按 host 复用，不为每个面板新建连接。
- 采集分 `active`、`overview`、`tray` 三档：详情页 500ms-10000ms，总览 5000ms-30000ms，菜单栏/隐藏窗口 30000ms-300000ms。
- 进程列表只在 `active` profile 刷新，避免长期静默或总览页反复运行 `ps`。
- 后端保留 last-known snapshot，窗口打开时先显示最近状态。
- 最后一个订阅取消后延迟释放 SSH session，兼顾快速重新打开和长期静默低资源。
- 采集任务和 UI 刷新解耦。
- 高频历史数据使用 ring buffer。
- React 组件按 panel 拆分，避免全 dashboard 每秒重渲染。
- 大进程列表使用虚拟滚动。
- 图表优先 Canvas，减少大量 DOM 节点。

## MVP 范围

第一版建议只做这些：

- macOS Tauri app scaffold。
- React + Tailwind CSS + theme token 系统。
- Host 管理：新增、编辑、删除、测试 SSH。
- SSH password/private key 登录。
- 单 host 实时 dashboard。
- CPU、内存、磁盘、网络、进程列表。
- 主题切换：至少 2 个内置 theme。
- 刷新间隔配置。
- 基础错误状态：连接失败、认证失败、命令不可用、权限不足。

暂不做：

- 告警通知。
- 多 host 聚合总览。
- Docker/Kubernetes 指标。
- server agent。
- 历史数据库和长期趋势。
- 远程 kill 进程。

## 里程碑

### Milestone 1: 项目骨架

- 初始化 Tauri + React + TypeScript + Tailwind CSS。
- 建立基础目录结构。
- 建立 theme token 和 CSS variables。
- 做静态 dashboard mock。

验收：

- macOS 上 `tauri dev` 可启动。
- UI 能切换主题。
- 主面板结构接近最终布局。

### Milestone 2: SSH 连接

- 实现 host 配置模型。
- 实现 SSH 测试连接。
- 实现 known_hosts/fingerprint 确认流程。
- 凭据接入 macOS Keychain。

验收：

- 可以新增 VPS 并测试连接。
- 连接失败时有明确错误提示。

### Milestone 3: 指标采集

- 实现 CPU、内存、load、uptime 采集。
- 实现网络和磁盘采集。
- 实现进程列表采集。
- 建立 snapshot 数据模型。

验收：

- dashboard 每 2 秒稳定刷新。
- 数据与服务器上的 `top`/`btop`/`df` 基本一致。

### Milestone 4: Dashboard 体验

- 完成 btop 风格 panel。
- 完成历史曲线、分段条、进程表。
- 加入排序、过滤、键盘操作。
- 优化窗口尺寸变化。

验收：

- 1280x800 到 2560x1440 均可用。
- 长时间运行 30 分钟没有明显内存上涨。

### Milestone 5: 打包和测试

- macOS app icon、bundle metadata。
- 基础单元测试：parser、数据转换、theme。
- SSH mock/integration test。
- 打包产物验证。

验收：

- 可生成可安装的 macOS app。
- 主要 parser 有测试覆盖。

## 推荐初始化命令

```bash
pnpm create tauri-app@latest vpscope
```

选择：

- Package manager: pnpm
- UI template: React
- Language: TypeScript
- Rust backend: Tauri v2

进入项目后：

```bash
pnpm install
pnpm add zustand @tanstack/react-virtual clsx
pnpm add -D tailwindcss @tailwindcss/vite
pnpm tauri dev
```

## 后续决策点

- SSH Rust crate 选型：MVP 已采用 `openssh` + `native-mux`。后续只有在需要去掉系统 `ssh` 依赖、进一步压低连接开销或增强 host key/agent 控制时，再评估 `russh`、`ssh2`。
- 凭据存储：使用 Tauri plugin stronghold 还是直接接 macOS Keychain。
- 图表实现：SVG 是否足够，还是第一版直接 Canvas。
- 是否从 MVP 就支持多 host 总览。
- 是否支持导入 `~/.ssh/config`。
- 是否支持 terminal-like compact mode 和 desktop comfortable mode 两套密度。
