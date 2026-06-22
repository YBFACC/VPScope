# Docker logs viewer

## Goal

Add a fast Docker logs workspace to VPScope so a user can inspect container logs on an SSH-managed VPS without leaving the app. The long-term product direction is a lightweight, lazydocker-style Docker workbench, but this task's first deliverable is a read-only logs MVP.

## Context

- User can already SSH into the VPS and wants a convenient lazydocker-like view inside VPScope.
- The reference UI has a left-side Docker resource list and a right-side detail panel focused on logs.
- VPScope currently treats Docker as out of MVP scope unless explicitly requested, and remote operations must remain read-only by default.
- Existing backend SSH execution is centralized in Rust and uses fixed command enums rather than frontend-provided shell strings.
- Existing frontend uses Tauri commands/events through `web/src/lib/tauriClient.ts` and contract types in `web/src/types/contracts.ts`.

## Requirements

- Provide a Docker entry point that fits the existing dense VPScope monitoring UI.
- Place the Docker logs entry next to the existing per-host "open terminal" action, so the user starts from a specific saved host.
- Open the Docker logs experience as a full-screen overlay workspace above the existing dashboard.
- Let the user select a saved host and view containers available through that host's SSH connection.
- Show all containers, including stopped/exited containers, with running containers sorted first.
- Show each container with at least container name/id, image, state/status, and a minimal resource/status hint when cheaply available.
- Let the user select a container and view recent logs.
- Support a bounded tail size selector for logs: 100 / 300 / 1000 lines, defaulting to 300 lines.
- Show raw container logs by default; do not force Docker timestamps in the first version.
- Support manual refresh for containers and logs.
- Support optional timed log refresh at 1 / 3 / 5 second intervals, disabled by default.
- After switching containers or refreshing logs, show the newest log entry by default by keeping the log output scrolled to the bottom.
- Do not implement streaming log follow in the first version.
- Support client-side log search/filtering.
- Keep remote Docker actions read-only for this MVP.
- Do not allow the frontend to send arbitrary remote shell commands.
- Handle hosts without Docker, users without Docker permission, missing containers, SSH failures, and command failures with existing `AppError` style.
- Keep mock mode useful with representative containers and logs.
- Update contracts, frontend types, backend serde structures, mocks, and tests when adding commands/events.

## Non-Goals

- No container stop/start/restart/delete.
- No `docker exec` shell.
- No image/volume/network management in the first deliverable.
- No Docker Compose project mutation.
- No app-managed SSH credentials or password/passphrase handling.
- No arbitrary command runner.

## Future Direction

- Expand the Docker workspace into a lazydocker-style workbench with tabs or panes for containers, images, volumes, networks, stats, env/config, and top.
- Add privileged management actions later only after explicit product approval, confirmation UX, and backend safety boundaries.

## Acceptance Criteria

- [x] A saved SSH host can open a Docker logs workspace from the app UI.
- [x] The Docker logs action appears beside the existing open-terminal host action.
- [x] Clicking the Docker logs action opens a full-screen overlay workspace that can be closed to return to the dashboard.
- [x] The workspace lists all Docker containers for the selected host using backend-controlled commands only.
- [x] Running containers appear before stopped/exited containers by default.
- [x] Selecting a container displays recent logs with a bounded tail size.
- [x] The log workspace defaults to 300 log lines and lets the user switch between 100 / 300 / 1000 lines.
- [x] Logs are displayed as raw container output without adding Docker timestamps by default.
- [x] Refreshing containers/logs works without restarting the app.
- [x] Optional timed log refresh supports 1 / 3 / 5 second intervals and is disabled by default.
- [x] Switching containers or refreshing logs scrolls the log output to the bottom so the newest entry is visible.
- [x] The first version does not keep a long-running `docker logs -f` subscription open.
- [x] Searching/filtering visible log text works locally.
- [x] Hosts without Docker or Docker permission show a recoverable error state.
- [x] Frontend command payloads do not contain arbitrary command strings.
- [x] Tauri contract docs, TypeScript types, Rust serde types, mock client, and relevant tests are updated together.
- [x] Existing host monitoring behavior still works.

## Resolved Decisions

- First version supports manual refresh plus optional 1 / 3 / 5 second polling; no streaming `docker logs -f` subscription.
- Docker logs entry lives beside the existing per-host open-terminal action, not as a top-level global view switch.
- Docker logs opens in a full-screen overlay workspace.
- Container list includes all containers and sorts running containers first by default.
- Log tail size is selectable, with 300 lines as the default.
- Logs display raw container output by default.
- Log output stays pinned to the newest entry after container switches and log refreshes.

## Open Questions

- None blocking for the first read-only Docker logs MVP.
