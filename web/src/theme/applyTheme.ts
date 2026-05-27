import type { VPScopeTheme } from "./types";
import { LOAD_TONE_STEPS, type LoadToneScale } from "@/lib/loadTone";

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

const toneSourceMap: Record<LoadToneScale, keyof VPScopeTheme["colors"]> = {
  cpu: "cpu",
  memory: "memory",
  disk: "disk",
  networkRx: "networkRx",
  networkTx: "networkTx",
  warning: "warning",
};

const toneCssPrefixMap: Record<LoadToneScale, string> = {
  cpu: "cpu",
  memory: "memory",
  disk: "disk",
  networkRx: "network-rx",
  networkTx: "network-tx",
  warning: "warning",
};

const toneTargetMap: Record<LoadToneScale, string> = {
  cpu: "#ff9f2f",
  memory: "#ff5fb8",
  disk: "#ffd24a",
  networkRx: "#ff4fd8",
  networkTx: "#2f6dff",
  warning: "#b87222",
};

function parseHexColor(color: string) {
  const normalized = color.trim().replace("#", "");

  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) {
    return undefined;
  }

  return {
    r: Number.parseInt(normalized.slice(0, 2), 16),
    g: Number.parseInt(normalized.slice(2, 4), 16),
    b: Number.parseInt(normalized.slice(4, 6), 16),
  };
}

function toHexChannel(value: number) {
  return Math.round(Math.max(0, Math.min(255, value))).toString(16).padStart(2, "0");
}

function mixHexColor(startColor: string, endColor: string, amount: number) {
  const start = parseHexColor(startColor);
  const end = parseHexColor(endColor);

  if (!start || !end) {
    return startColor;
  }

  const startWeight = 1 - amount;

  return `#${toHexChannel(start.r * startWeight + end.r * amount)}${toHexChannel(start.g * startWeight + end.g * amount)}${toHexChannel(start.b * startWeight + end.b * amount)}`;
}

function applyToneScale(root: HTMLElement, scale: LoadToneScale, color: string) {
  const prefix = toneCssPrefixMap[scale];
  const targetColor = toneTargetMap[scale];

  Array.from({ length: LOAD_TONE_STEPS }, (_, index) => {
    const progress = index / Math.max(1, LOAD_TONE_STEPS - 1);
    const colorAmount = Math.min(1, progress * 1.1);
    const toneColor = mixHexColor(color, targetColor, colorAmount);

    root.style.setProperty(`--color-${prefix}-tone-${index}`, toneColor);
  });
}

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
  Object.entries(toneSourceMap).forEach(([scale, colorKey]) => {
    applyToneScale(root, scale as LoadToneScale, theme.colors[colorKey]);
  });
  root.dataset.theme = theme.id;
  root.dataset.themeMode = theme.mode;
  localStorage.setItem("vpscope-theme", theme.id);
}
