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
  const stroke = 8;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - clamped / 100);
  const ticks = 32;
  const activeTicks = Math.round((clamped / 100) * ticks);

  return (
    <div className="relative grid place-items-center border border-[var(--color-border-subtle)] bg-[var(--color-input)]" style={{ width: size, height: size }}>
      <svg className="absolute inset-0 h-full w-full -rotate-90" viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--color-bar-track)"
          strokeWidth={stroke}
        />
        {Array.from({ length: ticks }, (_, index) => {
          const angle = (index / ticks) * 360;
          const active = index < activeTicks;
          const tickLength = index % 4 === 0 ? 7 : 4;
          const outer = size / 2 - 3;
          const inner = outer - tickLength;
          const radians = (angle * Math.PI) / 180;
          const x1 = size / 2 + Math.cos(radians) * inner;
          const y1 = size / 2 + Math.sin(radians) * inner;
          const x2 = size / 2 + Math.cos(radians) * outer;
          const y2 = size / 2 + Math.sin(radians) * outer;

          return (
            <line
              key={index}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke={active ? color : "var(--color-border-subtle)"}
              strokeWidth={index % 4 === 0 ? 2 : 1}
              strokeLinecap="square"
              opacity={active ? 1 : 0.62}
            />
          );
        })}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          strokeLinecap="butt"
          strokeWidth={stroke}
          className="transition-[stroke-dashoffset] duration-300"
          style={{ filter: `drop-shadow(0 0 5px ${color})` }}
        />
      </svg>
      <div className="grid min-w-0 place-items-center gap-0.5 text-center font-mono">
        <div className="text-lg font-semibold leading-none text-[var(--color-text)] tabular-nums">
          {formatPercent(clamped)}
        </div>
        <div className="max-w-20 truncate text-[9px] uppercase text-[var(--color-text-muted)]">{label}</div>
        {detail ? <div className="max-w-24 truncate text-[10px] text-[var(--color-text-muted)]">{detail}</div> : null}
      </div>
    </div>
  );
}
