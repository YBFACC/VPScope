import type { ReactNode } from "react";
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
        "h-full min-h-0 overflow-hidden rounded-[var(--radius-panel)] border border-[var(--color-border)] bg-[var(--color-panel)] p-2.5 shadow-[var(--shadow-panel)]",
        className,
      )}
    >
      <div className="mb-2 flex min-h-5 items-center justify-between gap-2">
        <h2 className="min-w-0 font-mono text-xs font-semibold uppercase tracking-normal text-[var(--color-text)]">
          <span style={{ color: accent }}>#</span> {title}
        </h2>
        <div className="flex min-w-0 items-center gap-2 font-mono text-xs text-[var(--color-text-muted)]">
          {status}
          {actions}
        </div>
      </div>
      {children}
    </section>
  );
}
