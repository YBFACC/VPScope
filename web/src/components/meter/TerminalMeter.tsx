import clsx from "clsx";
import { formatPercent } from "@/lib/format";
import { getLoadToneColor, type LoadToneScale } from "@/lib/loadTone";
import { PIXEL_DENSITY } from "@/components/pixelDensity";

type TerminalMeterProps = {
  label?: string;
  value: number;
  detail?: string;
  color?: string;
  segments?: number;
  showPercent?: boolean;
  className?: string;
  toneScale?: LoadToneScale;
};

export function TerminalMeter({
  label,
  value,
  detail,
  color = "var(--color-accent)",
  segments = PIXEL_DENSITY.meter.segments,
  showPercent = true,
  className,
  toneScale,
}: TerminalMeterProps) {
  const clamped = Math.max(0, Math.min(100, value));
  const activeSegments = clamped > 0 ? Math.max(1, Math.round((clamped / 100) * segments)) : 0;

  return (
    <div className={clsx("terminal-meter", className)}>
      {label ? <span className="terminal-meter-label">{label}</span> : null}
      <span className="terminal-meter-track" aria-hidden="true">
        {Array.from({ length: segments }, (_, index) => (
          <span
            key={index}
            className="terminal-meter-cell"
            style={{
              backgroundColor: index < activeSegments
                ? toneScale
                  ? getLoadToneColor(toneScale, ((index + 1) / segments) * 100)
                  : color
                : "var(--color-bar-track)",
              opacity: index < activeSegments ? 0.94 : 0.26,
            }}
          />
        ))}
      </span>
      {showPercent || detail ? (
        <span className="terminal-meter-value">{detail ?? formatPercent(clamped)}</span>
      ) : null}
    </div>
  );
}
