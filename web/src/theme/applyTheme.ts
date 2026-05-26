import type { VPScopeTheme } from "./types";

const tokenMap = {
  bg: "--color-bg",
  panel: "--color-panel",
  panelRaised: "--color-panel-raised",
  panelMuted: "--color-panel-muted",
  panelGlass: "--color-panel-glass",
  border: "--color-border",
  borderStrong: "--color-border-strong",
  borderSubtle: "--color-border-subtle",
  text: "--color-text",
  textMuted: "--color-text-muted",
  cpu: "--color-cpu",
  memory: "--color-memory",
  disk: "--color-disk",
  networkRx: "--color-network-rx",
  networkTx: "--color-network-tx",
  warning: "--color-warning",
  danger: "--color-danger",
  accent: "--color-accent",
  accentSoft: "--color-accent-soft",
  chartGrid: "--color-chart-grid",
  chartFill: "--color-chart-fill",
  barTrack: "--color-bar-track",
  rowHover: "--color-row-hover",
  shadow: "--shadow-panel",
  glow: "--shadow-glow",
  input: "--color-input",
  overlay: "--color-overlay",
  noise: "--color-noise",
} as const;

export function applyTheme(theme: VPScopeTheme) {
  const root = document.documentElement;

  Object.entries(tokenMap).forEach(([key, cssVariable]) => {
    root.style.setProperty(cssVariable, theme.colors[key as keyof VPScopeTheme["colors"]]);
  });

  root.style.setProperty("--radius-panel", theme.radius.panel);
  root.style.setProperty("--radius-control", theme.radius.control);
  root.style.setProperty("--font-ui", theme.font.ui);
  root.style.setProperty("--font-mono", theme.font.mono);
  theme.chart.barSteps.forEach((step, index) => {
    root.style.setProperty(`--color-bar-step-${index}`, step);
  });
  root.dataset.theme = theme.id;
  root.dataset.themeMode = theme.mode;
  localStorage.setItem("vpscope-theme", theme.id);
}
