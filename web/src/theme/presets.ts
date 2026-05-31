import type { VPScopeTheme } from "./types";

const mono = '"JetBrains Mono", "SF Mono", Monaco, Consolas, monospace';
const ui = '"JetBrains Mono", "SF Mono", Monaco, Consolas, ui-monospace, monospace';

export const opsNight: VPScopeTheme = {
  id: "ops-night",
  name: "Ops Night",
  mode: "dark",
  colors: {
    bg: "#070a0b",
    panel: "#0b1112",
    panelRaised: "#11191a",
    panelMuted: "#152123",
    panelGlass: "rgba(11, 17, 18, 0.96)",
    border: "#284247",
    borderStrong: "#68e6d2",
    borderSubtle: "#17282b",
    text: "#e8fff7",
    textMuted: "#83a39c",
    cpu: "#46e3c8",
    memory: "#82a7ff",
    disk: "#8bd86a",
    networkRx: "#d07cff",
    networkTx: "#48c9ff",
    warning: "#f5b14a",
    danger: "#ff5b70",
    accent: "#5de7f0",
    accentSoft: "rgba(93, 231, 240, 0.18)",
    chartGrid: "#1b383a",
    chartFill: "rgba(70, 227, 200, 0.14)",
    barTrack: "#101b1d",
    rowHover: "#14272a",
    shadow: "inset 0 0 0 1px rgba(104, 230, 210, 0.11), 0 0 0 1px rgba(0, 0, 0, 0.64)",
    glow: "0 0 12px rgba(93, 231, 240, 0.24), 0 0 2px rgba(93, 231, 240, 0.8)",
    input: "#080d0e",
    overlay: "rgba(0, 0, 0, 0.72)",
    noise: "rgba(104, 230, 210, 0.03)",
  },
  radius: {
    panel: "3px",
    control: "2px",
  },
  font: { ui, mono },
  chart: {
    barSteps: ["#142528", "#46e3c8", "#d6d95a", "#f79a38", "#ff5b70"],
    toneScales: {
      cpu: ["#46e3c8", "#63dec0", "#83d7a6", "#a8cd7e", "#d6c35d", "#f5b14a", "#f78a3d", "#ff5b70"],
      memory: ["#82a7ff", "#91a1f0", "#a79adc", "#bd94c4", "#d39199", "#e69369", "#f18643", "#ff5b70"],
      disk: ["#8bd86a", "#a4d465", "#bdd060", "#d6c85c", "#e8bd52", "#f5a845", "#fb883d", "#ff5b70"],
      networkRx: ["#d07cff", "#d982e4", "#df88c8", "#e58faa", "#ea9981", "#f0a55d", "#f28a45", "#ff5b70"],
      networkTx: ["#48c9ff", "#5fc4ea", "#78bdd2", "#93b6b6", "#b7ad86", "#d5a35f", "#eb8b43", "#ff5b70"],
      warning: ["#f5b14a", "#f2a747", "#ef9d43", "#ed9340", "#ea893c", "#e67f39", "#dd6b3d", "#cf4f4f"],
    },
  },
};

export const sandTerminal: VPScopeTheme = {
  id: "sand-terminal",
  name: "Sand Terminal",
  mode: "light",
  colors: {
    bg: "#eee6d4",
    panel: "#fbf4e4",
    panelRaised: "#fff9ec",
    panelMuted: "#efe3cc",
    panelGlass: "rgba(251, 244, 228, 0.94)",
    border: "#b9a98d",
    borderStrong: "#7f6b43",
    borderSubtle: "#d7c8aa",
    text: "#221d15",
    textMuted: "#75664f",
    cpu: "#007f73",
    memory: "#315fbd",
    disk: "#4f8f2f",
    networkRx: "#8b4fc4",
    networkTx: "#097d9f",
    warning: "#a86614",
    danger: "#b33642",
    accent: "#326b68",
    accentSoft: "rgba(50, 107, 104, 0.12)",
    chartGrid: "#d5c7ab",
    chartFill: "rgba(0, 127, 115, 0.1)",
    barTrack: "#e4d8bf",
    rowHover: "#f4ead7",
    shadow: "0 14px 32px rgba(91, 73, 42, 0.13), inset 0 1px 0 rgba(255, 255, 255, 0.42)",
    glow: "0 0 18px rgba(50, 107, 104, 0.12)",
    input: "#f6eddc",
    overlay: "rgba(34, 29, 21, 0.22)",
    noise: "rgba(91, 73, 42, 0.026)",
  },
  radius: {
    panel: "5px",
    control: "3px",
  },
  font: { ui, mono },
  chart: {
    barSteps: ["#d7c8aa", "#007f73", "#9e8c22", "#b6651e", "#b33642"],
    toneScales: {
      cpu: ["#007f73", "#23886e", "#4b9061", "#73924d", "#958c36", "#a9791e", "#b65f25", "#b33642"],
      memory: ["#315fbd", "#4b68ad", "#647096", "#7b7776", "#91794f", "#a47527", "#b3601f", "#b33642"],
      disk: ["#4f8f2f", "#6b9331", "#829132", "#988b2d", "#a98222", "#b3721b", "#b96020", "#b33642"],
      networkRx: ["#8b4fc4", "#934fac", "#9b5191", "#a05573", "#a65d50", "#ab672b", "#b65d25", "#b33642"],
      networkTx: ["#097d9f", "#2c8190", "#4d827c", "#6d8062", "#8b7a42", "#a17022", "#b25e20", "#b33642"],
      warning: ["#a86614", "#aa6317", "#ad601a", "#af5d1d", "#b15921", "#b25427", "#b14832", "#a83b3f"],
    },
  },
};

export const lightConsole: VPScopeTheme = {
  id: "light-console",
  name: "Light Console",
  mode: "light",
  colors: {
    bg: "#f5f7f3",
    panel: "#ffffff",
    panelRaised: "#f9fbf8",
    panelMuted: "#edf2ec",
    panelGlass: "rgba(255, 255, 255, 0.94)",
    border: "#b8c2ba",
    borderStrong: "#56665c",
    borderSubtle: "#d9e0d8",
    text: "#111814",
    textMuted: "#5d6a61",
    cpu: "#00796b",
    memory: "#285bb8",
    disk: "#3f8734",
    networkRx: "#7446b7",
    networkTx: "#007fa8",
    warning: "#b45f12",
    danger: "#ba2f45",
    accent: "#1f6d7a",
    accentSoft: "rgba(31, 109, 122, 0.1)",
    chartGrid: "#dbe3dc",
    chartFill: "rgba(0, 121, 107, 0.08)",
    barTrack: "#e8eee8",
    rowHover: "#eef5ee",
    shadow: "0 12px 28px rgba(24, 36, 28, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.72)",
    glow: "0 0 18px rgba(31, 109, 122, 0.1)",
    input: "#f3f6f1",
    overlay: "rgba(17, 24, 20, 0.2)",
    noise: "rgba(17, 24, 20, 0.022)",
  },
  radius: {
    panel: "6px",
    control: "4px",
  },
  font: { ui, mono },
  chart: {
    barSteps: ["#d9e0d8", "#00796b", "#a68d16", "#c86518", "#ba2f45"],
    toneScales: {
      cpu: ["#00796b", "#24846b", "#4b8b5d", "#729049", "#98902b", "#b78316", "#c7651a", "#ba2f45"],
      memory: ["#285bb8", "#4666ad", "#637098", "#7c7878", "#958053", "#ad8028", "#c46418", "#ba2f45"],
      disk: ["#3f8734", "#5e9037", "#7b9436", "#97942e", "#ad8b20", "#bd7c17", "#c8661a", "#ba2f45"],
      networkRx: ["#7446b7", "#844fa7", "#925995", "#9c657f", "#a8745d", "#b98131", "#c76519", "#ba2f45"],
      networkTx: ["#007fa8", "#2587a0", "#4a8b8e", "#6d8d77", "#908a54", "#ad7d29", "#c46518", "#ba2f45"],
      warning: ["#b45f12", "#b65c15", "#b85918", "#ba561c", "#bc5221", "#bd4e28", "#bd4434", "#ba2f45"],
    },
  },
};

export const themePresets = [opsNight, sandTerminal, lightConsole] as const;

export type ThemeId = (typeof themePresets)[number]["id"];

export function getThemeById(themeId: string | null | undefined) {
  return themePresets.find((theme) => theme.id === themeId) ?? opsNight;
}
