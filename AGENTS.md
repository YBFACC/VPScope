# AGENTS.md

VPScope 是一个用于监控本地和远程 VPS 资源使用情况的 macOS 桌面应用程序。在密度、速度、键盘交互和操作重点方面，它应该感觉接近 btop，但它是一个桌面应用，而不是终端克隆版。

本文件是此代码库中编码智能体 (coding agents) 的工作契约。在进行更改前，请先阅读本文档。

## 全局智能体规则

### 语言

除非用户明确要求使用其他语言，否则在面向用户的回复中默认使用中文。

### 协作风格

- 将用户视为有能力的合作者。保持热情、坦诚、务实且简明扼要。
- 首先给出答案或结果，然后仅包含建立信任所需的上下文。
- 尽量在最少提示下理解用户的意图。如果可以进行低风险的假设，请简要说明并继续。
- 只有当缺失的信息会实质性地改变工作或产生重大风险时，才要求用户澄清。
- 不要添加无关的功能、推测性的后续操作、大规模重写或在解答后提出改进建议。

### 开场白

在为一个多步骤的编码任务调用工具之前，发送一个简短的、用户可见的更新，确认请求并说明第一步。将其控制在一两句话以内。

### 计划

- 对于非平凡的编码任务，制定一个简短的计划，涵盖根本原因、受影响的文件、热修复与结构性范围、方法和验证。
- 对于大型任务，比较最小化补丁与根本原因修复。当最小化补丁增加不一致性或技术债务时，选择更易维护的选项。
- 对于琐碎的修改，直接进行。
- 在每个重要步骤之后，询问用户核心请求现在是否可以通过充分的证据得到解答。如果是，回答并停止。

### 调试优先原则

让失败通过显式错误、异常、日志或失败的测试清晰地显现出来。不要为了让代码看起来能运行而引入静默的后备方案 (silent fallbacks)、模拟的成功路径、宽泛的万能保护机制或防御性行为。如果安全、保障或隐私边界是必要的，请使其明确、被记录、易于在适当时禁用，并事先得到用户的同意。

### 错误修复理念

- 从第一性原理追踪根本原因。不要只修补表面症状。
- 倾向于做减法：在添加新层之前，移除冗余配置、死分支、不必要的门控和过时的逻辑。
- 避免重复的实现、第二个事实来源、平行的验证或权限逻辑、隐藏的后备行为、吞没错误的宽泛 try/catch 块以及掩盖不良数据的静默默认值。
- 如果必须使用这些模式中的任何一个，请解释原因并限制其范围。

### 结构性修复触发条件

如果一项任务涉及重复的业务逻辑、多个事实来源、共享验证、权限、路由、缓存、API 契约、模式、迁移、跨模块行为、不稳定的测试、隐藏的后备方案、重复的错误模式、状态同步或安全与数据完整性边界，请将其视为结构性任务，而不是局部的热修复。对于结构性修复，确定应该保持的约束（不变量），在一个地方表达它，并移除过时的逻辑，而不是在其周围堆砌。

### 资源使用

利用可用的工具、MCP、技能、浏览器检查、测试和并行智能体，只要它们能实质性地改善证据质量、运行时验证或对代码库的理解。一旦用户的核心请求得到了充分的证据解答，就停下来。

### 技能 (Skills)

技能存放在 `~/.codex/skills/` 和 `.codex/skills/` 目录中。在开始任务之前，扫描可用的技能。如果找到匹配的技能，请阅读其 `SKILL.md`，遵循它，并宣布正在使用哪个技能。

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

## 事实来源 (Source Of Truth)

将以下文档作为当前的设计来源：

- `docs/vpscope-plan.md`：整体产品和架构计划。
- `docs/roles/README.md`：角色划分和协作流程。
- `docs/roles/contracts.md`：前端/后端命令、事件和数据契约。
- `docs/roles/frontend.md`：前端实现步骤和约束。
- `docs/roles/backend-rust.md`：Rust 后端实现步骤和约束。
- `docs/roles/integration-test.md`：集成和验证计划。

如果实现要求与这些文档有冲突，请在同一更改中更新相关文档并解释原因。

## 仓库布局

预期的项目布局：

```text
VPScope/
  AGENTS.md
  docs/
  web/                  React + TypeScript + Tailwind 前端
  src-tauri/            Tauri v2 Rust 后端
```

初始仓库可能仅包含文档。在创建代码时，请遵循此布局，除非用户明确要求更改。

## 角色边界

### 前端智能体 (Frontend Agent)

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

### 后端 Rust 智能体 (Backend Rust Agent)

在 `/src-tauri` 目录内工作。

职责：

- 构建 Tauri v2 应用配置和 Rust 命令处理器。
- 实现主机配置 CRUD、SSH 连接测试、会话复用、指标收集、解析器逻辑、事件流、凭据存储和 known_hosts 验证。
- 保持所有远程服务器命令固定并列入白名单。
- 序列化 Rust 结构体以匹配 `docs/roles/contracts.md`。
- 为解析器和数据转换逻辑提供单元测试。

不要做：

- 更改 `/web/src/components` 或 `/web/src/features` 中的视觉布局或组件样式，除非明确要求。
- 向前端暴露 shell 执行权限。
- 在普通配置文件中存储密码、私钥或密码短语 (passphrases)。

### 集成/测试智能体 (Integration/Test Agent)

跨文档、Mock 数据、契约类型、解析器测试用例 (fixtures) 和测试框架工作。

职责：

- 验证 TypeScript 类型、Rust serde 输出、命令、事件和 Mock 数据是否符合契约。
- 为空闲、繁忙和错误状态创建 Mock 快照。
- 为 Linux 命令输出添加解析器 fixtures。
- 当用户提供凭据时，在真实的 SSH VPS 上验证应用程序的行为。

不要做：

- 当通过较小的契约或 fixture 修复就足够时，重写大型前端或后端子系统。

## 前端约束

使用：

- React + TypeScript。
- Vite。
- Tailwind CSS。
- 使用 CSS 变量管理主题 Token。
- 如果需要状态管理，使用 Zustand、TanStack Store 或类似的小型状态解决方案。
- 对于大型进程列表使用虚拟滚动。

主题规则：

- 所有核心颜色、边框、圆角、字体、图表颜色、仪表轨道和状态颜色必须来自主题 Token。
- 组件可以使用 CSS 变量，如 `var(--color-panel)` 和 `var(--color-cpu)`。
- 不要在组件中直接硬编码类似 btop 的绿色/黄色/紫色等状态颜色。
- 添加新的主题预设不应要求编辑仪表板组件。

UI 规则：

- 将实际的监控应用构建为首屏，而不是落地页。
- 优先选择密集、易于扫描的操作 UI，而不是装饰性的营销布局。
- 面板在实时数据更新下应保持稳定；数值的变化不应该导致整个布局调整大小。
- 支持 1280x800 作为最小可用桌面尺寸。
- 较长的进程命令必须有意识地截断或换行，绝对不能破坏表格布局。
- 使用清晰的空状态、加载中、已连接、已断开、认证失败、未知主机密钥、主机密钥更改以及部分数据状态。

Tauri 访问规则：

- 组件不能直接导入 Tauri API。
- 对命令和事件使用前端客户端抽象。
- 将 Mock 和真实客户端置于相同的接口后面。

## 后端约束

使用：

- Tauri v2。
- Rust。
- `serde` 用于处理命令负载和结果。
- 对于发送到前端的结构体使用 `#[serde(rename_all = "camelCase")]`。
- 对于非敏感的本地配置，使用应用配置目录。
- 对于敏感值，使用 macOS 钥匙串 (Keychain) 或清晰封装的凭据存储。

SSH 规则：

- MVP 使用无 Agent 的 SSH。
- SSH 逻辑属于 Rust，而不是前端。
- 尽可能重用每个主机的 SSH 会话。
- 不要为每个面板创建一个新的 SSH 连接。
- 不允许前端提供任意命令字符串。
- 使用内部枚举或固定函数表示远程命令。

MVP 允许的远程数据源包括：

```text
/proc/stat
/proc/meminfo
/proc/loadavg
/proc/uptime
/proc/net/dev
/proc/diskstats
df -P
ps
uname
```

安全规则：

- 不要记录 (log) 密码、私钥内容、密码短语、令牌或完整的凭据引用。
- 不要在 JSON/TOML 配置中存储密码、私钥内容或密码短语。
- 默认情况下严格对待 `known_hosts`。
- 未知主机密钥需要用户确认。
- 更改的主机密钥必须阻止连接，除非用户明确解决。
- MVP 远程操作是只读的。

指标规则：

- CPU 百分比必须根据 `/proc/stat` 样本之间的增量 (deltas) 计算。
- 网络速率必须根据 `/proc/net/dev` 样本之间的增量计算。
- 磁盘 IO 速率必须根据 `/proc/diskstats` 样本之间的增量计算。
- 首次采样可以是预热样本，但不应使 UI 崩溃。
- 解析器失败必须返回结构化错误，而不是 panic。

## 契约规则

前端/后端的边界由 `docs/roles/contracts.md` 定义。

当更改命令、事件、数据形状或错误代码时：

1. 更新 `docs/roles/contracts.md`。
2. 更新前端 TypeScript 类型。
3. 更新 Rust serde 结构体。
4. 更新 Mock 数据和测试。
5. 验证 UI 组件或解析器代码中是否遗留了旧的假设。

全局契约约定：

- 时间字段使用 Unix 毫秒。
- 字节字段使用字节。
- 百分比字段使用从 `0` 到 `100` 的数字。
- 命令返回结构化结果或结构化的 `AppError`。
- 实时指标通过 Tauri 事件推送。

## 错误处理

使用来自契约的稳定错误代码，包括：

- `CONFIG_INVALID`
- `HOST_NOT_FOUND`
- `SSH_AUTH_FAILED`
- `SSH_CONNECT_FAILED`
- `SSH_HOST_KEY_CHANGED`
- `SSH_HOST_KEY_UNKNOWN`
- `REMOTE_COMMAND_FAILED`
- `REMOTE_UNSUPPORTED`
- `PARSER_FAILED`
- `INTERNAL`

前端应该向用户展示这些代码对应的面向用户的状态。后端应该在不泄漏机密的情况下保留有用的调试细节。

## 测试与验证

测试验证工作应与更改的区域相匹配。

前端更改：

- 在可用时运行类型检查/构建 (typecheck/build)。
- 验证 Mock 模式能否渲染仪表板状态。
- 如果更改了样式或组件，请检查主题切换。
- 检查桌面响应尺寸是否适应仪表板布局变化。

后端更改：

- 在可用时运行 Rust 测试。
- 为新的解析器行为添加解析器 fixture 测试。
- 根据契约验证命令负载/结果的序列化。
- 验证敏感值是否未写入配置文件或日志。

集成更改：

- 验证 Mock 快照是否匹配 `HostSnapshot`。
- 验证 Tauri 命令和事件是否匹配 `docs/roles/contracts.md`。
- 如果针对真实的 VPS 进行测试，请将关键指标与 `top`、`free`、`df` 和 `/proc/loadavg` 进行比较。

如果未运行相关验证，或者代码库尚未搭建好以运行验证，请不要声称任务已完成。请说明已验证的内容以及尚未能验证的内容。

在适用的情况下，按以下顺序运行验证：

1. 针对更改行为的有针对性的单元测试。
2. 类型检查或 Lint 检查。
3. 受影响包的构建检查。
4. 最小的冒烟测试。

后端单元测试必须有 60 秒的硬超时限制。

在最终确定之前，请扫描 diff，检查是否只修补了症状、逻辑重复、隐藏的 fallback、宽泛的吞没错误、第二个事实来源、死代码、未提及的行为更改、薄弱的测试以及安全回归。在回复之前修复明显的问题。

## 实现风格

- 优先使用小型、明确的模块，而不是宽泛的抽象。
- 遵循角色文档进行循序渐进的实现。
- 保持前端格式化工具与组件分离。
- 保持后端解析与 SSH 执行分离。
- 保持调度器逻辑与一次性收集逻辑分离。
- 将凭证处理放在一个狭窄的接口后面。
- 避免无关的重构。
- 不要静默更改产品范围。
- 优先选择短函数、浅层嵌套、尽早返回、具名常量和较少的参数。
- 保持业务逻辑与具体实现解耦；通过参数或接口注入依赖项。
- 优先考虑不可变数据流。返回新值而不是改变参数或全局状态。
- 注释应解释意图或权衡，而不是重述代码已经说明的内容。
- 如果更改行为，除非明确需要兼容性，否则保持 diff 具有针对性，同时删除死代码。
- 处理边缘情况时使用清晰的失败路径，而不是假设理想的输入。

## 安全基线

- 切勿硬编码机密信息、API 密钥或凭证。使用环境变量、macOS 钥匙串 (Keychain) 或合适的机密管理器。
- 如果添加了数据库代码，请使用参数化查询访问数据库。
- 切勿将用户输入拼接到 SQL、本地 shell 命令或远程命令中。
- 在系统边界验证并清理外部输入。

## 依赖指南

仅当能明显降低实现风险或复杂性时才添加依赖项。

合理的前端依赖：

- `@tauri-apps/api`
- `zustand` 或其他小型状态库
- `@tanstack/react-virtual`
- `clsx`
- Tailwind CSS 工具链

合理的后端依赖领域：

- Tauri v2
- serde/serde_json
- UUID 生成
- 时间/日期处理
- SSH 客户端实现
- macOS Keychain 集成
- Tauri 要求的异步运行时工具

在添加繁重的 UI 套件、图表框架、数据库或后台 Agent 框架之前，请检查它们是否符合 MVP 范围。

## 文档规则

- 保持 `docs/vpscope-plan.md` 与主要产品或架构更改对齐。
- 保持角色文档与目录和所有权更改对齐。
- 保持 `docs/roles/contracts.md` 与任何命令/事件/数据更改对齐。
- 优先在受决定影响的角色旁边记录决定。

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
<!-- TRELLIS:START -->
# Trellis Instructions

These instructions are for AI assistants working in this project.

This project is managed by Trellis. The working knowledge you need lives under `.trellis/`:

- `.trellis/workflow.md` — development phases, when to create tasks, skill routing
- `.trellis/spec/` — package- and layer-scoped coding guidelines (read before writing code in a given layer)
- `.trellis/workspace/` — per-developer journals and session traces
- `.trellis/tasks/` — active and archived tasks (PRDs, research, jsonl context)

If a Trellis command is available on your platform (e.g. `/trellis:finish-work`, `/trellis:continue`), prefer it over manual steps. Not every platform exposes every command.

If you're using Codex or another agent-capable tool, additional project-scoped helpers may live in:
- `.agents/skills/` — reusable Trellis skills
- `.codex/agents/` — optional custom subagents

Managed by Trellis. Edits outside this block are preserved; edits inside may be overwritten by a future `trellis update`.

<!-- TRELLIS:END -->
