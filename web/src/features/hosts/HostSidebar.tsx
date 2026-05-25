import { useState } from "react";
import { HostConnectionBadge } from "@/features/hosts/HostConnectionBadge";
import { HostForm } from "@/features/hosts/HostForm";
import { useI18n } from "@/i18n/useI18n";
import { useHostStore } from "@/stores/hostStore";

export function HostSidebar() {
  const hosts = useHostStore((state) => state.hosts);
  const selectedHostId = useHostStore((state) => state.selectedHostId);
  const selectHost = useHostStore((state) => state.selectHost);
  const deleteHost = useHostStore((state) => state.deleteHost);
  const connectionStates = useHostStore((state) => state.connectionStates);
  const { t } = useI18n();
  const [formOpen, setFormOpen] = useState(false);

  return (
    <aside className="grid min-h-0 min-w-0 grid-rows-[auto_minmax(0,1fr)_auto] gap-2 overflow-hidden rounded-[var(--radius-panel)] border border-[var(--color-border)] bg-[var(--color-panel)] p-2.5 shadow-[var(--shadow-panel)]">
      <div className="min-w-0">
        <div className="font-mono text-sm font-semibold text-[var(--color-text)]">{t("hosts")}</div>
        <div className="font-mono text-[11px] text-[var(--color-text-muted)]">{t("hostsConfigured", { count: hosts.length })}</div>
      </div>

      <div className="scrollbar-none min-h-0 min-w-0 space-y-1.5 overflow-auto">
        {hosts.map((host) => (
          <div
            key={host.id}
            className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] overflow-hidden rounded-[var(--radius-control)] border border-[var(--color-border)] bg-[var(--color-input)] p-2 transition-colors hover:bg-[var(--color-row-hover)] data-[active=true]:border-[var(--color-border-strong)] data-[active=true]:bg-[var(--color-panel-muted)]"
            data-active={host.id === selectedHostId}
          >
            <button type="button" onClick={() => selectHost(host.id)} className="min-w-0 text-left">
              <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
                <span className="min-w-0 truncate font-mono text-sm text-[var(--color-text)]">{host.name}</span>
                <HostConnectionBadge state={connectionStates[host.id]} />
              </div>
              <div className="mt-1 truncate font-mono text-[11px] text-[var(--color-text-muted)]">
                {host.auth.username}@{host.address}:{host.port}
              </div>
              <div className="mt-2 flex min-w-0 flex-wrap gap-1 overflow-hidden">
                {host.tags.map((tag) => (
                  <span key={tag} className="rounded-[var(--radius-control)] bg-[var(--color-panel-muted)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--color-text-muted)]">
                    {tag}
                  </span>
                ))}
              </div>
            </button>
            <button
              type="button"
              onClick={() => void deleteHost(host.id)}
              className="ml-1 h-6 w-6 shrink-0 rounded-[var(--radius-control)] font-mono text-xs text-[var(--color-text-muted)] hover:bg-[var(--color-panel-muted)] hover:text-[var(--color-danger)]"
              title={t("delete")}
              aria-label={t("delete")}
            >
              x
            </button>
          </div>
        ))}
      </div>

      <button type="button" onClick={() => setFormOpen(true)} className="control-button w-full">
        {t("addHost")}
      </button>
      <HostForm open={formOpen} onClose={() => setFormOpen(false)} />
    </aside>
  );
}
