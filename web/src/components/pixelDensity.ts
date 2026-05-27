export const PIXEL_DENSITY = {
  dotChart: {
    cellSize: 3,
    dotSize: 2,
    inactiveOpacity: 0.1,
    minColumns: 72,
    maxColumns: 192,
  },
  cpuChart: {
    minColumns: 176,
    maxColumns: 288,
  },
  networkChart: {
    minColumns: 92,
    maxColumns: 168,
  },
  meter: {
    segments: 36,
    compactSegments: 20,
  },
  memory: {
    columns: 48,
    rows: 4,
  },
} as const;
