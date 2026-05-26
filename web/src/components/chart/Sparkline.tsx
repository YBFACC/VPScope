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
  const normalizedValues = values.length > 0 ? values : [0];
  const points =
    normalizedValues.length > 1
      ? normalizedValues
          .map((value, index) => {
            const x = (index / (normalizedValues.length - 1)) * width;
            const y = height - (Math.max(0, Math.min(value, ceiling)) / ceiling) * (height - 4) - 2;
            return `${x.toFixed(1)},${y.toFixed(1)}`;
          })
          .join(" ")
      : "";
  const areaPoints = points ? `0,${height} ${points} ${width},${height}` : "";

  return (
    <svg className="block h-full w-full overflow-hidden" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
      {showGrid ? (
        <>
          <path d={`M 0 ${height - 1} H ${width}`} stroke="var(--color-chart-grid)" strokeWidth="1" />
          <path d={`M 0 ${Math.round(height * 0.34)} H ${width}`} stroke="var(--color-chart-grid)" strokeDasharray="2 5" strokeWidth="1" />
          <path d={`M 0 ${Math.round(height * 0.67)} H ${width}`} stroke="var(--color-chart-grid)" strokeDasharray="2 5" strokeWidth="1" />
        </>
      ) : null}
      {areaPoints ? <polygon points={areaPoints} fill={fillColor} /> : null}
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={strokeWidth}
      />
    </svg>
  );
}
