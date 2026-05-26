---
name: testing-vpscope-frontend
description: Test VPScope frontend in mock mode. Use when verifying UI changes to dashboard panels, sidebar, tooltips, or chart components.
---

# Testing VPScope Frontend

## Quick Start

```bash
pnpm install
pnpm web:dev
# App runs at http://127.0.0.1:1420 in mock mode
```

The dev server script is `vite --host 127.0.0.1 --port 1420` (defined in `web/package.json`).

## Mock Mode

The frontend uses a mock Tauri client (`web/src/mocks/mockTauriClient.ts`) when not running inside Tauri. This provides:
- 2 mock hosts: "pmuv3" (connected) and "db-small-01" (disconnected)
- Mock snapshots with CPU, memory, disk, network, and process data
- Periodic snapshot updates (every 2-5 seconds)
- Mock connection state events

## Key UI Paths

### View Modes
- **Overview mode** (default): Shows all hosts in a summary grid. Toggle via "总览" button in top toolbar.
- **List mode**: Shows sidebar with host cards + dashboard panels for selected host. Toggle via "列表" button.

### Sidebar (List Mode)
- Host cards show name, connection badge, address, and tags
- **ℹ️ button**: Opens `HostDetailsTooltip` with host system info (rendered via portal to `document.body`)
- **x button**: Deletes host
- **新增主机**: Opens host creation form

### Dashboard Panels (List Mode)
- CPU panel: ring chart + sparkline + per-core segmented meters
- Memory panel: ring chart + sparkline + used/available/cache stats
- Network panel: RX/TX sparklines + traffic split bar + per-interface meters
- Disk panel: per-mount usage meters + IO rates
- Process panel: sortable/filterable process table

## Lint & Type Checking

```bash
pnpm web:typecheck   # TypeScript type checking
```

No separate lint command is configured. `tsc -b` is the primary static check.

## Known Gotchas

- The sidebar `<aside>` uses `backdrop-blur` which creates a new containing block. Any `position: fixed` elements inside it will be positioned relative to the sidebar, not the viewport. Use `createPortal` to escape this.
- Port 1420 might already be in use if a previous dev server wasn't stopped. Check with `curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:1420/` before starting a new one.
- Mock snapshots are generated fresh each time (not cached), so data values change between renders.

## Devin Secrets Needed

None — mock mode runs entirely locally without credentials.
