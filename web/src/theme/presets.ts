import type { VPScopeTheme } from "./types";

const mono = '"JetBrains Mono", "SF Mono", Monaco, Consolas, monospace';
const ui = '"JetBrains Mono", "SF Mono", Monaco, Consolas, ui-monospace, monospace';

export const btopClassic: VPScopeTheme = {
  id: "btop-classic",
  name: "Btop Classic",
  mode: "dark",
  colors: {
    bg: "#020404",
    panel: "#050b0b",
    panelRaised: "#081313",
    panelMuted: "#0d1f1d",
    panelGlass: "rgba(5, 12, 12, 0.96)",
    border: "#2a5b4f",
    borderStrong: "#7dfad1",
    borderSubtle: "#15352f",
    text: "#eafff6",
    textMuted: "#79a89b",
    cpu: "#38f2d1",
    memory: "#5f8cff",
    disk: "#75df62",
    networkRx: "#c084fc",
    networkTx: "#35cfff",
    warning: "#ff9f2f",
    danger: "#ff4d6a",
    accent: "#58f6ff",
    accentSoft: "rgba(88, 246, 255, 0.18)",
    chartGrid: "#18453c",
    chartFill: "rgba(82, 255, 145, 0.16)",
    barTrack: "#0d201d",
    rowHover: "#0f2d27",
    shadow: "inset 0 0 0 1px rgba(125, 250, 209, 0.12), 0 0 0 1px rgba(0, 0, 0, 0.72)",
    glow: "0 0 10px rgba(88, 246, 255, 0.28), 0 0 2px rgba(88, 246, 255, 0.9)",
    input: "#030808",
    overlay: "rgba(0, 0, 0, 0.74)",
    noise: "rgba(125, 250, 209, 0.035)",
  },
  radius: {
    panel: "3px",
    control: "2px",
  },
  font: { ui, mono },
  chart: {
    barSteps: ["#14372f", "#52ff91", "#ffd24a", "#ff9f2f", "#ff4d6a"],
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
    cpu: "#65d9c4",
    memory: "#789de0",
    disk: "#7fc96b",
    networkRx: "#ad8be0",
    networkTx: "#63c2e8",
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
    cpu: "#08786b",
    memory: "#275faa",
    disk: "#458f37",
    networkRx: "#754abd",
    networkTx: "#0d7da0",
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
