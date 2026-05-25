# VPScope 角色拆分文档

本文档目录用于把 VPScope 的实现工作按角色拆开。每个角色文档都包含：

- 负责范围
- 不负责范围
- 目录边界
- 依赖接口
- 详细实现步骤
- 验收标准

## 角色列表

- [前端角色：React + Tailwind Dashboard](/Users/ybf/code/VPScope/docs/roles/frontend.md)
- [后端角色：Tauri Rust Core + SSH Metrics](/Users/ybf/code/VPScope/docs/roles/backend-rust.md)
- [联调测试角色：接口契约、Mock、验收](/Users/ybf/code/VPScope/docs/roles/integration-test.md)

## 推荐协作顺序

1. 前端和后端先共同确认 [接口契约](/Users/ybf/code/VPScope/docs/roles/contracts.md)。
2. 前端在 `/web` 内实现静态 Dashboard 和 Mock 数据。
3. 后端在 `/src-tauri` 内实现 Host 管理、SSH 连接、指标采集。
4. 联调测试角色把 Mock 数据替换为 Tauri invoke/event 流。
5. 根据验收标准修正 UI、采集精度、错误状态和性能问题。

## 项目目录约定

```text
VPScope/
  web/                  React + Tailwind 前端
  src-tauri/            Tauri Rust 后端
  docs/
    vpscope-plan.md     总体方案
    roles/              按角色拆分的执行文档
```

## 基本原则

- 前端不直接执行 SSH 或 shell 命令。
- 后端不处理视觉布局，但需要提供稳定、类型清晰的数据结构。
- 所有跨边界通信都通过 Tauri command 或 event。
- 主题样式只通过 theme token 和 CSS variables 暴露给组件。
- 远程服务器操作必须默认只读，MVP 不实现 kill/restart 等破坏性动作。

