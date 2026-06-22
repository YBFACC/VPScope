# 状态管理 (State Management)

> 来源：`AGENTS.md`、`docs/roles/frontend.md`、`docs/vpscope-plan.md`、`web/src/stores/`。

## 技术要求

- 如果需要状态管理，使用 Zustand、TanStack Store 或类似的小型状态解决方案。

## 建立状态管理

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

## 接入实时指标

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

## 性能策略

- 后端保留 last-known snapshot，窗口打开时先显示最近状态。
- 采集任务和 UI 刷新解耦。
- 高频历史数据使用 ring buffer。
- React 组件按 panel 拆分，避免全 dashboard 每秒重渲染。
- 大进程列表使用虚拟滚动。
- 图表优先 Canvas，减少大量 DOM 节点。

## 当前文件示例

- `web/src/stores/alertSettingsStore.ts`
- `web/src/stores/hostStore.ts`
- `web/src/stores/metricsStore.ts`
- `web/src/stores/terminalSettingsStore.ts`
- `web/src/stores/traySettingsStore.ts`
- `web/src/stores/uiStore.ts`
- `web/src/lib/historyBuffer.ts`
