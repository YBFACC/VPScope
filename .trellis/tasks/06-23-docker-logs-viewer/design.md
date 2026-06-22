# Docker logs viewer design

## Scope

Build the first read-only Docker workspace for VPScope. It opens from a per-host action beside "open terminal", covers the dashboard as a full-screen workspace, lists all Docker containers for that host, and displays raw recent logs for the selected container.

This task deliberately avoids Docker management actions and long-running log streaming.

## Architecture

### Backend boundary

Docker access remains in `/src-tauri`. The frontend never sends arbitrary shell strings.

Add backend commands:

- `docker_container_list`
  - Payload: `{ hostId: string }`
  - Result: `DockerContainer[]`
- `docker_container_logs`
  - Payload: `{ hostId: string; containerId: string; tailLines: 100 | 300 | 1000 }`
  - Result: `{ hostId: string; containerId: string; tailLines: number; logs: string; fetchedAt: number }`

Add fixed SSH command support for Docker:

- list all containers with a backend-owned command equivalent to `docker ps -a --format ...`
- fetch logs with a backend-owned command equivalent to `docker logs --tail <bounded> <container-id>`

The only dynamic command parts are validated container id/name values discovered from `docker_container_list` and bounded tail sizes. The command construction must not allow free-form shell fragments from frontend payloads.

### Data model

`DockerContainer` should include:

- `id`
- `name`
- `image`
- `state`
- `status`
- `createdAt?`

Running containers sort before non-running containers. Within each status group, keep Docker's list order unless implementation needs a stable secondary sort.

### Error behavior

Reuse `AppError`:

- missing host: `HOST_NOT_FOUND`
- no Docker binary, Docker unavailable, or unsupported remote: `REMOTE_UNSUPPORTED`
- Docker permission denied or command failure: `REMOTE_COMMAND_FAILED`
- SSH failures keep existing SSH error mapping
- invalid tail size or empty container id: `CONFIG_INVALID`

Error details must avoid secrets and must not include full SSH credential material.

### Frontend boundary

Add a full-screen `DockerLogsWorkspace` overlay under `web/src/features/docker/` or a similarly scoped feature directory.

The overview host card action row gains a Docker action button beside open terminal. The button opens the overlay with the chosen `hostId`.

Workspace layout:

- Header: host name, refresh action, close action, selected tail size.
- Left pane: all containers, running first, status visible.
- Right pane: raw logs for selected container.
- Local search/filter applies to visible log text.
- Manual refresh reloads containers and selected logs. Changing tail size reloads logs.

The first version does not subscribe to events and does not run `docker logs -f`.

### Mock mode

Mock client returns representative containers:

- several running services
- at least one exited/crashed service
- varied images/statuses

Mock logs include long lines and repeated error patterns so the workspace can be visually tested without a real VPS.

### Contracts

Changing command/data contracts requires updates in:

- `docs/roles/contracts.md`
- `web/src/types/contracts.ts`
- `web/src/lib/tauriClient.ts`
- `web/src/mocks/mockTauriClient.ts`
- Rust serde payload/result structs and Tauri command registration
- Tests for parsing/validation where relevant

## Compatibility

Existing monitoring subscriptions and host overview behavior must continue unchanged when the Docker workspace is closed.

The Docker feature is optional per host. Hosts without Docker should show a recoverable workspace error rather than blocking normal monitoring.

## Rollback

The feature can be removed by unregistering the Docker commands, removing the frontend action/workspace, and reverting the contract additions. It does not migrate persisted user data.
