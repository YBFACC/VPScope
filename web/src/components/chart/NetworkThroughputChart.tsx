type NetworkThroughputChartProps = {
  rxValues: number[];
  txValues: number[];
  rxColor?: string;
  txColor?: string;
  max?: number;
  height?: number;
};

const CHART_WIDTH = 220;
const MIN_COLUMNS = 24;
const MAX_COLUMNS = 72;
const ROWS_PER_DIRECTION = 8;
const SECTION_GAP = 8;

function normalizeSeries(values: number[], columns: number) {
  const normalizedValues = values.length > 0 ? values.slice(-columns) : [0];

  return normalizedValues.length < columns
    ? [...Array.from({ length: columns - normalizedValues.length }, () => 0), ...normalizedValues]
    : normalizedValues;
}

export function NetworkThroughputChart({
  rxValues,
  txValues,
  rxColor = "var(--color-network-rx)",
  txColor = "var(--color-network-tx)",
  max,
  height = 108,
}: NetworkThroughputChartProps) {
  const columns = Math.min(MAX_COLUMNS, Math.max(MIN_COLUMNS, rxValues.length, txValues.length, MIN_COLUMNS));
  const ceiling = max ?? Math.max(1, ...rxValues, ...txValues);
  const rxSeries = normalizeSeries(rxValues, columns);
  const txSeries = normalizeSeries(txValues, columns);
  const cellWidth = CHART_WIDTH / columns;
  const sectionHeight = (height - SECTION_GAP) / 2;
  const cellHeight = sectionHeight / ROWS_PER_DIRECTION;
  const dotSize = Math.max(2, Math.min(cellWidth, cellHeight) - 1);
  const xOffset = (cellWidth - dotSize) / 2;
  const yOffset = (cellHeight - dotSize) / 2;
  const lowerSectionY = sectionHeight + SECTION_GAP;
  const gridBottom = Math.max(0, height - 1);
  const rxCells = rxSeries.map((value) => Math.round((Math.max(0, Math.min(value, ceiling)) / ceiling) * ROWS_PER_DIRECTION));
  const txCells = txSeries.map((value) => Math.round((Math.max(0, Math.min(value, ceiling)) / ceiling) * ROWS_PER_DIRECTION));

  return (
    <svg
      className="pixel-sparkline block h-full w-full overflow-hidden"
      viewBox={`0 0 ${CHART_WIDTH} ${height}`}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <rect width={CHART_WIDTH} height={height} fill="var(--color-input)" opacity="0.38" />
      {Array.from({ length: 7 }, (_, index) => {
        const x = Math.round((index / 6) * CHART_WIDTH);
        return (
          <line
            key={`v-${index}`}
            x1={x}
            x2={x}
            y1="0"
            y2={gridBottom}
            stroke="var(--color-chart-grid)"
            strokeWidth="1"
            opacity="0.26"
          />
        );
      })}
      {Array.from({ length: 4 }, (_, index) => {
        const y = Math.round(((index + 1) / 5) * height);
        return (
          <line
            key={`h-${index}`}
            x1="0"
            x2={CHART_WIDTH}
            y1={y}
            y2={y}
            stroke="var(--color-chart-grid)"
            strokeWidth="1"
            opacity="0.28"
          />
        );
      })}
      <line
        x1="0"
        x2={CHART_WIDTH}
        y1={sectionHeight}
        y2={sectionHeight}
        stroke="var(--color-border-strong)"
        strokeWidth="1"
        opacity="0.9"
      />
      {rxCells.map((activeRows, columnIndex) =>
        Array.from({ length: ROWS_PER_DIRECTION }, (_, rowIndex) => {
          const filled = rowIndex < activeRows;
          const age = columnIndex / Math.max(1, columns - 1);
          const x = Math.round(columnIndex * cellWidth + xOffset);
          const y = Math.round(rowIndex * cellHeight + yOffset);

          return (
            <rect
              key={`rx-${columnIndex}-${rowIndex}`}
              x={x}
              y={y}
              width={dotSize}
              height={dotSize}
              fill={filled ? rxColor : "var(--color-bar-track)"}
              opacity={filled ? 0.44 + age * 0.56 : 0.18}
            />
          );
        }),
      )}
      {txCells.map((activeRows, columnIndex) =>
        Array.from({ length: ROWS_PER_DIRECTION }, (_, rowIndex) => {
          const filled = rowIndex < activeRows;
          const age = columnIndex / Math.max(1, columns - 1);
          const x = Math.round(columnIndex * cellWidth + xOffset);
          const y = Math.round(lowerSectionY + rowIndex * cellHeight + yOffset);

          return (
            <rect
              key={`tx-${columnIndex}-${rowIndex}`}
              x={x}
              y={y}
              width={dotSize}
              height={dotSize}
              fill={filled ? txColor : "var(--color-bar-track)"}
              opacity={filled ? 0.44 + age * 0.56 : 0.18}
            />
          );
        }),
      )}
    </svg>
  );
}
