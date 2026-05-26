import { useId, useRef, useState } from "react";
import { HostConnectionBadge } from "@/features/hosts/HostConnectionBadge";
import { HostForm } from "@/features/hosts/HostForm";
import { useI18n } from "@/i18n/useI18n";
import { formatDateTime, formatDuration } from "@/lib/format";
import { useHostStore } from "@/stores/hostStore";
import { useMetricsStore } from "@/stores/metricsStore";
import type { HostConfig, HostConnectionState, HostSnapshot } from "@/types/contracts";

type HostDetailsTooltipProps = {
  host: HostConfig;
  snapshot?: HostSnapshot;
  connection?: HostConnectionState;
};

function HostDetailsTooltip({ host, snapshot, connection }: HostDetailsTooltipProps) {
  const { t } = useI18n();
  const tooltipId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [anchorRect, setAnchorRect] = useState<DOMRect>();
  const [isOpen, setIsOpen] = useState(false);

  if (!snapshot) {
    return null;
  }

  function showTooltip() {
    const nextAnchorRect = buttonRef.current?.getBoundingClientRect();

    if (nextAnchorRect) {
      setAnchorRect(nextAnchorRect);
      setIsOpen(true);
    }
  }

  const connectionStatus =
    connection?.status === "connected"
      ? t("streamingMetrics")
      : connection?.status === "connecting"
        ? t("connecting")
        : connection?.status === "error"
          ? t("error")
          : connection?.status === "disconnected"
            ? t("idle")
            : undefined;
  const details = [
    [t("host"), snapshot.system.hostname],
    [t("address"), `${host.address}:${host.port}`],
    [t("os"), snapshot.system.os],
    [t("kernel"), snapshot.system.kernel ?? "unknown"],
    [t("arch"), snapshot.system.arch ?? "unknown"],
    [t("uptime"), formatDuration(snapshot.system.uptimeSec)],
    [t("load"), snapshot.system.loadAvg.map((value) => value.toFixed(2)).join(" / ")],
    [t("auth"), host.auth.type],
    [t("last"), formatDateTime(snapshot.ts)],
  ];
  const tooltipWidth = 304;
  const tooltipLeft = anchorRect
    ? Math.min(Math.max(anchorRect.right - tooltipWidth, 8), Math.max(8, window.innerWidth - tooltipWidth - 8))
    : 8;
  const shouldPlaceAbove = anchorRect ? anchorRect.top > 320 && anchorRect.bottom > window.innerHeight - 280 : false;
  const tooltipPosition = anchorRect
    ? shouldPlaceAbove
      ? { bottom: window.innerHeight - anchorRect.top + 8 }
      : { top: anchorRect.bottom + 8 }
    : { top: 8 };

  return (
    <div
      className="relative ml-1 mt-0.5 shrink-0"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setIsOpen(false);
        }
      }}
      onFocus={showTooltip}
      onPointerEnter={showTooltip}
      onPointerLeave={() => setIsOpen(false)}
    >
      <button
        ref={buttonRef}
        type="button"
        aria-describedby={isOpen ? tooltipId : undefined}
        aria-label={t("details")}
        className="grid h-6 w-6 place-items-center rounded-full border border-[var(--color-border-subtle)] bg-[var(--color-input)] font-mono text-[11px] font-semibold text-[var(--color-text-muted)] shadow-[var(--shadow-panel)] transition-colors hover:border-[var(--color-border-strong)] hover:bg-[var(--color-panel-muted)] hover:text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40"
        onClick={(event) => {
          event.stopPropagation();
          showTooltip();
        }}
      >
        i
      </button>
      {isOpen ? (
        <div
          id={tooltipId}
          role="tooltip"
          className="fixed z-50 rounded-[var(--radius-panel)] border border-[var(--color-border)] bg-[var(--color-panel)] p-2 font-mono text-xs text-[var(--color-text)] shadow-[var(--shadow-panel)] backdrop-blur"
          style={{ left: tooltipLeft, width: tooltipWidth, ...tooltipPosition }}
        >
          <div className="flex min-w-0 items-center justify-between gap-2 border-b border-[var(--color-border-subtle)] pb-2">
            <span className="text-[11px] uppercase text-[var(--color-text-muted)]">{t("details")}</span>
            {connectionStatus ? (
              <span className="min-w-0 truncate text-[10px] text-[var(--color-accent)]">{connectionStatus}</span>
            ) : null}
          </div>
          <dl className="mt-2 grid grid-cols-2 gap-1.5">
            {details.map(([label, value]) => (
              <div
                key={label}
                className="min-w-0 rounded-[var(--radius-control)] border border-[var(--color-border-subtle)] bg-[var(--color-input)] px-2 py-1.5"
              >
                <dt className="text-[10px] text-[var(--color-text-muted)]">{label}</dt>
                <dd className="mt-1 truncate tabular-nums text-[11px] text-[var(--color-text)]">{value}</dd>
              </div>
            ))}
          </dl>
          {connection?.lastError ? (
            <div className="mt-2 rounded-[var(--radius-control)] border border-[var(--color-danger)] bg-[var(--color-input)] p-2 text-[11px] text-[var(--color-danger)]">
              <span className="tabular-nums">{connection.lastError.code}</span>: {connection.lastError.message}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function HostSidebar() {
  const hosts = useHostStore((state) => state.hosts);
  const selectedHostId = useHostStore((state) => state.selectedHostId);
  const selectHost = useHostStore((state) => state.selectHost);
  const deleteHost = useHostStore((state) => state.deleteHost);
  const connectionStates = useHostStore((state) => state.connectionStates);
  const snapshots = useMetricsStore((state) => state.snapshots);
  const { t } = useI18n();
  const [formOpen, setFormOpen] = useState(false);

  return (
    <aside className="grid min-h-0 min-w-0 grid-rows-[auto_minmax(0,1fr)_auto] gap-2 overflow-hidden rounded-[var(--radius-panel)] border border-[var(--color-border)] bg-[var(--color-panel-glass)] p-3 shadow-[var(--shadow-panel)] backdrop-blur">
      <div className="min-w-0">
        <div className="flex items-center gap-2 font-mono text-sm font-semibold text-[var(--color-text)]">
          <span className="h-2 w-2 rounded-full bg-[var(--color-accent)] shadow-[var(--shadow-glow)]" />
          {t("hosts")}
        </div>
        <div className="mt-1 font-mono text-[11px] text-[var(--color-text-muted)]">{t("hostsConfigured", { count: hosts.length })}</div>
      </div>

      <div className="scrollbar-none min-h-0 min-w-0 space-y-1.5 overflow-auto">
        {hosts.map((host) => (
          <div
            key={host.id}
            className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto_auto] rounded-[var(--radius-control)] border border-[var(--color-border-subtle)] bg-[var(--color-input)] p-2 transition-colors hover:border-[var(--color-border)] hover:bg-[var(--color-row-hover)] data-[active=true]:border-[var(--color-border-strong)] data-[active=true]:bg-[var(--color-panel-muted)] data-[active=true]:shadow-[var(--shadow-glow)]"
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
                  <span key={tag} className="rounded-[var(--radius-control)] border border-[var(--color-border-subtle)] bg-[var(--color-panel-muted)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--color-text-muted)]">
                    {tag}
                  </span>
                ))}
              </div>
            </button>
            <HostDetailsTooltip host={host} snapshot={snapshots[host.id]} connection={connectionStates[host.id]} />
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
