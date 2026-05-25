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
    <header className="grid gap-2 rounded-[var(--radius-panel)] border border-[var(--color-border)] bg-[var(--color-panel)] p-2.5 shadow-[var(--shadow-panel)] lg:grid-cols-[minmax(260px,1fr)_auto]">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="font-mono text-lg font-semibold leading-none text-[var(--color-text)]">VPScope</h1>
          <span className="rounded-[var(--radius-control)] border border-[var(--color-border)] px-1.5 py-0.5 font-mono text-[10px] uppercase text-[var(--color-accent)]">
            {clientMode}
          </span>
          <span className="font-mono text-xs text-[var(--color-text-muted)]">
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
        <div className="flex items-center gap-1 rounded-[var(--radius-control)] border border-[var(--color-border)] bg-[var(--color-input)] p-1">
          {(["overview", "list"] as const).map((candidate) => (
            <button
              key={candidate}
              type="button"
              onClick={() => setViewMode(candidate)}
              className="h-6 rounded-[var(--radius-control)] px-2 font-mono text-[11px] text-[var(--color-text-muted)] data-[active=true]:bg-[var(--color-panel-muted)] data-[active=true]:text-[var(--color-text)]"
              data-active={candidate === viewMode}
            >
              {t(candidate)}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setSettingsOpen(true)}
          className="control-button grid h-8 w-8 place-items-center p-0"
          title={t("settings")}
          aria-label={t("settings")}
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
          >
            <path d="M4 7h4" />
            <path d="M12 7h8" />
            <path d="M4 17h8" />
            <path d="M16 17h4" />
            <path d="M4 12h10" />
            <path d="M18 12h2" />
            <circle cx="10" cy="7" r="2" />
            <circle cx="14" cy="17" r="2" />
            <circle cx="16" cy="12" r="2" />
          </svg>
        </button>
      </div>
    </header>
  );
}
