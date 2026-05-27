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
  const segments = 24;
  const activeSegments = percent > 0 ? Math.max(1, Math.round((percent / 100) * segments)) : 0;

  return (
    <div className="grid grid-cols-[82px_minmax(0,1fr)_62px] items-center gap-2 font-mono text-[10px]">
      <span className="truncate uppercase text-[var(--color-text-muted)]">{label}</span>
      <div className="grid h-4 min-w-0 grid-flow-col gap-px border border-[var(--color-border-subtle)] bg-[var(--color-bar-track)] p-px">
        {Array.from({ length: segments }, (_, index) => {
          const active = index < activeSegments;

          return (
            <span
              key={index}
              className="min-w-0 transition-colors duration-300"
              style={{
                backgroundColor: active ? color : "transparent",
                boxShadow: active ? `0 0 6px ${color}` : undefined,
                opacity: active ? 1 : 0.44,
              }}
            />
          );
        })}
      </div>
      <span className="text-right tabular-nums text-[var(--color-text)]">{detail ?? formatPercent(percent)}</span>
    </div>
  );
}
