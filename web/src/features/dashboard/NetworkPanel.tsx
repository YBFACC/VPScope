import { Sparkline } from "@/components/chart/Sparkline";
import { MetricPanel } from "@/components/panel/MetricPanel";
import { useI18n } from "@/i18n/useI18n";
import { formatBytes, formatRate } from "@/lib/format";
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

  return (
    <MetricPanel title={t("network")} accent="var(--color-network-rx)" status={t("ifaces", { count: snapshot.network.length })}>
      <div className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-2">
        <div className="grid grid-cols-2 gap-2">
          <Sparkline values={rxHistory.map((point) => point.value)} color="var(--color-network-rx)" max={maxRate} />
          <Sparkline values={txHistory.map((point) => point.value)} color="var(--color-network-tx)" max={maxRate} />
        </div>
        <div className="scrollbar-none min-h-0 space-y-1.5 overflow-auto font-mono text-xs">
          {snapshot.network.map((iface) => (
            <div key={iface.iface} className="grid grid-cols-[64px_minmax(0,1fr)] gap-2">
              <span className="truncate text-[var(--color-text-muted)]">{iface.iface}</span>
              <span className="flex min-w-0 items-center gap-2 overflow-hidden">
                <span className="shrink-0 text-[var(--color-network-rx)]">{t("rx")} {formatRate(iface.rxBytesPerSec)}</span>
                <span className="shrink-0 text-[var(--color-text-muted)]">/</span>
                <span className="shrink-0 text-[var(--color-network-tx)]">{t("tx")} {formatRate(iface.txBytesPerSec)}</span>
                <span className="truncate text-[var(--color-text-muted)]">
                  {t("total")} {formatBytes(iface.rxTotalBytes + iface.txTotalBytes)}
                </span>
              </span>
            </div>
          ))}
        </div>
      </div>
    </MetricPanel>
  );
}
