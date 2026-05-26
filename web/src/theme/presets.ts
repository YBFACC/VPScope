import type { VPScopeTheme } from "./types";

const mono = '"JetBrains Mono", "SF Mono", Monaco, Consolas, monospace';
const ui = 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

export const btopClassic: VPScopeTheme = {
  id: "btop-classic",
  name: "Btop Classic",
  mode: "dark",
  colors: {
    bg: "#030607",
    panel: "#07100f",
    panelRaised: "#0b1716",
    panelMuted: "#10201d",
    panelGlass: "rgba(8, 20, 19, 0.86)",
    border: "#243d37",
    borderStrong: "#5c8a7a",
    borderSubtle: "#132521",
    text: "#edf5ef",
    textMuted: "#82948b",
    cpu: "#62ef9b",
    memory: "#ffd166",
    disk: "#9ee86f",
    networkRx: "#a985ff",
    networkTx: "#43dcff",
    warning: "#ffae42",
    danger: "#ff5f6d",
    accent: "#7fdcff",
    accentSoft: "rgba(127, 220, 255, 0.16)",
    chartGrid: "#16312c",
    chartFill: "rgba(98, 239, 155, 0.12)",
    barTrack: "#17201d",
    rowHover: "#10231f",
    shadow: "0 18px 52px rgba(0, 0, 0, 0.42), inset 0 1px 0 rgba(255, 255, 255, 0.035)",
    glow: "0 0 34px rgba(127, 220, 255, 0.14)",
    input: "#07110f",
    overlay: "rgba(0, 0, 0, 0.58)",
    noise: "rgba(255, 255, 255, 0.035)",
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
    bg: "#0d1012",
    panel: "#14181b",
    panelRaised: "#1a2024",
    panelMuted: "#20272c",
    panelGlass: "rgba(20, 24, 27, 0.9)",
    border: "#333d43",
    borderStrong: "#66737c",
    borderSubtle: "#20282d",
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
    accentSoft: "rgba(200, 208, 216, 0.13)",
    chartGrid: "#2a3035",
    chartFill: "rgba(120, 216, 199, 0.12)",
    barTrack: "#262b30",
    rowHover: "#21262b",
    shadow: "0 18px 48px rgba(0, 0, 0, 0.34), inset 0 1px 0 rgba(255, 255, 255, 0.035)",
    glow: "0 0 30px rgba(200, 208, 216, 0.1)",
    input: "#111417",
    overlay: "rgba(0, 0, 0, 0.38)",
    noise: "rgba(255, 255, 255, 0.03)",
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
    panelRaised: "#ffffff",
    panelMuted: "#edf1e9",
    panelGlass: "rgba(251, 252, 247, 0.92)",
    border: "#c5ccc1",
    borderStrong: "#8b978b",
    borderSubtle: "#dce2d8",
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
    accentSoft: "rgba(37, 107, 132, 0.1)",
    chartGrid: "#d7ded3",
    chartFill: "rgba(36, 122, 87, 0.1)",
    barTrack: "#e1e6de",
    rowHover: "#eef4ea",
    shadow: "0 16px 36px rgba(37, 47, 38, 0.12)",
    glow: "0 0 22px rgba(37, 107, 132, 0.1)",
    input: "#f6f8f3",
    overlay: "rgba(24, 32, 27, 0.22)",
    noise: "rgba(24, 32, 27, 0.025)",
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
