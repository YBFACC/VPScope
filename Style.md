# VPScope Btop Pixel Style

This file is the visual contract for the btop-inspired VPScope interface. It is a styling constraint, not a product or data-contract document.

## Direction

- Build the monitoring UI as a dense terminal cockpit, closer to btop than to a macOS preferences panel.
- Prefer immediate operational readability over decorative space.
- Keep the app visually dark, high contrast, and token-driven.
- Treat every panel as a one-pixel terminal frame with a compact title strip.
- Preserve all existing behavior: sorting, hiding, subscriptions, keyboard affordances, mock data, and backend contracts must not change for style work.

## Tokens

- All core colors must come from theme variables in `web/src/theme/presets.ts` and `web/src/styles.css`.
- Component code may use variables such as `var(--color-cpu)`, `var(--color-panel)`, and `var(--color-border)`.
- Do not hard-code new status, chart, or meter colors directly in dashboard components.
- Keep radii tiny: panels and controls should read as square or pixel-cut, not pill-shaped.
- Use mono-first typography. UI copy, numbers, headings, buttons, charts, and tables should default to the mono stack.

## Surfaces

- Background: near-black terminal base with subtle scanlines and a faint grid.
- Panels: single-pixel borders, inner bevels, and strong title strips.
- Shadows: minimal. Use glow only as a status signal, not as soft-card decoration.
- Cards: only for repeated operational items such as hosts, disks, interfaces, settings rows, and process table rows.
- Avoid glassmorphism, big blurred surfaces, marketing-card layouts, oversized hero typography, and large whitespace.

## Charts And Meters

- Time charts should use a btop-like dot matrix: each column is a time sample, and filled versus empty cells represent resource usage at that moment.
- The newest samples should read clearly at the right edge, while older samples may be slightly dimmer.
- Avoid smooth curves for resource history unless a later task explicitly asks for them.
- Meters should use segmented blocks or terminal bars rather than smooth progress pills.
- Rings should remain data-driven but look more like a compact terminal gauge than a soft donut chart.
- Live updates must not resize panels or shift surrounding layout.

## Tables

- Tables are dense by default.
- Headers use uppercase mono text with clear dividers.
- Focused/active rows use a left pixel rail and tokenized accent color.
- Long commands must stay intentionally truncated and must not break the grid.

## Verification

- Mock mode must render both overview and list views.
- 1280x800 must remain usable.
- CPU, memory, disk, network, and process panels must fit without text overlap.
- Process search/sort/focus and panel hide/reorder behavior must remain unchanged.
