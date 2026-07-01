# Docker container actions implementation plan

1. Update contracts and types.
   - Add `DockerContainerAction`, including `forceRemove`, payload, and result to `docs/roles/contracts.md`.
   - Add matching TypeScript types and command maps in `web/src/types/contracts.ts`.
2. Add backend action support.
   - Add Rust action enum and result struct in `src-tauri/src/commands/docker.rs`.
   - Add `docker_container_action` Tauri command.
   - Add `RemoteCommand::DockerContainerAction` and fixed SSH program args in `src-tauri/src/ssh/client.rs`.
   - Register/export the command in `src-tauri/src/commands/mod.rs` and `src-tauri/src/lib.rs`.
3. Add backend tests.
   - Validate action serde/normalization path where appropriate.
   - Validate unsafe container identifiers are rejected.
   - Validate fixed command rendering or mock client invocation if an existing test seam supports it.
4. Update frontend client and mocks.
   - Add `runDockerContainerAction` to `web/src/lib/tauriClient.ts`.
   - Add mock action behavior to `web/src/mocks/mockTauriClient.ts`.
5. Update Docker workspace UI.
   - Add selected-container action buttons.
   - Add remove confirmation.
   - Refresh containers/logs after successful actions.
   - Preserve readable loading/error states.
6. Validate.
   - Rust tests with 60 second timeout.
   - Frontend typecheck/build.
   - Mock-mode Docker workspace smoke check if practical.

## Risky Files

- `src-tauri/src/ssh/client.rs`: keep Docker action variants fixed and argument-based.
- `web/src/features/docker/DockerLogsWorkspace.tsx`: avoid crowding the existing logs toolbar and keep destructive remove confirmation clear.
- `docs/roles/contracts.md` and `web/src/types/contracts.ts`: must stay synchronized.

## Rollback

The action feature is additive. Rollback by unregistering `docker_container_action`, removing the frontend action controls/client method, and reverting the contract additions.
