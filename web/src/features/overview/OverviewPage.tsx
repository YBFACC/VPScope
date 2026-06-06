import { useState } from "react";
import clsx from "clsx";
import { ChevronDownIcon, ChevronUpIcon, TerminalIcon, TrashIcon } from "@/features/hosts/HostActionIcons";
import { HostConnectionBadge } from "@/features/hosts/HostConnectionBadge";
import { useI18n } from "@/i18n/useI18n";
import { formatDuration, formatPercent, formatRate } from "@/lib/format";
import type { HistoryPoint } from "@/lib/historyBuffer";
import { useHostStore } from "@/stores/hostStore";
import type { MetricHistory } from "@/stores/metricsStore";
import { useTerminalSettingsStore } from "@/stores/terminalSettingsStore";
import type { AppError, HostConfig, HostConnectionState, HostSnapshot } from "@/types/contracts";

type OverviewPageProps = {
  hosts: HostConfig[];
  snapshots: Record<string, HostSnapshot | undefined>;
  histories: Record<string, MetricHistory | undefined>;
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

function aggregateNetworkHistory(
  history: MetricHistory | undefined,
  key: "rx" | "tx",
  fallbackValue: number | undefined,
) {
  const pointsByTimestamp = new Map<number, number>();

  for (const ifaceHistory of Object.values(history?.networkByInterface ?? {})) {
    for (const point of ifaceHistory[key]) {
      pointsByTimestamp.set(point.ts, (pointsByTimestamp.get(point.ts) ?? 0) + point.value);
    }
  }

  const points = Array.from(pointsByTimestamp, ([ts, value]) => ({ ts, value })).sort((left, right) => left.ts - right.ts);

  if (points.length > 0) {
    return points;
  }

  return fallbackValue === undefined ? [] : [{ ts: 0, value: fallbackValue }];
}

const networkGaugeBands = [
  { max: 64 * 1024, label: "64K", tone: "var(--color-network-tx)" },
  { max: 1024 * 1024, label: "1M", tone: "var(--color-accent)" },
  { max: 16 * 1024 * 1024, label: "16M", tone: "var(--color-warning)" },
  { max: 128 * 1024 * 1024, label: "128M+", tone: "var(--color-danger)" },
] as const;

function networkGaugeRatio(rateBytesPerSec: number) {
  if (rateBytesPerSec <= 0) {
    return 0;
  }

  const bandIndex = networkGaugeBands.findIndex((band) => rateBytesPerSec <= band.max);

  if (bandIndex === -1) {
    return 1;
  }

  const previousMax = bandIndex === 0 ? 0 : networkGaugeBands[bandIndex - 1].max;
  const bandRange = networkGaugeBands[bandIndex].max - previousMax;
  const bandProgress = bandRange > 0 ? (rateBytesPerSec - previousMax) / bandRange : 1;

  return Math.min(1, (bandIndex + Math.max(0, Math.min(1, bandProgress))) / networkGaugeBands.length);
}

function networkGaugeBand(rateBytesPerSec: number) {
  const band = networkGaugeBands.find((item) => rateBytesPerSec <= item.max);

  return band ?? networkGaugeBands[networkGaugeBands.length - 1];
}

function gaugePoint(angleDegrees: number, radius: number) {
  const radians = (angleDegrees * Math.PI) / 180;

  return {
    x: 42 + Math.cos(radians) * radius,
    y: 42 + Math.sin(radians) * radius,
  };
}

function gaugeArc(endRatio: number) {
  const startAngle = 180;
  const endAngle = 180 + endRatio * 180;
  const start = gaugePoint(startAngle, 31);
  const end = gaugePoint(endAngle, 31);

  return `M ${start.x.toFixed(2)} ${start.y.toFixed(2)} A 31 31 0 0 1 ${end.x.toFixed(2)} ${end.y.toFixed(2)}`;
}

function totalNetworkPeak(rxHistory: Array<HistoryPoint<number>>, txHistory: Array<HistoryPoint<number>>, currentRate: number) {
  const totalsByTimestamp = new Map<number, number>();

  for (const point of rxHistory) {
    totalsByTimestamp.set(point.ts, (totalsByTimestamp.get(point.ts) ?? 0) + point.value);
  }

  for (const point of txHistory) {
    totalsByTimestamp.set(point.ts, (totalsByTimestamp.get(point.ts) ?? 0) + point.value);
  }

  return Math.max(currentRate, ...totalsByTimestamp.values());
}

function NetworkSpeedGauge({ rate, peak, peakLabel }: { rate: number; peak: number; peakLabel: string }) {
  const ratio = networkGaugeRatio(rate);
  const band = networkGaugeBand(rate);
  const needleAngle = 180 + ratio * 180;
  const needle = gaugePoint(needleAngle, 24);

  return (
    <div className="overview-network-gauge" style={{ color: band.tone }} aria-hidden="true">
      <svg className="overview-network-gauge-svg" viewBox="0 0 84 52" preserveAspectRatio="xMidYMid meet">
        <path d={gaugeArc(1)} className="overview-network-gauge-track" />
        {networkGaugeBands.map((_, index) => {
          const angle = 180 + ((index + 1) / networkGaugeBands.length) * 180;
          const inner = gaugePoint(angle, 25);
          const outer = gaugePoint(angle, 33);

          return (
            <line
              key={index}
              x1={inner.x.toFixed(2)}
              y1={inner.y.toFixed(2)}
              x2={outer.x.toFixed(2)}
              y2={outer.y.toFixed(2)}
              className="overview-network-gauge-tick"
            />
          );
        })}
        {ratio > 0 ? <path d={gaugeArc(ratio)} className="overview-network-gauge-fill" /> : null}
        <line x1="42" y1="42" x2={needle.x.toFixed(2)} y2={needle.y.toFixed(2)} className="overview-network-gauge-needle" />
        <circle cx="42" cy="42" r="2.4" className="overview-network-gauge-pin" />
      </svg>
      <div className="overview-network-gauge-value tabular-nums">{formatRate(rate)}</div>
      <div className="overview-network-gauge-peak tabular-nums">
        {band.label} · {peakLabel} {formatRate(peak)}
      </div>
    </div>
  );
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
  const cpuPercent = snapshot.sampleState === "live" ? snapshot.cpu.totalPercent : undefined;

  if ((cpuPercent !== undefined && cpuPercent >= 90) || memoryPercent >= 90 || diskPercent >= 90) {
    return "hot";
  }

  if ((cpuPercent !== undefined && cpuPercent >= 75) || memoryPercent >= 75 || diskPercent >= 80) {
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
  peakLabel,
  rxHistory,
  txHistory,
}: {
  label: string;
  rxLabel: string;
  txLabel: string;
  rxValue: string;
  txValue: string;
  peakLabel: string;
  rxHistory: Array<HistoryPoint<number>>;
  txHistory: Array<HistoryPoint<number>>;
}) {
  const rxRate = rxHistory.at(-1)?.value ?? 0;
  const txRate = txHistory.at(-1)?.value ?? 0;
  const totalRate = rxRate + txRate;
  const peakRate = totalNetworkPeak(rxHistory, txHistory, totalRate);

  return (
    <div className="overview-network-cell">
      <div className={metricHeaderClass}>
        <span className={metricLabelClass}>{label}</span>
      </div>
      <div className="overview-network-speed">
        <NetworkSpeedGauge rate={totalRate} peak={peakRate} peakLabel={peakLabel} />
        <div className="overview-network-rates tabular-nums">
          <span className="text-[var(--color-network-rx)]">
            {rxLabel} {rxValue}
          </span>
          <span className="text-[var(--color-network-tx)]">
            {txLabel} {txValue}
          </span>
        </div>
      </div>
    </div>
  );
}

export function OverviewPage({
  hosts,
  snapshots,
  histories,
  connectionStates,
  errorsByHost,
  isSubscribing,
  onOpenHost,
}: OverviewPageProps) {
  const { t } = useI18n();
  const moveHost = useHostStore((state) => state.moveHost);
  const deleteHost = useHostStore((state) => state.deleteHost);
  const isReordering = useHostStore((state) => state.isReordering);
  const openHostTerminal = useTerminalSettingsStore((state) => state.openHostTerminal);
  const openingHostIds = useTerminalSettingsStore((state) => state.openingHostIds);
  const [deletingHostIds, setDeletingHostIds] = useState<Record<string, boolean>>({});

  async function removeHostFromList(hostId: string) {
    setDeletingHostIds((current) => ({ ...current, [hostId]: true }));

    try {
      await deleteHost(hostId);
    } finally {
      setDeletingHostIds((current) => {
        const { [hostId]: _deleted, ...next } = current;
        return next;
      });
    }
  }

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
      </div>

      <div className="scrollbar-none min-h-0 overflow-auto">
        <div className="grid min-w-[760px] gap-1.5">
          {hosts.map((host, index) => {
            const snapshot = snapshots[host.id];
            const connection = connectionStates[host.id];
            const error = errorsByHost[host.id] ?? connection?.lastError;
            const memoryPercent = snapshot
              ? safePercent(snapshot.memory.usedBytes, snapshot.memory.totalBytes)
              : undefined;
            const diskPercent = maxDiskPercent(snapshot);
            const isLiveSample = snapshot?.sampleState === "live";
            const rx = isLiveSample ? sumNetwork(snapshot, "rxBytesPerSec") : 0;
            const tx = isLiveSample ? sumNetwork(snapshot, "txBytesPerSec") : 0;
            const history = histories[host.id];
            const rxHistory = aggregateNetworkHistory(history, "rx", isLiveSample ? rx : undefined);
            const txHistory = aggregateNetworkHistory(history, "tx", isLiveSample ? tx : undefined);
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
                  "pixel-card grid min-h-20 min-w-0 cursor-default grid-cols-[220px_88px_repeat(2,minmax(96px,1fr))_minmax(120px,0.9fr)_minmax(250px,0.72fr)_118px] items-center gap-x-5 gap-y-3 p-2 text-[11px] outline-none transition-colors",
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
                  <div className="mt-1 truncate text-[10px] text-[var(--color-text-muted)] tabular-nums">
                    {t("uptime")} {snapshot ? formatDuration(snapshot.system.uptimeSec) : "--"}
                  </div>
                </div>

                <MetricCell
                  label={t("cpu")}
                  value={isLiveSample && snapshot ? formatPercent(snapshot.cpu.totalPercent) : "--"}
                  meter={isLiveSample ? snapshot?.cpu.totalPercent : undefined}
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
                  rxValue={isLiveSample ? formatRate(rx) : "--"}
                  txValue={isLiveSample ? formatRate(tx) : "--"}
                  peakLabel={t("peak")}
                  rxHistory={rxHistory}
                  txHistory={txHistory}
                />

                <div className="flex min-w-0 items-center justify-end gap-1.5">
                  <div className="host-segmented-control">
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        void moveHost(host.id, "up");
                      }}
                      disabled={index === 0 || isReordering}
                      className="host-icon-button host-icon-button-segment rounded-l-[var(--radius-control)]"
                      title={t("moveHostUp")}
                      aria-label={t("moveHostUp")}
                    >
                      <ChevronUpIcon />
                    </button>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        void moveHost(host.id, "down");
                      }}
                      disabled={index === hosts.length - 1 || isReordering}
                      className="host-icon-button host-icon-button-segment rounded-r-[var(--radius-control)]"
                      title={t("moveHostDown")}
                      aria-label={t("moveHostDown")}
                    >
                      <ChevronDownIcon />
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      void openHostTerminal(host.id);
                    }}
                    disabled={Boolean(openingHostIds[host.id])}
                    className="host-icon-button"
                    title={openingHostIds[host.id] ? t("openingTerminal") : t("openTerminal")}
                    aria-label={openingHostIds[host.id] ? t("openingTerminal") : t("openTerminal")}
                  >
                    {openingHostIds[host.id] ? <span className="host-icon-loading" /> : <TerminalIcon />}
                  </button>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      void removeHostFromList(host.id);
                    }}
                    disabled={Boolean(deletingHostIds[host.id])}
                    className="host-icon-button host-icon-button-danger"
                    title={deletingHostIds[host.id] ? t("removingHost") : t("removeHostFromList")}
                    aria-label={deletingHostIds[host.id] ? t("removingHost") : t("removeHostFromList")}
                  >
                    {deletingHostIds[host.id] ? <span className="host-icon-loading" /> : <TrashIcon />}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
