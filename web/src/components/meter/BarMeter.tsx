import { formatPercent } from "@/lib/format";

type BarMeterProps = {
  label: string;
  value: number;
  max?: number;
  color?: string;
  detail?: string;
};

export function BarMeter({ label, value, max = 100, color = "var(--color-accent)", detail }: BarMeterProps) {
  const percent = Math.max(0, Math.min(100, (value / max) * 100));

  return (
    <div className="grid grid-cols-[86px_minmax(0,1fr)_64px] items-center gap-3 font-mono text-xs">
      <span className="truncate text-[var(--color-text-muted)]">{label}</span>
      <div className="h-2.5 overflow-hidden rounded-[var(--radius-control)] bg-[var(--color-bar-track)]">
        <div
          className="h-full rounded-[var(--radius-control)] transition-[width] duration-300"
          style={{ width: `${percent}%`, backgroundColor: color }}
        />
      </div>
      <span className="text-right tabular-nums text-[var(--color-text)]">{detail ?? formatPercent(percent)}</span>
    </div>
  );
}
