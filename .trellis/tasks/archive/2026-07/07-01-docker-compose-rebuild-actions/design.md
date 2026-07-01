# Docker compose rebuild actions design

## Architecture

Compose support is an extension of the existing host-scoped Docker workspace. The backend discovers Compose ownership from Docker labels during container listing, then exposes a fixed Compose action command. The frontend only shows Compose actions when the selected container has validated Compose metadata.

Frontend responsibilities:

- render optional Compose metadata for the selected container.
- show service restart, service rebuild, and project rebuild controls only when Compose metadata exists.
- use stronger confirmation for project rebuild.
- refresh containers/logs after successful Compose actions.

Backend responsibilities:

- extend Docker container listing to include optional Compose metadata from labels.
- validate label-derived project, service, working directory, and config files before command construction.
- map a fixed Compose action enum to fixed `docker compose` program arguments.
- never accept frontend-provided compose paths, services, flags, or shell strings beyond the validated metadata attached to the selected container.

## Data Flow

```text
docker ps labels
  -> DockerContainer.compose?: DockerComposeMetadata
  -> Docker workspace selected container
  -> docker_compose_action(hostId, containerId, action)
  -> backend re-reads/validates selected container metadata
  -> RemoteCommand::DockerComposeAction
  -> docker compose args
```

The action command re-reads container metadata before executing. This avoids trusting stale or forged frontend metadata.

## Contract Shape

Extend `DockerContainer`:

```ts
type DockerComposeMetadata = {
  project: string;
  service: string;
  workingDir: string;
  configFiles: string[];
};

type DockerContainer = {
  id: string;
  name: string;
  image: string;
  state: string;
  status: string;
  compose?: DockerComposeMetadata;
};
```

Add a fixed Compose action enum:

```ts
type DockerComposeAction = "restartService" | "rebuildService" | "rebuildProject";
```

Add a command:

```ts
type DockerComposeActionPayload = {
  hostId: HostId;
  containerId: string;
  action: DockerComposeAction;
};

type DockerComposeActionResult = {
  hostId: HostId;
  containerId: string;
  action: DockerComposeAction;
  project: string;
  service?: string;
  completedAt: number;
};
```

## Backend Command Mapping

`docker_container_list` uses a fixed Docker format including labels:

- `com.docker.compose.project`
- `com.docker.compose.service`
- `com.docker.compose.project.working_dir`
- `com.docker.compose.project.config_files`

`docker_compose_action` maps to fixed args:

- `restartService` -> `docker compose --project-directory <workingDir> -f <file>... restart <service>`
- `rebuildService` -> `docker compose --project-directory <workingDir> -f <file>... up -d --build <service>`
- `rebuildProject` -> `docker compose --project-directory <workingDir> -f <file>... up -d --build`

## Validation

- `containerId` uses the existing Docker identifier validator.
- `project` and `service` must be non-empty safe identifiers and must not start with `-`.
- `workingDir` and each `configFiles` entry must be absolute paths, non-empty, below a sane length, and contain no control characters.
- missing or incomplete Compose labels mean `compose` is omitted from list results and `docker_compose_action` returns `CONFIG_INVALID`.

## UI Behavior

Compose controls live near the existing container action controls. Service restart/rebuild are compact action buttons. Project rebuild opens a stronger confirmation naming the Compose project.

The Compose controls are hidden for non-Compose containers. Successful actions reload containers and logs using the existing refresh path.

## Compatibility

Existing containers without Compose labels continue to render and operate normally. `DockerContainer.compose` is optional, so existing consumers can ignore it.

## Risk Controls

- The frontend cannot submit Compose command strings, flags, paths, or service names.
- The backend re-reads Compose metadata for the selected container before execution.
- The SSH implementation uses program/argument execution, not shell interpolation.
- Project rebuild has explicit confirmation because it can recreate multiple services.
