export type VPScopeTheme = {
  id: string;
  name: string;
  mode: "dark" | "light";
  colors: {
    bg: string;
    panel: string;
    panelRaised: string;
    panelMuted: string;
    panelGlass: string;
    border: string;
    borderStrong: string;
    borderSubtle: string;
    text: string;
    textMuted: string;
    cpu: string;
    memory: string;
    disk: string;
    networkRx: string;
    networkTx: string;
    warning: string;
    danger: string;
    accent: string;
    accentSoft: string;
    chartGrid: string;
    chartFill: string;
    barTrack: string;
    rowHover: string;
    shadow: string;
    glow: string;
    input: string;
    overlay: string;
    noise: string;
  };
  radius: {
    panel: string;
    control: string;
  };
  font: {
    ui: string;
    mono: string;
  };
  chart: {
    barSteps: string[];
  };
};
