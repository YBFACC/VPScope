# Docker management actions

## Goal

Expand the existing Docker logs workspace into a lightweight Docker management workspace in two independently shippable steps:

1. Add safe container-level actions for start, stop, restart, and remove.
2. Add Docker Compose rebuild/restart actions after Compose ownership can be discovered and displayed.

The feature should keep VPScope's remote command model backend-owned and explicit. The frontend must never pass arbitrary shell commands, Docker subcommands, flags, or paths to the backend.

## Requirements

- Keep the current read-only Docker logs workflow usable.
- Stage 1 ships first: selected containers can be started, stopped, restarted, and removed through fixed backend commands.
- Stage 2 ships second: Compose actions appear only when the selected container has Compose metadata from Docker labels.
- Destructive actions require clear confirmation and must refresh the container list/log state after completion.
- All command, type, mock, and contract changes stay synchronized across docs, TypeScript, Rust serde structs, and tests.
- Parent task owns the two-step scope; implementation lives in child tasks.

## Child Tasks

- `.trellis/tasks/07-01-docker-container-actions`
- `.trellis/tasks/07-01-docker-compose-rebuild-actions`

## Acceptance Criteria

- [ ] Container actions are planned, implemented, and verified as the first deliverable.
- [ ] Compose rebuild actions are planned as the second deliverable and do not block stage 1.
- [ ] Cross-stage UX keeps Docker commands discoverable without making destructive operations feel casual.
- [ ] Remote command construction remains backend-owned and injection-resistant.

## Notes

- Current Docker support is read-only: `docker_container_list` and `docker_container_logs`.
- Product scope historically forbids destructive remote operations unless explicitly requested; this task is the explicit request to add a bounded Docker management surface.
