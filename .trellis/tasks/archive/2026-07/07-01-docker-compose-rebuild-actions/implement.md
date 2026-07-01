# Docker compose rebuild actions implementation plan

1. Update contracts and types.
   - Extend Docker container contract with optional Compose metadata.
   - Add `DockerComposeAction`, payload, and result to `docs/roles/contracts.md`.
   - Add matching TypeScript types and command maps in `web/src/types/contracts.ts`.
2. Extend backend Docker listing.
   - Include Compose labels in fixed `docker ps --format` output.
   - Parse optional Compose metadata while keeping non-Compose containers valid.
   - Add validation helpers for safe identifiers and absolute label paths.
3. Add backend Compose action support.
   - Add Rust Compose action enum/result.
   - Add `docker_compose_action` Tauri command.
   - Re-read container list output inside the action command and find the selected container metadata.
   - Add fixed `RemoteCommand::DockerComposeAction` and program arg mapping.
   - Register/export command in `src-tauri/src/commands/mod.rs` and `src-tauri/src/lib.rs`.
4. Add backend tests.
   - Parser test: Compose labels produce optional metadata.
   - Parser test: non-Compose rows keep `compose` omitted.
   - Validation test: unsafe paths/service names are rejected.
   - Command rendering test: service rebuild and project rebuild render fixed command strings.
5. Update frontend client and mocks.
   - Add `runDockerComposeAction` to `web/src/lib/tauriClient.ts`.
   - Add mock Compose metadata and mock action behavior.
6. Update Docker workspace UI.
   - Show Compose controls only for selected containers with `compose`.
   - Add service restart/rebuild actions.
   - Add project rebuild confirmation.
   - Refresh containers/logs after success.
7. Validate.
   - `pnpm --dir web exec tsc --noEmit`
   - `pnpm --dir web build`
   - `cargo fmt --check`
   - `perl -e 'alarm shift; exec @ARGV' 60 cargo test`

## Risky Files

- `src-tauri/src/ssh/client.rs`: keep Compose command variants fixed and argument-based.
- `src-tauri/src/commands/docker.rs`: avoid trusting frontend-provided Compose metadata.
- `web/src/features/docker/DockerLogsWorkspace.tsx`: keep action area compact and readable.
- `docs/roles/contracts.md` and `web/src/types/contracts.ts`: must stay synchronized.

## Rollback

The Compose feature is additive. Rollback by unregistering `docker_compose_action`, removing Compose metadata from the list contract, removing frontend controls/client method, and reverting the contract/spec additions.
