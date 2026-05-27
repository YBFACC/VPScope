import clsx from "clsx";
import { HostConnectionBadge } from "@/features/hosts/HostConnectionBadge";
import { useI18n } from "@/i18n/useI18n";
import { formatBytes, formatDateTime, formatDuration, formatPercent, formatRate } from "@/lib/format";
import type { AppError, HostConfig, HostConnectionState, HostSnapshot } from "@/types/contracts";

type OverviewPageProps = {
  hosts: HostConfig[];
  snapshots: Record<string, HostSnapshot | undefined>;
  connectionStates: Record<string, HostConnectionState | undefined>;
  errorsByHost: Record<string, AppError | undefined>;
  isSubscribing: boolean;
  onOpenHost: (hostId: string) => void;
};

type HostHealth = "hot" | "warn" | "ok" | "waiting" | "error";

function safePercent(used: number, total: number) {
  if (total <= 0) {
    return undefined;
  }

  return (used / total) * 100;
}

function maxDiskPercent(snapshot?: HostSnapshot) {
  if (!snapshot || snapshot.disks.length === 0) {
    return undefined;
  }

  return snapshot.disks.reduce<number | undefined>((max, disk) => {
    const percent = safePercent(disk.usedBytes, disk.totalBytes);
    if (percent === undefined) {
      return max;
    }

    return max === undefined ? percent : Math.max(max, percent);
  }, undefined);
}

function sumNetwork(snapshot: HostSnapshot | undefined, key: "rxBytesPerSec" | "txBytesPerSec") {
  return snapshot?.network.reduce((total, iface) => total + iface[key], 0) ?? 0;
}

function healthFor(snapshot: HostSnapshot | undefined, connection?: HostConnectionState, error?: AppError): HostHealth {
  if (error || connection?.status === "error") {
    return "error";
  }

  if (!snapshot) {
    return "waiting";
  }

  const memoryPercent = safePercent(snapshot.memory.usedBytes, snapshot.memory.totalBytes) ?? 0;
  const diskPercent = maxDiskPercent(snapshot) ?? 0;
  const cpuPercent = snapshot.cpu.totalPercent;

  if (cpuPercent >= 90 || memoryPercent >= 90 || diskPercent >= 90) {
    return "hot";
  }

  if (cpuPercent >= 75 || memoryPercent >= 75 || diskPercent >= 80) {
    return "warn";
  }

  return "ok";
}

function healthColor(health: HostHealth) {
  return {
    hot: "var(--color-danger)",
    warn: "var(--color-warning)",
    ok: "var(--color-cpu)",
    waiting: "var(--color-text-muted)",
    error: "var(--color-danger)",
  }[health];
}

function MiniMeter({ value, color }: { value?: number; color: string }) {
  const percent = value === undefined ? 0 : Math.max(0, Math.min(100, value));
  const segments = 18;
  const activeSegments = percent > 0 ? Math.max(1, Math.round((percent / 100) * segments)) : 0;

  return (
    <div className="grid h-3 min-w-14 grid-flow-col gap-px border border-[var(--color-border-subtle)] bg-[var(--color-bar-track)] p-px">
      {Array.from({ length: segments }, (_, index) => {
        const active = index < activeSegments;
        const fill = value === undefined ? "var(--color-border)" : color;

        return (
          <span
            key={index}
            className="min-w-0 transition-colors duration-300"
            style={{
              backgroundColor: active ? fill : "transparent",
              boxShadow: active && value !== undefined ? `0 0 6px ${fill}` : undefined,
              opacity: active ? 1 : 0.45,
            }}
          />
        );
      })}
    </div>
  );
}

const metricHeaderClass = "mb-1 grid h-4 min-w-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-2";
const metricLabelClass = "truncate text-[10px] uppercase text-[var(--color-text-muted)]";

function MetricCell({
  label,
  value,
  meter,
  color,
}: {
  label: string;
  value: string;
  meter?: number;
  color: string;
}) {
  return (
    <div className="min-w-0">
      <div className={metricHeaderClass}>
        <span className={metricLabelClass}>{label}</span>
        <span className="shrink-0 tabular-nums text-[var(--color-text)]">{value}</span>
      </div>
      <MiniMeter value={meter} color={color} />
    </div>
  );
}

function NetworkMetricCell({
  label,
  rxLabel,
  txLabel,
  rxValue,
  txValue,
  meter,
}: {
  label: string;
  rxLabel: string;
  txLabel: string;
  rxValue: string;
  txValue: string;
  meter?: number;
}) {
  return (
    <div className="min-w-0">
      <div className={metricHeaderClass}>
        <span className={metricLabelClass}>{label}</span>
        <div className="flex min-w-0 justify-end gap-2 overflow-hidden tabular-nums">
          <span className="min-w-0 truncate text-[var(--color-network-rx)]">
            {rxLabel} {rxValue}
          </span>
          <span className="min-w-0 truncate text-[var(--color-network-tx)]">
            {txLabel} {txValue}
          </span>
        </div>
      </div>
      <MiniMeter value={meter} color="var(--color-accent)" />
    </div>
  );
}

export function OverviewPage({
  hosts,
  snapshots,
  connectionStates,
  errorsByHost,
  isSubscribing,
  onOpenHost,
}: OverviewPageProps) {
  const { t } = useI18n();

  return (
    <section className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-2 overflow-hidden rounded-[var(--radius-panel)] border border-[var(--color-border)] bg-[var(--color-panel-glass)] p-2 font-mono shadow-[var(--shadow-panel)]">
      <div className="flex min-h-7 min-w-0 items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate text-xs font-semibold uppercase tracking-normal text-[var(--color-text)]">
            <span className="pixel-dot mr-1.5 text-[var(--color-accent)] align-middle" />
            {t("hostOverview")}
          </h2>
          <div className="truncate text-[10px] uppercase text-[var(--color-text-muted)]">
            {t("hostsConfigured", { count: hosts.length })} · {isSubscribing ? t("connecting") : t("streamingMetrics")}
          </div>
        </div>
        <div className="hidden shrink-0 grid-cols-4 gap-2 text-[10px] uppercase text-[var(--color-text-muted)] xl:grid">
          <span>{t("cpu")}</span>
          <span>{t("memory")}</span>
          <span>{t("worstDisk")}</span>
          <span>{t("network")}</span>
        </div>
      </div>

      <div className="scrollbar-none min-h-0 overflow-auto">
        <div className="grid min-w-[760px] gap-1.5">
          {hosts.map((host) => {
            const snapshot = snapshots[host.id];
            const connection = connectionStates[host.id];
            const error = errorsByHost[host.id] ?? connection?.lastError;
            const memoryPercent = snapshot
              ? safePercent(snapshot.memory.usedBytes, snapshot.memory.totalBytes)
              : undefined;
            const diskPercent = maxDiskPercent(snapshot);
            const rx = sumNetwork(snapshot, "rxBytesPerSec");
            const tx = sumNetwork(snapshot, "txBytesPerSec");
            const health = healthFor(snapshot, connection, error);
            const healthTone = healthColor(health);

            return (
              <article
                key={host.id}
                role="button"
                tabIndex={0}
                onClick={() => onOpenHost(host.id)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onOpenHost(host.id);
                  }
                }}
                className={clsx(
                  "pixel-card grid min-h-20 min-w-0 cursor-default grid-cols-[220px_88px_repeat(4,minmax(96px,1fr))_112px] items-center gap-3 p-2 text-[11px] outline-none transition-colors",
                  "hover:border-[var(--color-border-strong)] hover:bg-[var(--color-row-hover)] focus:border-[var(--color-accent)] focus:shadow-[inset_3px_0_0_var(--color-accent),var(--shadow-glow)]",
                )}
              >
                <div className="min-w-0">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="h-2 w-2 shrink-0 rounded-[1px]" style={{ backgroundColor: healthTone, boxShadow: `0 0 8px ${healthTone}` }} />
                    <span className="min-w-0 truncate text-xs font-semibold uppercase text-[var(--color-text)]">{host.name}</span>
                  </div>
                  <div className="mt-1 truncate text-[10px] text-[var(--color-text-muted)]">
                    {host.auth.username}@{host.address}:{host.port}
                  </div>
                  <div className="mt-1 truncate text-[10px] text-[var(--color-text-muted)]">
                    {snapshot?.system.hostname ?? error?.message ?? t("waitingForMetrics")}
                  </div>
                </div>

                <div className="min-w-0">
                  <div className="mb-1 text-[9px] uppercase text-[var(--color-text-muted)]">{t("status")}</div>
                  <HostConnectionBadge state={connection} />
                </div>

                <MetricCell
                  label={t("cpu")}
                  value={snapshot ? formatPercent(snapshot.cpu.totalPercent) : "--"}
                  meter={snapshot?.cpu.totalPercent}
                  color="var(--color-cpu)"
                />
                <MetricCell
                  label={t("memory")}
                  value={memoryPercent === undefined ? "--" : formatPercent(memoryPercent)}
                  meter={memoryPercent}
                  color="var(--color-memory)"
                />
                <MetricCell
                  label={t("worstDisk")}
                  value={diskPercent === undefined ? "--" : formatPercent(diskPercent)}
                  meter={diskPercent}
                  color="var(--color-disk)"
                />
                <NetworkMetricCell
                  label={t("network")}
                  rxLabel={t("rx")}
                  txLabel={t("tx")}
                  rxValue={snapshot ? formatRate(rx) : "--"}
                  txValue={snapshot ? formatRate(tx) : "--"}
                  meter={snapshot ? Math.min(100, (rx + tx) / 1024 / 1024) : undefined}
                />

                <div className="grid min-w-0 gap-1 text-right text-[11px] text-[var(--color-text-muted)]">
                  <div className="truncate tabular-nums">
                    {t("load")} {snapshot ? snapshot.system.loadAvg.map((value) => value.toFixed(2)).join(" ") : "--"}
                  </div>
                  <div className="truncate tabular-nums">
                    {t("uptime")} {snapshot ? formatDuration(snapshot.system.uptimeSec) : "--"}
                  </div>
                  <div className="truncate tabular-nums">
                    {t("processes")} {snapshot ? snapshot.processes.length : "--"}
                  </div>
                  <div className="truncate tabular-nums">
                    {t("last")} {snapshot ? formatDateTime(snapshot.ts) : t("never")}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
