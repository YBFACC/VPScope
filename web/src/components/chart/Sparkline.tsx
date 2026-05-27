type SparklineProps = {
  values: number[];
  color?: string;
  fillColor?: string;
  height?: number;
  max?: number;
  showGrid?: boolean;
  strokeWidth?: number;
};

export function Sparkline({
  values,
  color = "var(--color-accent)",
  fillColor = "transparent",
  height = 44,
  max,
  showGrid = true,
  strokeWidth = 2,
}: SparklineProps) {
  const width = 220;
  const ceiling = max ?? Math.max(1, ...values);
  const rows = 10;
  const columns = Math.min(72, Math.max(24, values.length || 24));
  const normalizedValues = values.length > 0 ? values.slice(-columns) : [0];
  const paddedValues =
    normalizedValues.length < columns
      ? [...Array.from({ length: columns - normalizedValues.length }, () => 0), ...normalizedValues]
      : normalizedValues;
  const gap = Math.max(1, Math.round(strokeWidth));
  const cellWidth = width / columns;
  const cellHeight = height / rows;
  const dotSize = Math.max(2, Math.min(cellWidth, cellHeight) - gap);
  const xOffset = (cellWidth - dotSize) / 2;
  const yOffset = (cellHeight - dotSize) / 2;
  const activeCells = paddedValues.map((value) => {
    const clamped = Math.max(0, Math.min(value, ceiling));
    return Math.round((clamped / ceiling) * rows);
  });

  return (
    <svg className="pixel-sparkline block h-full w-full overflow-hidden" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
      <rect width={width} height={height} fill="var(--color-input)" opacity="0.32" />
      {showGrid ? (
        <>
          {Array.from({ length: 7 }, (_, index) => {
            const x = Math.round((index / 6) * width);
            return <line key={`v-${index}`} x1={x} x2={x} y1="0" y2={height} stroke="var(--color-chart-grid)" strokeWidth="1" opacity="0.26" />;
          })}
          {Array.from({ length: 3 }, (_, index) => {
            const y = Math.round(((index + 1) / 4) * height);
            return <line key={`h-${index}`} x1="0" x2={width} y1={y} y2={y} stroke="var(--color-chart-grid)" strokeWidth="1" opacity="0.38" />;
          })}
          <line x1="0" x2={width} y1={height - 1} y2={height - 1} stroke="var(--color-chart-grid)" strokeWidth="1" />
        </>
      ) : null}
      <rect width={width} height={height} fill={fillColor} opacity="0.18" />
      {activeCells.map((activeRows, columnIndex) =>
        Array.from({ length: rows }, (_, rowIndex) => {
          const filled = rows - rowIndex <= activeRows;
          const age = columnIndex / Math.max(1, columns - 1);
          const x = Math.round(columnIndex * cellWidth + xOffset);
          const y = Math.round(rowIndex * cellHeight + yOffset);

          return (
            <rect
              key={`${columnIndex}-${rowIndex}`}
              x={x}
              y={y}
              width={dotSize}
              height={dotSize}
              fill={filled ? color : "var(--color-bar-track)"}
              opacity={filled ? 0.48 + age * 0.52 : 0.34}
            />
          );
        }),
      )}
    </svg>
  );
}
