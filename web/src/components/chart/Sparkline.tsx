type SparklineProps = {
  values: number[];
  color?: string;
  height?: number;
  max?: number;
};

export function Sparkline({ values, color = "var(--color-accent)", height = 44, max }: SparklineProps) {
  const width = 220;
  const ceiling = max ?? Math.max(1, ...values);
  const points =
    values.length > 1
      ? values
          .map((value, index) => {
            const x = (index / (values.length - 1)) * width;
            const y = height - (Math.max(0, Math.min(value, ceiling)) / ceiling) * (height - 4) - 2;
            return `${x.toFixed(1)},${y.toFixed(1)}`;
          })
          .join(" ")
      : "";

  return (
    <svg className="h-full w-full overflow-visible" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
      <path d={`M 0 ${height - 1} H ${width}`} stroke="var(--color-chart-grid)" strokeWidth="1" />
      <polyline points={points} fill="none" stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
    </svg>
  );
}
