import type { CSSProperties, ReactNode } from "react";
import clsx from "clsx";

type MetricPanelProps = {
  title: string;
  accent?: string;
  status?: ReactNode;
  actions?: ReactNode;
  className?: string;
  children: ReactNode;
};

export function MetricPanel({ title, accent = "var(--color-accent)", status, actions, className, children }: MetricPanelProps) {
  return (
    <section
      className={clsx(
        "metric-panel-shell grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] overflow-hidden rounded-[var(--radius-panel)] border border-[var(--color-border)] p-3 shadow-[var(--shadow-panel)]",
        className,
      )}
      style={{ "--panel-accent": accent } as CSSProperties}
    >
      <div className="metric-panel-accent" />
      <div className="mb-2.5 flex min-h-5 items-center justify-between gap-2">
        <h2 className="min-w-0 font-mono text-[11px] font-semibold uppercase tracking-normal text-[var(--color-text)]">
          <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full align-middle" style={{ backgroundColor: accent, boxShadow: `0 0 14px ${accent}` }} />
          {title}
        </h2>
        <div className="flex min-w-0 items-center gap-2 font-mono text-xs text-[var(--color-text-muted)]">
          {status}
          {actions}
        </div>
      </div>
      <div className="min-h-0">{children}</div>
    </section>
  );
}
