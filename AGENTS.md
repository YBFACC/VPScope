# AGENTS.md

VPScope 的编码智能体规则已归档到 `.trellis/spec/`，避免本文件与 Trellis 规范形成第二份事实来源。

开始任何任务前：

1. 运行 `python3 ./.trellis/scripts/get_context.py`。
2. 运行 `python3 ./.trellis/scripts/get_context.py --mode packages`。
3. 按任务涉及的包读取对应 spec index：
   - `.trellis/spec/guides/index.md`
   - `.trellis/spec/web/frontend/index.md`
   - `.trellis/spec/src-tauri/backend/index.md`
4. 如果任务涉及命令、事件、数据结构、错误码、Mock、parser 输出或跨边界行为，读取 `.trellis/spec/guides/contract-and-integration.md`。
5. 如果任务涉及产品范围、角色边界、安全边界或硬性禁止项，读取 `.trellis/spec/guides/product-scope.md`。

面向用户的回复默认使用中文，除非用户明确要求使用其他语言。

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
