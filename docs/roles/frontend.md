# 前端角色：React + Tailwind Dashboard

## 角色目标

前端角色负责在 `/web` 中完成 VPScope 的用户界面、主题系统、状态管理、Tauri 调用封装和 Dashboard 体验。前端不直接连接 SSH，不执行 shell，不读取远程服务器文件。

最终交付：

- 可运行的 React + TypeScript + Tailwind CSS 前端。
- btop 风格但适合 macOS 桌面应用的 Dashboard。
- 可切换、可扩展的 theme token 系统。
- Host 管理界面。
- Mock 数据模式和 Tauri 联调模式。
- 对后端错误状态有清晰展示。

## 目录边界

前端只修改：

```text
web/
  index.html
  package.json
  vite.config.ts
  src/
    app/
    components/
    features/
    lib/
    mocks/
    stores/
    theme/
    types/
```

前端不要修改：

```text
src-tauri/
```

如果接口不满足 UI 需要，先更新 `docs/roles/contracts.md`，再和后端角色同步。

## 技术要求

- React + TypeScript。
- Tailwind CSS。
- 样式通过 CSS variables 和 theme token 注入。
- 组件不写死业务颜色，例如 CPU 绿色、内存黄色都来自 theme。
- 图表第一版可以使用 Canvas 或 SVG，但组件 API 要稳定。
- 大列表使用虚拟滚动，避免进程多时卡顿。
- 支持键盘操作和鼠标操作。

## 推荐目录结构

```text
web/src/
  app/
    App.tsx
    providers.tsx
  components/
    panel/
      MetricPanel.tsx
    meter/
      TerminalMeter.tsx
    chart/
      DotMatrixChart.tsx
    table/
      ProcessTable.tsx
    toolbar/
      TopToolbar.tsx
    empty/
      EmptyState.tsx
  features/
    dashboard/
      DashboardPage.tsx
      CpuPanel.tsx
      MemoryPanel.tsx
      DiskPanel.tsx
      NetworkPanel.tsx
      ProcessPanel.tsx
    hosts/
      HostForm.tsx
      HostConnectionBadge.tsx
    settings/
      SettingsPage.tsx
  lib/
    tauriClient.ts
    format.ts
    historyBuffer.ts
  mocks/
    mockHosts.ts
    mockSnapshots.ts
    mockTauriClient.ts
  stores/
    hostStore.ts
    metricsStore.ts
    uiStore.ts
  theme/
    types.ts
    presets.ts
    applyTheme.ts
    theme.css
  types/
    contracts.ts
```

## 详细实现步骤

### Step 1: 初始化 `/web`

1. 创建 Vite React TypeScript 项目。
2. 安装 Tailwind CSS。
3. 配置路径 alias，例如 `@/components`、`@/features`。
4. 建立 `App.tsx`，先渲染 Dashboard shell。
5. 加入基础 lint 和 typecheck 脚本。

建议脚本：

```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "typecheck": "tsc -b"
  }
}
```

验收：

- `pnpm --dir web dev` 可以启动。
- 页面能看到 Dashboard 基础框架。

### Step 2: 建立接口类型

1. 根据 [接口契约](/Users/ybf/code/VPScope/docs/roles/contracts.md) 创建 `/web/src/types/contracts.ts`。
2. 不要在组件里重复定义 `HostSnapshot`、`ProcessInfo` 等类型。
3. 所有 API client、store、mock 都从 `contracts.ts` 引入类型。

验收：

- 修改接口字段时，TypeScript 能提示所有受影响位置。

### Step 3: 建立 Tauri Client 抽象

创建 `/web/src/lib/tauriClient.ts`：

- 包装 `invoke`。
- 包装 `listen`。
- 统一把后端错误转换成 `AppError`。
- 暴露前端只需要的函数。

示例 API：

```ts
export type MetricsSnapshotHandler = (snapshot: HostSnapshot) => void;

export type VPScopeClient = {
  listHosts(): Promise<HostConfig[]>;
  createHost(payload: HostCreatePayload): Promise<HostConfig>;
  updateHost(payload: HostUpdatePayload): Promise<HostConfig>;
  deleteHost(id: HostId): Promise<void>;
  openTerminal(hostId: HostId): Promise<HostOpenTerminalResult>;
  testConnection(payload: HostTestConnectionPayload): Promise<HostTestConnectionResult>;
  getLastSnapshot(hostId: HostId): Promise<HostSnapshot | null>;
  subscribeMetrics(payload: MetricsSubscribePayload, onSnapshot: MetricsSnapshotHandler): Promise<() => Promise<void>>;
  listProcesses(payload: ProcessListPayload): Promise<ProcessInfo[]>;
  getTerminalSettings(): Promise<TerminalSettings>;
  updateTerminalSettings(settings: TerminalSettings): Promise<TerminalSettings>;
};
```

同时创建 `/web/src/mocks/mockTauriClient.ts`，使用同样接口返回假数据。这样前端可以在后端没完成前继续开发。

验收：

- `mock` 和 `tauri` 两种 client 可以通过环境变量或运行时开关切换。
- 组件不直接 import `@tauri-apps/api`。

### Step 4: 建立状态管理

建议拆三个 store：

- `hostStore`: host 列表、当前选中 host、连接状态。
- `metricsStore`: 当前 snapshot、历史 ring buffer、采集错误。
- `terminalSettingsStore`: 打开外部终端的普通偏好、打开状态和错误。
- `uiStore`: 当前主题、聚焦面板、搜索词、排序状态、刷新间隔。

实现要求：

- `HostSnapshot` 原始数据进入 `metricsStore`。
- 历史曲线不要无限增长，使用固定长度 ring buffer。
- 每个 panel 只订阅自己需要的字段，减少重渲染。

验收：

- 快速刷新 snapshot 时进程表不会无意义重渲染整个页面。
- 切换 host 时能清理旧订阅。

### Step 5: 实现 Theme 系统

创建 `/web/src/theme/types.ts`：

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
    borderStrong: string;
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
    grid: string;
    barTrack: string;
    barSteps: string[];
  };
};
```

创建 `/web/src/theme/presets.ts`：

- `btopClassic`
- `macGraphite`
- `lightLab`

创建 `/web/src/theme/applyTheme.ts`：

- 接收 theme。
- 写入 `document.documentElement.style.setProperty("--color-bg", theme.colors.bg)`。
- 设置 `data-theme`。
- 保存当前 theme id 到 localStorage。

组件写法要求：

```tsx
<section className="rounded-[var(--radius-panel)] border border-[var(--color-border)] bg-[var(--color-panel)]">
  ...
</section>
```

不要这样写：

```tsx
<section className="border-green-500 bg-black text-white">
  ...
</section>
```

验收：

- 切换主题时 Dashboard 所有颜色同步变化。
- 新增一个 theme preset 不需要改组件代码。

### Step 6: 实现基础布局

创建 Dashboard 页面：

- 左侧或顶部 Host 切换区。
- 顶部 Toolbar：当前 host、连接状态、刷新间隔、搜索入口。
- 主区域：CPU、Memory、Disk、Network、Process、Details。

布局要求：

- 1280x800 可用。
- 1440x900 是主要设计尺寸。
- 2560x1440 不要过度拉伸，内容应有最大宽度或合理 grid。
- 小窗口时进程表仍可滚动。

建议 grid：

```css
.dashboard-grid {
  display: grid;
  grid-template-columns: minmax(320px, 0.9fr) minmax(520px, 1.4fr);
  grid-template-rows: auto minmax(220px, 1fr) minmax(180px, 0.8fr);
}
```

验收：

- 所有 panel 在窗口缩放时不重叠。
- 面板标题、数值、图表、表格不会挤出容器。

### Step 7: 实现核心组件

`MetricPanel`：

- props: `title`、`accent`、`actions`、`children`、`status`。
- 显示 panel 边框、标题和右上角动作。

`TerminalMeter`：

- props: `value`、`color`、`label`、`toneScale`。
- 用 theme 的 bar track 和色阶。

`DotMatrixChart`：

- props: `values`、`color`、`max`、`rows`、`minColumns`、`maxColumns`、`toneScale`。
- 用密集矩阵呈现历史曲线，适配 btop 风格面板密度。

`ProcessTable`：

- 列：PID、Name、User、CPU、Memory、Command。
- 支持 sort、filter、selected row。
- 支持虚拟滚动。
- CPU/Memory 数字右对齐。

验收：

- 组件都能用 mock 数据独立渲染。
- 组件没有直接耦合 Tauri client。

### Step 8: 实现 Host Profile 管理

Host 管理界面包含：

- Host 列表。
- 新增 Host Profile 弹窗。
- 编辑 Host 表单。
- 测试连接按钮。
- 连接状态提示。

新增主路径：

- 默认展示从 `~/.ssh/config` 只读导入的 `Host` 列表。
- 选择 alias 后保存长期可复用 SSH profile。
- 导入保存时 `name = alias`，`address = alias`，认证方式为 `ssh_agent`，以复用系统 OpenSSH alias、`ssh-agent` 和 Keychain 行为。
- 如果导入条目缺少 `User`，提示用户回到 `~/.ssh/config` 补齐；VPScope 内不提供手动补齐入口。
- VPScope 不自动写入或修改用户的 `~/.ssh/config`。
- MVP 不提供高级手动配置、手填地址、private key profile 创建或 password/passphrase 输入。

交互要求：

- 保存前做基础校验。
- 测试连接时显示 loading。
- host key unknown 时打开确认弹窗，展示 fingerprint。
- 保存成功后自动选中新 host。

验收：

- 使用 mock client 时可以完整走 SSH config 导入、测试、保存、选中的流程。
- 无 SSH config 条目时提示先配置系统 `~/.ssh/config`。
- 缺少 `User` 的 SSH config 条目不能测试或保存，并提示回到系统 SSH config 补齐。

### Step 9: 接入实时指标

1. 用户选中 host 后先调用 `getLastSnapshot` 显示最近状态，再用 `subscribeMetrics({ hostId, profile: "active" })` 订阅实时指标。
2. 总览页用 `profile: "overview"` 订阅多 host，窗口隐藏或仅菜单栏监控时用 `profile: "tray"`。
3. 收到 snapshot 后写入 `metricsStore`。
4. Dashboard panel 从 store 读取数据。
5. 切换 host、窗口隐藏或卸载页面时取消不需要的高频订阅。
6. 发生 `metrics://error` 时保留上一次有效数据，并显示错误状态。

验收：

- Dashboard 可以连续刷新。
- 后端断开时 UI 不崩溃。
- 重新连接后数据恢复。

### Step 10: 体验打磨

需要完成：

- 快捷键：`/` 搜索、方向键选择进程、`r` 切换排序方向。
- 空状态：没有 host、未连接、正在连接、采集失败。
- Loading 状态：面板 skeleton 或保留上一次数据并显示状态。
- 错误状态：使用 `AppError.code` 分场景展示。
- 数值格式化：bytes、percent、duration、rate。

验收：

- 一个新用户可以在没有说明文案的情况下添加 VPS 并看到数据。
- 页面长时间运行 30 分钟没有明显卡顿。

## 前端验收清单

- `/web` 可以独立 mock 运行。
- 使用 theme token，没有把核心颜色写死在组件里。
- Host 管理流程完整。
- Dashboard 能展示 CPU、内存、磁盘、网络、进程。
- 连接错误、认证错误、host key 问题都有 UI。
- 进程表数据量较大时滚动流畅。
- TypeScript 无错误。
