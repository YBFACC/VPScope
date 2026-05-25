export type VPScopeTheme = {
  id: string;
  name: string;
  mode: "dark" | "light";
  colors: {
    bg: string;
    panel: string;
    panelMuted: string;
    border: string;
    borderStrong: string;
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
    chartGrid: string;
    barTrack: string;
    rowHover: string;
    shadow: string;
    input: string;
    overlay: string;
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
