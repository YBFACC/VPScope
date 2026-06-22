# 前端开发规范 (Frontend Development Guidelines)

> 来源：已归档的 `AGENTS.md`、`Style.md`、`docs/roles/frontend.md`、`docs/roles/contracts.md`、`web/src/`。

本目录只归档 `/web` 前端约束。项目约束使用来源文档原句，不做词替换。

## 规范索引

| 规范 | 描述 | 状态 |
|-------|-------------|--------|
| [目录结构](./directory-structure.md) | `/web` 目录边界、推荐目录和当前文件示例 | 已归档 |
| [组件规范](./component-guidelines.md) | Dashboard、组件、样式、无障碍和视觉约束 | 已归档 |
| [Hook 规范](./hook-guidelines.md) | Hook 与 Tauri client 抽象边界 | 已归档 |
| [状态管理](./state-management.md) | Zustand store、snapshot、history 和订阅状态 | 已归档 |
| [质量规范](./quality-guidelines.md) | 前端验证、禁用模式和评审检查 | 已归档 |
| [类型安全](./type-safety.md) | 前端契约类型和边界类型规则 | 已归档 |

## Pre-Development Checklist

- 读取 `.trellis/spec/guides/product-scope.md`。
- 读取 `component-guidelines.md`、`directory-structure.md`、`quality-guidelines.md`。
- 如果改动命令、事件、数据形状或错误代码，读取 `docs/roles/contracts.md` 和 `.trellis/spec/guides/contract-and-integration.md`。
- 如果改动样式或组件，读取 `component-guidelines.md`。
- 如果改动 store、订阅或 snapshot 流，读取 `state-management.md`。
- 如果改动 `web/src/types/contracts.ts` 或 `web/src/lib/tauriClient.ts`，读取 `type-safety.md` 和 `hook-guidelines.md`。

## Quality Check

- 在可用时运行类型检查/构建 (typecheck/build)。
- 验证 Mock 模式能否渲染仪表板状态。
- 如果更改了样式或组件，请检查主题切换。
- 检查桌面响应尺寸是否适应仪表板布局变化。
