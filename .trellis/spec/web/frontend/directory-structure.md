# 目录结构 (Directory Structure)

> 来源：`AGENTS.md`、`docs/roles/frontend.md`、`web/src/`。

## 目录边界

前端智能体 (Frontend Agent)

在 `/web` 目录内工作。

职责：

- 构建 React UI、路由、组件、状态库、Mock 数据、格式化工具和主题系统。
- 实现仪表板、主机管理 UI、设置 UI、进程表格、图表、仪表、键盘交互和错误状态。
- 在 `/web/src/types/contracts.ts` 中维护 TypeScript 契约类型。
- 在类似 `/web/src/lib/tauriClient.ts` 的客户端抽象中封装 Tauri 调用。
- 提供 Mock 客户端，以便在 Rust 后端完成之前能够运行前端。

不要做：

- 执行 SSH。
- 在远程服务器上运行 shell 命令。
- 直接读取远程文件。
- 存储凭据。
- 修改后端内部逻辑，除非任务明确跨越前端和后端。

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

## 当前文件示例

- `web/src/app/App.tsx`
- `web/src/lib/tauriClient.ts`
- `web/src/lib/format.ts`
- `web/src/lib/historyBuffer.ts`
- `web/src/mocks/mockHosts.ts`
- `web/src/mocks/mockSnapshots.ts`
- `web/src/mocks/mockTauriClient.ts`
- `web/src/stores/hostStore.ts`
- `web/src/stores/metricsStore.ts`
- `web/src/stores/uiStore.ts`
- `web/src/theme/applyTheme.ts`
- `web/src/theme/presets.ts`
- `web/src/theme/types.ts`
- `web/src/types/contracts.ts`
