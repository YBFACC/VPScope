# AGENTS.md

VPScope is a macOS desktop app for monitoring local and remote VPS resource usage. It should feel close to btop in density, speed, keyboard affordances, and operational focus, but it is a desktop app rather than a terminal clone.

This file is the working contract for coding agents in this repository. Read it before making changes.

## Product Positioning

VPScope monitors server health and resource usage through a native desktop experience.

Primary product goals:

- Build a macOS-first desktop app using Tauri v2.
- Use React, TypeScript, Vite, and Tailwind CSS for the frontend.
- Use Rust in Tauri for SSH, server interaction, local configuration, credentials, parsing, and event streaming.
- Support agentless VPS monitoring over SSH as the MVP path.
- Display CPU, memory, disks, network, load, uptime, and process information.
- Keep the UI dense, fast, stable, and suitable for long-running monitoring.
- Keep visual styling theme-driven. Do not hard-code core visual decisions in components.

Non-goals for the MVP:

- Do not build a marketing landing page.
- Do not require installing a server agent on the VPS.
- Do not implement destructive remote actions such as kill, restart, delete, or service control.
- Do not add Docker, Kubernetes, GPU, alerting, historical database, or multi-host aggregate dashboards unless a later task explicitly asks for them.

## Source Of Truth

Use these documents as the current design source:

- `docs/vpscope-plan.md`: overall product and architecture plan.
- `docs/roles/README.md`: role split and collaboration flow.
- `docs/roles/contracts.md`: frontend/backend command, event, and data contract.
- `docs/roles/frontend.md`: frontend implementation steps and constraints.
- `docs/roles/backend-rust.md`: Rust backend implementation steps and constraints.
- `docs/roles/integration-test.md`: integration and verification plan.

If implementation requirements conflict with these documents, update the relevant document in the same change and explain why.

## Repository Layout

Expected project layout:

```text
VPScope/
  AGENTS.md
  docs/
  web/                  React + TypeScript + Tailwind frontend
  src-tauri/            Tauri v2 Rust backend
```

The repository may initially contain only documentation. When creating code, follow this layout unless the user explicitly changes it.

## Role Boundaries

### Frontend Agent

Work inside `/web`.

Responsibilities:

- Build React UI, routes, components, stores, mocks, formatting utilities, and theme system.
- Implement the dashboard, host management UI, settings UI, process table, charts, meters, keyboard interaction, and error states.
- Maintain TypeScript contract types in `/web/src/types/contracts.ts`.
- Wrap Tauri calls in a client abstraction such as `/web/src/lib/tauriClient.ts`.
- Provide a mock client so the frontend can run before the Rust backend is complete.

Do not:

- Execute SSH.
- Run shell commands on remote servers.
- Read remote files directly.
- Store credentials.
- Modify backend internals unless the task explicitly spans both frontend and backend.

### Backend Rust Agent

Work inside `/src-tauri`.

Responsibilities:

- Build Tauri v2 app configuration and Rust command handlers.
- Implement host config CRUD, SSH connection testing, session reuse, metrics collection, parser logic, event streaming, credential storage, and known_hosts validation.
- Keep all remote server commands fixed and whitelisted.
- Serialize Rust structs to match `docs/roles/contracts.md`.
- Provide unit tests for parsers and data conversion logic.

Do not:

- Change visual layout or component styling in `/web/src/components` or `/web/src/features` unless explicitly asked.
- Expose shell execution to the frontend.
- Store passwords, private keys, or passphrases in ordinary config files.

### Integration/Test Agent

Work across docs, mocks, contract types, parser fixtures, and test harnesses.

Responsibilities:

- Verify that TypeScript types, Rust serde output, commands, events, and mock data match the contract.
- Create mock snapshots for idle, busy, and error states.
- Add parser fixtures for Linux command outputs.
- Validate app behavior against a real SSH VPS when credentials are provided by the user.

Do not:

- Rewrite large frontend or backend subsystems when a smaller contract or fixture fix is enough.

## Frontend Constraints

Use:

- React + TypeScript.
- Vite.
- Tailwind CSS.
- CSS variables for theme tokens.
- Zustand, TanStack Store, or a similarly small state solution if state management is needed.
- Virtual scrolling for large process lists.

Theme rules:

- All core colors, borders, radii, fonts, chart colors, meter tracks, and status colors must come from theme tokens.
- Components may use CSS variables such as `var(--color-panel)` and `var(--color-cpu)`.
- Do not hard-code btop-like green/yellow/purple status colors directly in components.
- Adding a new theme preset should not require editing dashboard components.

UI rules:

- Build the actual monitoring app as the first screen, not a landing page.
- Prefer dense, scannable operational UI over decorative marketing layouts.
- Keep panels stable under live data updates; values should not resize the whole layout.
- Support 1280x800 as a minimum useful desktop size.
- Long process commands must truncate or wrap intentionally and must not break table layout.
- Use clear empty, loading, connected, disconnected, auth failed, host key unknown, host key changed, and partial-data states.

Tauri access rules:

- Components must not import Tauri APIs directly.
- Use a frontend client abstraction for commands and events.
- Keep mock and real clients behind the same interface.

## Backend Constraints

Use:

- Tauri v2.
- Rust.
- `serde` for command payloads and results.
- `#[serde(rename_all = "camelCase")]` for structures sent to the frontend.
- App config directory for non-sensitive local config.
- macOS Keychain or a clearly wrapped credential store for sensitive values.

SSH rules:

- MVP uses agentless SSH.
- SSH work belongs in Rust, not the frontend.
- Reuse SSH sessions per host where practical.
- Do not create a new SSH connection per panel.
- Do not allow the frontend to provide arbitrary command strings.
- Represent remote commands with internal enums or fixed functions.

Allowed remote data sources for MVP include:

```text
/proc/stat
/proc/meminfo
/proc/loadavg
/proc/uptime
/proc/net/dev
/proc/diskstats
df -P
ps
uname
```

Security rules:

- Do not log passwords, private key contents, passphrases, tokens, or full credential refs.
- Do not store password, private key contents, or passphrase in JSON/TOML config.
- Treat `known_hosts` strictly by default.
- Unknown host keys require user confirmation.
- Changed host keys must block the connection unless the user explicitly resolves them.
- MVP remote actions are read-only.

Metrics rules:

- CPU percent must be calculated from deltas between `/proc/stat` samples.
- Network rates must be calculated from deltas between `/proc/net/dev` samples.
- Disk IO rates must be calculated from deltas between `/proc/diskstats` samples.
- First samples may be warming samples, but should not crash the UI.
- Parser failures must return structured errors, not panic.

## Contract Rules

The frontend/backend boundary is defined by `docs/roles/contracts.md`.

When changing a command, event, data shape, or error code:

1. Update `docs/roles/contracts.md`.
2. Update frontend TypeScript types.
3. Update Rust serde structs.
4. Update mock data and tests.
5. Verify that old assumptions are not left in UI components or parser code.

Global contract conventions:

- Time fields use Unix milliseconds.
- Byte fields use bytes.
- Percent fields use numbers from `0` to `100`.
- Commands return structured results or structured `AppError`.
- Live metrics are pushed through Tauri events.

## Error Handling

Use stable error codes from the contract, including:

- `CONFIG_INVALID`
- `HOST_NOT_FOUND`
- `SSH_AUTH_FAILED`
- `SSH_CONNECT_FAILED`
- `SSH_HOST_KEY_CHANGED`
- `SSH_HOST_KEY_UNKNOWN`
- `REMOTE_COMMAND_FAILED`
- `REMOTE_UNSUPPORTED`
- `PARSER_FAILED`
- `INTERNAL`

Frontend should display user-oriented states from these codes. Backend should preserve useful debugging detail without leaking secrets.

## Testing And Verification

Match verification to the changed area.

Frontend changes:

- Run typecheck/build when available.
- Verify mock mode renders dashboard states.
- Check theme switching if styles or components changed.
- Check responsive desktop sizes for dashboard layout changes.

Backend changes:

- Run Rust tests when available.
- Add parser fixture tests for new parser behavior.
- Verify command payload/result serialization against the contract.
- Verify sensitive values are not written to config files or logs.

Integration changes:

- Verify mock snapshots match `HostSnapshot`.
- Verify Tauri commands and events match `docs/roles/contracts.md`.
- If testing against a real VPS, compare key metrics with `top`, `free`, `df`, and `/proc/loadavg`.

Do not claim a task is complete if the relevant verification was not run or if the repository has not yet been scaffolded enough to run it. State what was verified and what could not yet be verified.

## Implementation Style

- Prefer small, explicit modules over broad abstractions.
- Follow the role documents for step-by-step implementation.
- Keep frontend formatting utilities separate from components.
- Keep backend parsing separate from SSH execution.
- Keep scheduler logic separate from one-shot collection logic.
- Keep credential handling behind a narrow interface.
- Avoid unrelated refactors.
- Do not silently change the product scope.

## Dependency Guidance

Add dependencies only when they clearly reduce implementation risk or complexity.

Reasonable frontend dependencies:

- `@tauri-apps/api`
- `zustand` or another small state store
- `@tanstack/react-virtual`
- `clsx`
- Tailwind CSS tooling

Reasonable backend dependency areas:

- Tauri v2
- serde/serde_json
- UUID generation
- time/date handling
- SSH client implementation
- macOS Keychain integration
- async runtime utilities as required by Tauri

Before adding heavy UI kits, charting frameworks, databases, or background agent frameworks, check that they fit the MVP scope.

## Documentation Rules

- Keep `docs/vpscope-plan.md` aligned with major product or architecture changes.
- Keep role docs aligned with directory and ownership changes.
- Keep `docs/roles/contracts.md` aligned with any command/event/data changes.
- Prefer documenting decisions next to the role affected by the decision.

## Hard Red Lines

Do not:

- Put SSH logic in the frontend.
- Let the frontend execute arbitrary local or remote shell commands.
- Store secrets in normal config files.
- Skip known_hosts handling.
- Implement destructive remote operations in the MVP.
- Hard-code the visual theme into dashboard components.
- Replace the app with a landing page or generic admin template.
- Change the interface contract without updating docs, frontend types, backend structs, mocks, and tests.

