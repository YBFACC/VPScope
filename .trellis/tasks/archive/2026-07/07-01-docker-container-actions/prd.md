# Docker container actions

## Goal

Add first-stage Docker container management actions to the existing Docker logs workspace so a user can start, stop, restart, and remove containers on a saved SSH host without leaving VPScope.

This task deliberately stays at the single-container level. Compose rebuild/restart is handled by the sibling task.

## Requirements

- Add container actions for `start`, `stop`, `restart`, and `remove`.
- Execute actions through backend-owned fixed Docker commands only.
- The frontend sends only `hostId`, `containerId`, and a fixed action enum.
- Validate container identifiers before command construction, using the existing safe identifier rules.
- Show action controls in the Docker workspace for the selected container.
- Disable or hide impossible actions based on the current container state:
  - running containers can be stopped and restarted.
  - non-running containers can be started.
  - all containers can be removed.
  - remove is destructive and must require confirmation.
  - removing a running container must be treated as a stronger destructive action and use a fixed `forceRemove` action.
- After a successful action, refresh the container list and preserve/select the most relevant container if it still exists.
- If a removed container disappears, clear logs or select the next available container.
- Surface command failures with the existing `AppError` style.
- Keep mock mode useful with representative success behavior.
- Update docs, TypeScript contract types, Tauri client, Rust command structs, command registration, mock client, and tests together.

## Out of Scope

- `docker exec`, shell access, arbitrary Docker flags, image/volume/network management.
- Compose service/project rebuild.
- Long-running action streams.

## Acceptance Criteria

- [ ] A selected running container can be stopped from the Docker workspace.
- [ ] A selected stopped/exited container can be started from the Docker workspace.
- [ ] A selected running container can be restarted from the Docker workspace.
- [ ] A selected non-running container can be removed after confirmation.
- [ ] A selected running container can be force-removed only after stronger confirmation.
- [ ] The frontend cannot send arbitrary Docker commands, flags, or shell fragments.
- [ ] Unsafe or empty container identifiers return `CONFIG_INVALID`.
- [ ] Docker unavailable remains `REMOTE_UNSUPPORTED`; Docker permission/command failures remain `REMOTE_COMMAND_FAILED`.
- [ ] Container list/log state refreshes after each successful action.
- [ ] Contract docs, TS types, Rust serde structs, mocks, and tests are updated together.

## Notes

- Existing Docker workspace files: `web/src/features/docker/DockerLogsWorkspace.tsx`, `web/src/lib/tauriClient.ts`, `web/src/types/contracts.ts`, `web/src/mocks/mockTauriClient.ts`.
- Existing backend files: `src-tauri/src/commands/docker.rs`, `src-tauri/src/ssh/client.rs`, `src-tauri/src/commands/mod.rs`, `src-tauri/src/lib.rs`.
