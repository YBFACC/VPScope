import { formatPercent } from "@/lib/format";

type SegmentedMeterProps = {
  value: number;
  label?: string;
  detail?: string;
  color?: string;
  thresholdGradient?: boolean;
  segments?: number;
  compact?: boolean;
  showValue?: boolean;
};

export function SegmentedMeter({
  value,
  label,
  detail,
  color = "var(--color-accent)",
  thresholdGradient = true,
  segments = 18,
  compact = false,
  showValue = true,
}: SegmentedMeterProps) {
  const clamped = Math.max(0, Math.min(100, value));
  const activeSegments = clamped > 0 ? Math.max(1, Math.round((clamped / 100) * segments)) : 0;

  return (
    <div className={compact ? "grid min-w-0 gap-1" : "grid min-w-0 grid-cols-[74px_minmax(0,1fr)_54px] items-center gap-1.5"}>
      {label ? (
        <span className="truncate font-mono text-[10px] uppercase text-[var(--color-text-muted)]">{label}</span>
      ) : null}
      <div className="grid min-w-0 grid-flow-col gap-px border border-[var(--color-border-subtle)] bg-[var(--color-bar-track)] p-px">
        {Array.from({ length: segments }, (_, index) => {
          const isActive = index < activeSegments;
          const position = index / Math.max(1, segments - 1);
          const stepColor = thresholdGradient
            ? position > 0.82
              ? "var(--color-bar-step-4)"
              : position > 0.64
                ? "var(--color-bar-step-3)"
                : position > 0.46
                  ? "var(--color-bar-step-2)"
                  : color
            : color;

          return (
            <span
              key={index}
              className="pixel-meter-block h-3 min-w-0 transition-colors duration-300"
              style={{
                backgroundColor: isActive ? stepColor : "var(--color-bar-track)",
                boxShadow: isActive ? `0 0 6px ${stepColor}` : undefined,
                opacity: isActive ? 1 : 0.52,
              }}
            />
          );
        })}
      </div>
      {showValue ? (
        <span className="truncate text-right font-mono text-[10px] text-[var(--color-text)] tabular-nums">
          {detail ?? formatPercent(clamped)}
        </span>
      ) : null}
    </div>
  );
}
