import { Sparkline } from "@/components/chart/Sparkline";
import { BarMeter } from "@/components/meter/BarMeter";
import { MetricPanel } from "@/components/panel/MetricPanel";
import { useI18n } from "@/i18n/useI18n";
import { formatBytes, formatPercent } from "@/lib/format";
import type { HistoryPoint } from "@/lib/historyBuffer";
import type { HostSnapshot } from "@/types/contracts";

type MemoryPanelProps = {
  snapshot: HostSnapshot;
  history: Array<HistoryPoint<number>>;
};

export function MemoryPanel({ snapshot, history }: MemoryPanelProps) {
  const { t } = useI18n();
  const usedPercent = (snapshot.memory.usedBytes / snapshot.memory.totalBytes) * 100;
  const swapPercent =
    snapshot.memory.swapTotalBytes > 0 ? (snapshot.memory.swapUsedBytes / snapshot.memory.swapTotalBytes) * 100 : 0;

  return (
    <MetricPanel title={t("memory")} accent="var(--color-memory)" status={formatPercent(usedPercent)}>
      <div className="grid h-full min-h-0 gap-2">
        <div className="grid grid-cols-3 gap-2 font-mono text-xs">
          <div>
            <div className="text-[var(--color-text-muted)]">{t("used")}</div>
            <div className="tabular-nums">{formatBytes(snapshot.memory.usedBytes)}</div>
          </div>
          <div>
            <div className="text-[var(--color-text-muted)]">{t("available")}</div>
            <div className="tabular-nums">{formatBytes(snapshot.memory.availableBytes)}</div>
          </div>
          <div>
            <div className="text-[var(--color-text-muted)]">{t("cache")}</div>
            <div className="tabular-nums">{formatBytes(snapshot.memory.cachedBytes)}</div>
          </div>
        </div>
        <Sparkline values={history.map((point) => point.value)} color="var(--color-memory)" max={100} />
        <BarMeter label={t("mem")} value={usedPercent} color="var(--color-memory)" />
        <BarMeter label={t("swap")} value={swapPercent} color="var(--color-warning)" />
      </div>
    </MetricPanel>
  );
}
