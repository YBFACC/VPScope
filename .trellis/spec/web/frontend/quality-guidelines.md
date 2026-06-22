# 质量规范 (Quality Guidelines)

> 来源：`AGENTS.md`、`Style.md`、`docs/roles/frontend.md`、`docs/roles/integration-test.md`。

## 前端更改

- 在可用时运行类型检查/构建 (typecheck/build)。
- 验证 Mock 模式能否渲染仪表板状态。
- 如果更改了样式或组件，请检查主题切换。
- 检查桌面响应尺寸是否适应仪表板布局变化。

## 前端验收清单

- `/web` 可以独立 mock 运行。
- 使用 theme token，没有把核心颜色写死在组件里。
- Host 管理流程完整。
- Dashboard 能展示 CPU、内存、磁盘、网络、进程。
- 连接错误、认证错误、host key 问题都有 UI。
- 进程表数据量较大时滚动流畅。
- TypeScript 无错误。

## 前端视觉验收

检查尺寸：

- 1280x800
- 1440x900
- 1728x1117
- 2560x1440

检查主题：

- btop classic
- mac graphite
- light lab

检查状态：

- 没有 host。
- 正在连接。
- 连接成功。
- 认证失败。
- host key unknown。
- host key changed。
- 采集中断。
- 部分指标不可用。

验收：

- 面板不重叠。
- 文字不溢出关键按钮。
- 进程表长 command 不撑破布局。
- 主题切换无残留硬编码颜色。

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
