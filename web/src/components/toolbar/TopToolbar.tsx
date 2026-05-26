import { useI18n } from "@/i18n/useI18n";
import { formatDateTime } from "@/lib/format";
import { clientMode } from "@/lib/tauriClient";
import { useHostStore, useSelectedHost } from "@/stores/hostStore";
import { useMetricsStore } from "@/stores/metricsStore";
import { useUiStore } from "@/stores/uiStore";

export function TopToolbar() {
  const host = useSelectedHost();
  const hosts = useHostStore((state) => state.hosts);
  const snapshots = useMetricsStore((state) => state.snapshots);
  const snapshot = host ? snapshots[host.id] : undefined;
  const latestSnapshotTs = Math.max(0, ...Object.values(snapshots).map((item) => item?.ts ?? 0));
  const viewMode = useUiStore((state) => state.viewMode);
  const setViewMode = useUiStore((state) => state.setViewMode);
  const setSettingsOpen = useUiStore((state) => state.setSettingsOpen);
  const { t } = useI18n();
  const displayTs = viewMode === "overview" ? latestSnapshotTs : snapshot?.ts;

  return (
    <header className="grid gap-2 overflow-hidden rounded-[var(--radius-panel)] border border-[var(--color-border)] bg-[var(--color-panel-glass)] p-3 shadow-[var(--shadow-panel)] backdrop-blur lg:grid-cols-[minmax(260px,1fr)_auto]">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="font-mono text-lg font-semibold leading-none text-[var(--color-text)]">
            <span className="text-[var(--color-accent)]">VP</span>Scope
          </h1>
          <span className="rounded-[var(--radius-control)] border border-[var(--color-border-subtle)] bg-[var(--color-accent-soft)] px-1.5 py-0.5 font-mono text-[10px] uppercase text-[var(--color-accent)]">
            {clientMode}
          </span>
          <span className="rounded-[var(--radius-control)] border border-[var(--color-border-subtle)] bg-[var(--color-input)] px-2 py-0.5 font-mono text-xs text-[var(--color-text-muted)]">
            {displayTs ? formatDateTime(displayTs) : t("never")}
          </span>
        </div>
        <p className="mt-1 truncate text-xs text-[var(--color-text-muted)]">
          {viewMode === "overview"
            ? `${t("allHosts")} · ${t("hostsConfigured", { count: hosts.length })}`
            : host
              ? `${host.name} · ${host.auth.username}@${host.address}:${host.port}`
              : t("noHostSelected")}
        </p>
      </div>
      <div className="flex min-w-0 items-center justify-end gap-1.5">
        <div className="flex items-center gap-1 rounded-[var(--radius-control)] border border-[var(--color-border-subtle)] bg-[var(--color-input)] p-1 shadow-[inset_0_1px_0_var(--color-border-subtle)]">
          {(["overview", "list"] as const).map((candidate) => (
            <button
              key={candidate}
              type="button"
              onClick={() => setViewMode(candidate)}
              className="h-6 rounded-[var(--radius-control)] px-2 font-mono text-[11px] text-[var(--color-text-muted)] hover:text-[var(--color-text)] data-[active=true]:bg-[var(--color-panel-muted)] data-[active=true]:text-[var(--color-text)] data-[active=true]:shadow-[var(--shadow-glow)]"
              data-active={candidate === viewMode}
            >
              {t(candidate)}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setSettingsOpen(true)}
          className="control-button icon-button grid h-8 w-8 place-items-center text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
          title={t("settings")}
          aria-label={t("settings")}
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 20 20"
            className="block h-[18px] w-[18px]"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.7"
          >
            <path d="M4 6.25h3.25" />
            <path d="M10.75 6.25H16" />
            <circle cx="9" cy="6.25" r="1.7" />
            <path d="M4 13.75h6.25" />
            <path d="M13.75 13.75H16" />
            <circle cx="12" cy="13.75" r="1.7" />
          </svg>
        </button>
      </div>
    </header>
  );
}
