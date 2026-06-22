# Docker logs viewer implementation plan

## Checklist

1. Load pre-development specs with `trellis-before-dev`.
2. Update contracts.
   - Add Docker command payload/result types to `docs/roles/contracts.md`.
   - Add matching TypeScript types in `web/src/types/contracts.ts`.
3. Implement backend Docker commands.
   - Add Docker payload/result structs.
   - Add fixed Docker command support without frontend-provided shell strings.
   - Parse container list output into typed containers.
   - Validate `tailLines` against `100 | 300 | 1000`.
   - Register commands in `src-tauri/src/lib.rs` and command exports.
4. Add backend tests.
   - Container list parser handles running and exited containers.
   - Tail size validation rejects unsupported values.
   - Command construction rejects empty/unsafe container ids if implemented as a helper.
5. Implement frontend client and mocks.
   - Extend `VPScopeClient`.
   - Add Tauri invocations.
   - Add mock containers/logs.
6. Build Docker logs UI.
   - Add per-host Docker action beside open terminal.
   - Add full-screen overlay workspace.
   - Add container list, raw logs pane, refresh, close, search, and tail size selector.
   - Preserve current dashboard behavior while overlay is open/closed.
7. Add or update i18n messages.
8. Validate.
   - Frontend typecheck/build where available.
   - Rust tests with 60s timeout.
   - Mock-mode visual smoke for the overlay.
   - Optional real VPS check only if credentials/environment are already available and explicitly safe to use.

## Files likely touched

- `docs/roles/contracts.md`
- `web/src/types/contracts.ts`
- `web/src/lib/tauriClient.ts`
- `web/src/mocks/mockTauriClient.ts`
- `web/src/features/overview/OverviewPage.tsx`
- `web/src/features/hosts/HostActionIcons.tsx`
- `web/src/features/docker/*`
- `web/src/i18n/messages.ts`
- `web/src/styles.css`
- `src-tauri/src/commands/*`
- `src-tauri/src/ssh/client.rs`
- `src-tauri/src/lib.rs`

## Validation commands

- `npm run build` or package-equivalent frontend check from `web/`
- `cargo test` from `src-tauri/` with a 60s timeout
- mock-mode browser smoke for the Docker overlay

## Risks and controls

- Remote command injection risk: keep Docker commands backend-owned and validate all dynamic parts.
- UI crowding risk: use a full-screen overlay, not a narrow dashboard panel.
- Docker availability risk: show recoverable per-host error states.
- Scope creep risk: no restart/exec/delete/streaming in this task.

## Review gate

Before `task.py start`, confirm the PRD/design/implementation plan with the user.
