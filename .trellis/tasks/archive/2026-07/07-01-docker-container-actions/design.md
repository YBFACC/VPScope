# Docker container actions design

## Architecture

The Docker workspace remains a host-scoped overlay opened from the saved-host dashboard. Container management is added as fixed Tauri commands backed by fixed SSH Docker invocations.

Frontend responsibilities:

- render action controls for the selected container.
- request a fixed action using typed payloads.
- show confirmation for destructive remove.
- refresh container/log state after completion.

Backend responsibilities:

- validate host and container id.
- map a fixed action to a fixed `RemoteCommand`.
- execute Docker via `exec_program` arguments, not shell strings.
- return a small typed action result with completion time.

## Contract Shape

Add a fixed action enum:

```ts
type DockerContainerAction = "start" | "stop" | "restart" | "remove" | "forceRemove";
```

Add a command:

```ts
type DockerContainerActionPayload = {
  hostId: HostId;
  containerId: string;
  action: DockerContainerAction;
};

type DockerContainerActionResult = {
  hostId: HostId;
  containerId: string;
  action: DockerContainerAction;
  completedAt: number;
};
```

One command is preferred over four separate commands because all actions share validation, execution, error mapping, and UI refresh behavior. The backend still owns the action enum and maps it to fixed variants, so this does not create a free-form command surface.

## Backend Command Mapping

`RemoteCommand` gains:

```rust
DockerContainerAction {
    container_id: String,
    action: DockerContainerAction,
}
```

The SSH implementation maps actions to fixed program args:

- `start` -> `docker start <container>`
- `stop` -> `docker stop <container>`
- `restart` -> `docker restart <container>`
- `remove` -> `docker rm <container>`
- `forceRemove` -> `docker rm -f <container>`

The frontend chooses `forceRemove` only for running containers after stronger confirmation. The backend accepts only the fixed enum and never accepts arbitrary flags.

## UI Behavior

The selected-container toolbar gains compact action buttons:

- Start for non-running containers.
- Stop and restart for running containers.
- Remove for all containers.

Remove opens a confirmation modal or inline confirmation state naming the container. Removing a running container uses stronger confirmation copy that makes the force-remove behavior explicit. Successful actions refresh containers and logs. If the selected container disappears after remove, the workspace selects the first remaining container or shows the existing empty state.

## Compatibility

Existing list/log contracts remain compatible. The new action command is additive.

## Risk Controls

- Container id is normalized with the existing identifier validator.
- Action is an enum, not a user-provided string command.
- Running container removal uses a fixed force-remove path and a stronger UI confirmation.
- Backend execution uses program/argument calls for real SSH sessions.
