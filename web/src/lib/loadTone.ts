export const LOAD_TONE_STEPS = 8;

export type LoadToneScale = "cpu" | "memory" | "disk" | "networkRx" | "networkTx" | "warning";

const toneScaleCssPrefix: Record<LoadToneScale, string> = {
  cpu: "cpu",
  memory: "memory",
  disk: "disk",
  networkRx: "network-rx",
  networkTx: "network-tx",
  warning: "warning",
};

function clampPercent(value: number) {
  return Math.max(0, Math.min(100, value));
}

export function getLoadToneStep(value: number) {
  return Math.min(LOAD_TONE_STEPS - 1, Math.floor((clampPercent(value) / 100) * LOAD_TONE_STEPS));
}

export function getLoadToneColor(scale: LoadToneScale, value: number) {
  return `var(--color-${toneScaleCssPrefix[scale]}-tone-${getLoadToneStep(value)})`;
}
