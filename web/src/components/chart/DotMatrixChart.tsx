import { PIXEL_DENSITY } from "@/components/pixelDensity";

type DotMatrixChartProps = {
  values: number[];
  color?: string;
  max?: number;
  rows?: number;
  minColumns?: number;
  maxColumns?: number;
  className?: string;
  invert?: boolean;
  cellSize?: number;
  dotSize?: number;
  inactiveOpacity?: number;
  minActiveRows?: number;
};

function normalizeSeries(values: number[], columns: number) {
  const normalizedValues = values.length > 0 ? values.slice(-columns) : [0];

  return normalizedValues.length < columns
    ? [...Array.from({ length: columns - normalizedValues.length }, () => 0), ...normalizedValues]
    : normalizedValues;
}

export function DotMatrixChart({
  values,
  color = "var(--color-accent)",
  max,
  rows = 14,
  minColumns = PIXEL_DENSITY.dotChart.minColumns,
  maxColumns = PIXEL_DENSITY.dotChart.maxColumns,
  className,
  invert = false,
  cellSize = PIXEL_DENSITY.dotChart.cellSize,
  dotSize = PIXEL_DENSITY.dotChart.dotSize,
  inactiveOpacity = PIXEL_DENSITY.dotChart.inactiveOpacity,
  minActiveRows = 1,
}: DotMatrixChartProps) {
  const columns = Math.min(maxColumns, Math.max(minColumns, values.length || minColumns));
  const ceiling = max ?? Math.max(1, ...values);
  const series = normalizeSeries(values, columns);
  const width = columns * cellSize;
  const height = rows * cellSize;
  const activeCells = series.map((value) => {
    const clampedValue = Math.max(0, Math.min(value, ceiling));

    return clampedValue > 0
      ? Math.max(minActiveRows, Math.ceil((clampedValue / ceiling) * rows))
      : 0;
  });

  return (
    <svg
      aria-hidden="true"
      className={className ?? "terminal-dot-chart"}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
    >
      {activeCells.map((activeRows, columnIndex) =>
        Array.from({ length: rows }, (_, rowIndex) => {
          const filled = invert ? rowIndex < activeRows : rows - rowIndex <= activeRows;
          const age = columnIndex / Math.max(1, columns - 1);

          return (
            <rect
              key={`${columnIndex}-${rowIndex}`}
              x={columnIndex * cellSize}
              y={rowIndex * cellSize}
              width={dotSize}
              height={dotSize}
              fill={filled ? color : "var(--color-bar-track)"}
              opacity={filled ? 0.42 + age * 0.58 : inactiveOpacity}
            />
          );
        }),
      )}
    </svg>
  );
}
