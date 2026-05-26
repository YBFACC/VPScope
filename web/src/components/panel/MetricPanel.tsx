import type { CSSProperties, ReactNode } from "react";
import clsx from "clsx";
import { useI18n } from "@/i18n/useI18n";
import { type DashboardPanelId, useUiStore } from "@/stores/uiStore";

type MetricPanelProps = {
  title: string;
  panelId?: DashboardPanelId;
  accent?: string;
  status?: ReactNode;
  actions?: ReactNode;
  className?: string;
  children: ReactNode;
  collapsed?: boolean;
  onToggleCollapsed?: (panelId: DashboardPanelId) => void;
};

export function MetricPanel({
  title,
  panelId,
  accent = "var(--color-accent)",
  status,
  actions,
  className,
  children,
  collapsed,
  onToggleCollapsed,
}: MetricPanelProps) {
  const { t } = useI18n();
  const collapsedPanels = useUiStore((state) => state.collapsedPanels);
  const panelOrder = useUiStore((state) => state.panelOrder);
  const movePanel = useUiStore((state) => state.movePanel);
  const togglePanelCollapsed = useUiStore((state) => state.togglePanelCollapsed);
  const isCollapsed = collapsed ?? (panelId ? collapsedPanels.includes(panelId) : false);
  const canToggle = Boolean(panelId);
  const visiblePanelOrder = panelOrder.filter((candidate) => !collapsedPanels.includes(candidate));
  const visiblePanelIndex = panelId ? visiblePanelOrder.indexOf(panelId) : -1;
  const canMoveUp = canToggle && visiblePanelIndex > 0;
  const canMoveDown = canToggle && visiblePanelIndex >= 0 && visiblePanelIndex < visiblePanelOrder.length - 1;
  const toggleLabel = isCollapsed ? t("expandPanel") : t("collapsePanel");

  const onToggle = () => {
    if (!panelId) {
      return;
    }

    if (onToggleCollapsed) {
      onToggleCollapsed(panelId);
      return;
    }

    togglePanelCollapsed(panelId);
  };

  return (
    <section
      className={clsx(
        "metric-panel-shell grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] overflow-hidden rounded-[var(--radius-panel)] border border-[var(--color-border)] p-3 shadow-[var(--shadow-panel)]",
        className,
      )}
      data-collapsed={isCollapsed}
      style={{ "--panel-accent": accent } as CSSProperties}
    >
      <div className="metric-panel-accent" />
      <div className="metric-panel-header mb-2.5 flex min-h-5 items-center justify-between gap-2">
        {canToggle ? (
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={!isCollapsed}
            aria-label={`${toggleLabel}: ${title}`}
            title={`${toggleLabel}: ${title}`}
            className="metric-panel-title-button min-w-0 font-mono text-[11px] font-semibold uppercase tracking-normal text-[var(--color-text)]"
          >
            <span
              className="mr-1 inline-block h-1.5 w-1.5 rounded-full align-middle"
              style={{ backgroundColor: accent, boxShadow: `0 0 14px ${accent}` }}
            />
            <span className="truncate">{title}</span>
          </button>
        ) : (
          <h2 className="min-w-0 font-mono text-[11px] font-semibold uppercase tracking-normal text-[var(--color-text)]">
            <span
              className="mr-1 inline-block h-1.5 w-1.5 rounded-full align-middle"
              style={{ backgroundColor: accent, boxShadow: `0 0 14px ${accent}` }}
            />
            {title}
          </h2>
        )}
        <div className="flex min-w-0 items-center gap-2 font-mono text-xs text-[var(--color-text-muted)]">
          {status}
          {!isCollapsed ? actions : null}
          {canToggle ? (
            <div className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                onClick={() => panelId && movePanel(panelId, "up")}
                disabled={!canMoveUp}
                aria-label={`${t("movePanelUp")}: ${title}`}
                title={`${t("movePanelUp")}: ${title}`}
                className="metric-panel-icon-button"
              >
                <svg
                  aria-hidden="true"
                  viewBox="0 0 16 16"
                  className="h-3.5 w-3.5"
                  fill="none"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                >
                  <path d="m4 10 4-4 4 4" />
                </svg>
              </button>
              <button
                type="button"
                onClick={() => panelId && movePanel(panelId, "down")}
                disabled={!canMoveDown}
                aria-label={`${t("movePanelDown")}: ${title}`}
                title={`${t("movePanelDown")}: ${title}`}
                className="metric-panel-icon-button"
              >
                <svg
                  aria-hidden="true"
                  viewBox="0 0 16 16"
                  className="h-3.5 w-3.5"
                  fill="none"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                >
                  <path d="m4 6 4 4 4-4" />
                </svg>
              </button>
              <button
                type="button"
                onClick={onToggle}
                aria-expanded={!isCollapsed}
                aria-label={`${toggleLabel}: ${title}`}
                title={`${toggleLabel}: ${title}`}
                className="metric-panel-icon-button"
              >
                <svg
                  aria-hidden="true"
                  viewBox="0 0 16 16"
                  className="h-3.5 w-3.5 transition-transform duration-150 data-[collapsed=true]:-rotate-90"
                  data-collapsed={isCollapsed}
                  fill="none"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                >
                  <path d="m4 6 4 4 4-4" />
                </svg>
              </button>
            </div>
          ) : null}
        </div>
      </div>
      {!isCollapsed ? <div className="min-h-0">{children}</div> : null}
    </section>
  );
}
