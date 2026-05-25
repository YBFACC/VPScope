import type { VPScopeTheme } from "./types";

const mono = '"JetBrains Mono", "SF Mono", Monaco, Consolas, monospace';
const ui = 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

export const btopClassic: VPScopeTheme = {
  id: "btop-classic",
  name: "Btop Classic",
  mode: "dark",
  colors: {
    bg: "#050605",
    panel: "#090b09",
    panelMuted: "#111511",
    border: "#314238",
    borderStrong: "#55705f",
    text: "#e8ede8",
    textMuted: "#89928a",
    cpu: "#8ff0b4",
    memory: "#f4d35e",
    disk: "#a7e879",
    networkRx: "#b56cff",
    networkTx: "#4dd8ff",
    warning: "#ffba52",
    danger: "#ff6b6b",
    accent: "#92d7ff",
    chartGrid: "#1e2a22",
    barTrack: "#2b302c",
    rowHover: "#121a14",
    shadow: "0 16px 40px rgba(0, 0, 0, 0.34)",
    input: "#0c100d",
    overlay: "rgba(0, 0, 0, 0.42)",
  },
  radius: {
    panel: "6px",
    control: "5px",
  },
  font: { ui, mono },
  chart: {
    barSteps: ["#55705f", "#8ff0b4", "#f4d35e", "#ffba52", "#ff6b6b"],
  },
};

export const macGraphite: VPScopeTheme = {
  id: "mac-graphite",
  name: "Mac Graphite",
  mode: "dark",
  colors: {
    bg: "#101214",
    panel: "#171a1d",
    panelMuted: "#202428",
    border: "#343a40",
    borderStrong: "#555f68",
    text: "#edf0f2",
    textMuted: "#9ba3aa",
    cpu: "#78d8c7",
    memory: "#d8c36a",
    disk: "#91c579",
    networkRx: "#9eb5ff",
    networkTx: "#6dc7ee",
    warning: "#e6a85e",
    danger: "#f06f78",
    accent: "#c8d0d8",
    chartGrid: "#2a3035",
    barTrack: "#262b30",
    rowHover: "#21262b",
    shadow: "0 18px 48px rgba(0, 0, 0, 0.3)",
    input: "#111417",
    overlay: "rgba(0, 0, 0, 0.38)",
  },
  radius: {
    panel: "8px",
    control: "6px",
  },
  font: { ui, mono },
  chart: {
    barSteps: ["#4a535b", "#78d8c7", "#d8c36a", "#e6a85e", "#f06f78"],
  },
};

export const lightLab: VPScopeTheme = {
  id: "light-lab",
  name: "Light Lab",
  mode: "light",
  colors: {
    bg: "#eef0ec",
    panel: "#fbfcf7",
    panelMuted: "#edf1e9",
    border: "#c5ccc1",
    borderStrong: "#8b978b",
    text: "#18201b",
    textMuted: "#5f6d62",
    cpu: "#247a57",
    memory: "#9b711d",
    disk: "#4f7d2c",
    networkRx: "#6553bf",
    networkTx: "#127899",
    warning: "#b7631d",
    danger: "#b73542",
    accent: "#256b84",
    chartGrid: "#d7ded3",
    barTrack: "#e1e6de",
    rowHover: "#eef4ea",
    shadow: "0 16px 36px rgba(37, 47, 38, 0.12)",
    input: "#f6f8f3",
    overlay: "rgba(24, 32, 27, 0.22)",
  },
  radius: {
    panel: "8px",
    control: "6px",
  },
  font: { ui, mono },
  chart: {
    barSteps: ["#c5ccc1", "#247a57", "#9b711d", "#b7631d", "#b73542"],
  },
};

export const themePresets = [btopClassic, macGraphite, lightLab] as const;

export type ThemeId = (typeof themePresets)[number]["id"];

export function getThemeById(themeId: string | null | undefined) {
  return themePresets.find((theme) => theme.id === themeId) ?? btopClassic;
}
