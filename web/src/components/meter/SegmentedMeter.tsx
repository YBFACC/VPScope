import { formatPercent } from "@/lib/format";

type SegmentedMeterProps = {
  value: number;
  label?: string;
  detail?: string;
  color?: string;
  segments?: number;
  compact?: boolean;
  showValue?: boolean;
};

export function SegmentedMeter({
  value,
  label,
  detail,
  color = "var(--color-accent)",
  segments = 18,
  compact = false,
  showValue = true,
}: SegmentedMeterProps) {
  const clamped = Math.max(0, Math.min(100, value));
  const activeSegments = Math.round((clamped / 100) * segments);

  return (
    <div className={compact ? "grid min-w-0 gap-1" : "grid min-w-0 grid-cols-[78px_minmax(0,1fr)_58px] items-center gap-2"}>
      {label ? (
        <span className="truncate font-mono text-[11px] text-[var(--color-text-muted)]">{label}</span>
      ) : null}
      <div className="grid min-w-0 grid-flow-col gap-0.5">
        {Array.from({ length: segments }, (_, index) => {
          const isActive = index < activeSegments;
          const stepColor =
            index / Math.max(1, segments - 1) > 0.82
              ? "var(--color-bar-step-4)"
              : index / Math.max(1, segments - 1) > 0.64
                ? "var(--color-bar-step-3)"
                : index / Math.max(1, segments - 1) > 0.46
                  ? "var(--color-bar-step-2)"
                  : color;

          return (
            <span
              key={index}
              className="h-3 min-w-0 rounded-[2px] transition-colors duration-300"
              style={{
                backgroundColor: isActive ? stepColor : "var(--color-bar-track)",
                boxShadow: isActive ? `0 0 10px ${stepColor}` : undefined,
                opacity: isActive ? 1 : 0.72,
              }}
            />
          );
        })}
      </div>
      {showValue ? (
        <span className="truncate text-right font-mono text-[11px] text-[var(--color-text)] tabular-nums">
          {detail ?? formatPercent(clamped)}
        </span>
      ) : null}
    </div>
  );
}
