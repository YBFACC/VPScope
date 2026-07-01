# Docker compose rebuild actions

## Goal

Add second-stage Docker Compose actions to the Docker workspace after container-level actions exist. Compose controls should appear only when the selected container can be tied to a Compose project/service via Docker labels.

## Requirements

- Extend container discovery to include optional Compose metadata from Docker labels:
  - project name
  - service name
  - working directory
  - config files, if safely discoverable
- Show Compose actions only for containers with enough Compose metadata.
- Prefer service-scoped actions first:
  - rebuild selected service with `up -d --build <service>`
  - restart selected service with `restart <service>`
- Consider whole-project rebuild as a stronger destructive action with additional confirmation.
- Keep command construction backend-owned. The frontend must not provide arbitrary compose paths, service names, flags, or command strings.
- Validate all label-derived dynamic values before command construction.
- Refresh containers/logs after successful actions.

## Out of Scope For Initial Compose Stage

- Editing compose files.
- Passing arbitrary compose profiles, env files, flags, or pull policies.
- `down`, volume deletion, image pruning, network deletion, or database reset.
- Compose actions for containers without Compose labels.

## Acceptance Criteria

- [ ] Compose actions are hidden when a container has no Compose metadata.
- [ ] Service rebuild is available only when project/service metadata is validated.
- [ ] Service restart is available only when project/service metadata is validated.
- [ ] Whole-project rebuild, if included, has a stronger confirmation path than service actions.
- [ ] Frontend cannot provide arbitrary compose commands or flags.
- [ ] Contract docs, TS types, Rust serde structs, mocks, and tests are updated together.

## Notes

- This task depends on the UI and contract patterns introduced by `.trellis/tasks/07-01-docker-container-actions`.
