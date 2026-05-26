import { formatPercent } from "@/lib/format";

type UsageRingProps = {
  value: number;
  label: string;
  color?: string;
  detail?: string;
  size?: number;
};

export function UsageRing({
  value,
  label,
  color = "var(--color-accent)",
  detail,
  size = 112,
}: UsageRingProps) {
  const clamped = Math.max(0, Math.min(100, value));
  const stroke = 10;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - clamped / 100);

  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      <svg className="absolute inset-0 h-full w-full -rotate-90" viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--color-bar-track)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
          strokeWidth={stroke}
          className="transition-[stroke-dashoffset] duration-300"
          style={{ filter: `drop-shadow(0 0 10px ${color})` }}
        />
      </svg>
      <div className="grid min-w-0 place-items-center gap-1 text-center font-mono">
        <div className="text-3xl font-semibold leading-none text-[var(--color-text)] tabular-nums">
          {formatPercent(clamped)}
        </div>
        <div className="max-w-20 truncate text-[10px] uppercase text-[var(--color-text-muted)]">{label}</div>
        {detail ? <div className="max-w-24 truncate text-[11px] text-[var(--color-text-muted)]">{detail}</div> : null}
      </div>
    </div>
  );
}
