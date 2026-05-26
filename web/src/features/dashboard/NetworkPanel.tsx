import { Sparkline } from "@/components/chart/Sparkline";
import { SegmentedMeter } from "@/components/meter/SegmentedMeter";
import { MetricPanel } from "@/components/panel/MetricPanel";
import { useI18n } from "@/i18n/useI18n";
import { formatBytes, formatPercent, formatRate } from "@/lib/format";
import type { HistoryPoint } from "@/lib/historyBuffer";
import type { HostSnapshot } from "@/types/contracts";

type NetworkPanelProps = {
  snapshot: HostSnapshot;
  rxHistory: Array<HistoryPoint<number>>;
  txHistory: Array<HistoryPoint<number>>;
};

export function NetworkPanel({ snapshot, rxHistory, txHistory }: NetworkPanelProps) {
  const { t } = useI18n();
  const maxRate = Math.max(1, ...rxHistory.map((point) => point.value), ...txHistory.map((point) => point.value));
  const rxTotalRate = snapshot.network.reduce((total, iface) => total + iface.rxBytesPerSec, 0);
  const txTotalRate = snapshot.network.reduce((total, iface) => total + iface.txBytesPerSec, 0);
  const combinedRate = rxTotalRate + txTotalRate;
  const rxShare = combinedRate > 0 ? (rxTotalRate / combinedRate) * 100 : 0;
  const txShare = combinedRate > 0 ? (txTotalRate / combinedRate) * 100 : 0;
  const maxIfaceRate = Math.max(1, ...snapshot.network.map((iface) => iface.rxBytesPerSec + iface.txBytesPerSec));

  return (
    <MetricPanel title={t("network")} accent="var(--color-network-rx)" status={t("ifaces", { count: snapshot.network.length })}>
      <div className="grid h-full min-h-0 grid-rows-[auto_auto_minmax(0,1fr)] gap-3">
        <div className="grid min-h-0 grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-2">
          <div className="grid min-h-0 gap-2 rounded-[var(--radius-control)] border border-[var(--color-border-subtle)] bg-[var(--color-input)] p-2">
            <div className="flex items-baseline justify-between gap-2 font-mono">
              <span className="text-[11px] uppercase text-[var(--color-text-muted)]">{t("rx")}</span>
              <span className="truncate text-lg text-[var(--color-network-rx)] tabular-nums">{formatRate(rxTotalRate)}</span>
            </div>
            <Sparkline
              values={rxHistory.map((point) => point.value)}
              color="var(--color-network-rx)"
              fillColor="var(--color-accent-soft)"
              max={maxRate}
              strokeWidth={2.2}
            />
          </div>
          <div className="grid min-h-0 gap-2 rounded-[var(--radius-control)] border border-[var(--color-border-subtle)] bg-[var(--color-input)] p-2">
            <div className="flex items-baseline justify-between gap-2 font-mono">
              <span className="text-[11px] uppercase text-[var(--color-text-muted)]">{t("tx")}</span>
              <span className="truncate text-lg text-[var(--color-network-tx)] tabular-nums">{formatRate(txTotalRate)}</span>
            </div>
            <Sparkline
              values={txHistory.map((point) => point.value)}
              color="var(--color-network-tx)"
              fillColor="var(--color-accent-soft)"
              max={maxRate}
              strokeWidth={2.2}
            />
          </div>
        </div>
        <div className="grid gap-1.5 rounded-[var(--radius-control)] border border-[var(--color-border-subtle)] bg-[var(--color-input)] p-2 font-mono text-[11px]">
          <div className="flex items-center justify-between gap-2 text-[var(--color-text-muted)]">
            <span>{t("trafficSplit")}</span>
            <span className="tabular-nums">
              {t("rx")} {formatPercent(rxShare)} / {t("tx")} {formatPercent(txShare)}
            </span>
          </div>
          <div className="flex h-3 overflow-hidden rounded-[var(--radius-control)] bg-[var(--color-bar-track)]">
            <span
              className="h-full transition-[width] duration-300"
              style={{ width: `${rxShare}%`, backgroundColor: "var(--color-network-rx)" }}
            />
            <span
              className="h-full transition-[width] duration-300"
              style={{ width: `${txShare}%`, backgroundColor: "var(--color-network-tx)" }}
            />
          </div>
        </div>
        <div className="scrollbar-none min-h-0 space-y-1.5 overflow-auto font-mono text-xs">
          {snapshot.network.map((iface) => (
            <div
              key={iface.iface}
              className="grid min-w-0 gap-1.5 rounded-[var(--radius-control)] border border-[var(--color-border-subtle)] bg-[var(--color-input)] px-2 py-1.5"
            >
              <div className="grid min-w-0 grid-cols-[72px_minmax(0,1fr)_auto] items-center gap-2">
                <span className="truncate text-[var(--color-text)]">{iface.iface}</span>
                <span className="truncate text-[var(--color-text-muted)]">
                  {t("total")} {formatBytes(iface.rxTotalBytes + iface.txTotalBytes)}
                </span>
                <span className="text-right text-[var(--color-accent)] tabular-nums">
                  {formatRate(iface.rxBytesPerSec + iface.txBytesPerSec)}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <SegmentedMeter
                  value={(iface.rxBytesPerSec / maxIfaceRate) * 100}
                  detail={`${t("rx")} ${formatRate(iface.rxBytesPerSec)}`}
                  color="var(--color-network-rx)"
                  compact
                  segments={12}
                />
                <SegmentedMeter
                  value={(iface.txBytesPerSec / maxIfaceRate) * 100}
                  detail={`${t("tx")} ${formatRate(iface.txBytesPerSec)}`}
                  color="var(--color-network-tx)"
                  compact
                  segments={12}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </MetricPanel>
  );
}
