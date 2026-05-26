import { Sparkline } from "@/components/chart/Sparkline";
import { SegmentedMeter } from "@/components/meter/SegmentedMeter";
import { UsageRing } from "@/components/meter/UsageRing";
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
  const usedPercent = snapshot.memory.totalBytes > 0 ? (snapshot.memory.usedBytes / snapshot.memory.totalBytes) * 100 : 0;
  const swapPercent =
    snapshot.memory.swapTotalBytes > 0 ? (snapshot.memory.swapUsedBytes / snapshot.memory.swapTotalBytes) * 100 : 0;

  return (
    <MetricPanel title={t("memory")} accent="var(--color-memory)" status={formatPercent(usedPercent)}>
      <div className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-3">
        <div className="grid min-h-0 grid-cols-[94px_minmax(0,1fr)] gap-3">
          <UsageRing
            value={usedPercent}
            label={t("memory")}
            detail={formatBytes(snapshot.memory.totalBytes)}
            color="var(--color-memory)"
            size={92}
          />
          <div className="grid min-h-0 grid-rows-[auto_48px] gap-2">
            <div className="grid grid-cols-3 gap-2 font-mono text-[11px]">
              <div className="rounded-[var(--radius-control)] border border-[var(--color-border-subtle)] bg-[var(--color-input)] px-2 py-1">
                <div className="text-[var(--color-text-muted)]">{t("used")}</div>
                <div className="mt-0.5 truncate text-xs text-[var(--color-memory)] tabular-nums">
                  {formatBytes(snapshot.memory.usedBytes)}
                </div>
              </div>
              <div className="rounded-[var(--radius-control)] border border-[var(--color-border-subtle)] bg-[var(--color-input)] px-2 py-1">
                <div className="text-[var(--color-text-muted)]">{t("available")}</div>
                <div className="mt-0.5 truncate text-xs text-[var(--color-cpu)] tabular-nums">
                  {formatBytes(snapshot.memory.availableBytes)}
                </div>
              </div>
              <div className="rounded-[var(--radius-control)] border border-[var(--color-border-subtle)] bg-[var(--color-input)] px-2 py-1">
                <div className="text-[var(--color-text-muted)]">{t("cache")}</div>
                <div className="mt-0.5 truncate text-xs text-[var(--color-text)] tabular-nums">
                  {formatBytes(snapshot.memory.cachedBytes)}
                </div>
              </div>
            </div>
            <div className="min-h-0 rounded-[var(--radius-control)] border border-[var(--color-border-subtle)] bg-[var(--color-input)] p-2">
              <Sparkline
                values={history.map((point) => point.value)}
                color="var(--color-memory)"
                fillColor="var(--color-chart-fill)"
                max={100}
                strokeWidth={2.4}
              />
            </div>
          </div>
        </div>
        <div className="grid content-start gap-1.5">
          <SegmentedMeter label={t("mem")} value={usedPercent} color="var(--color-memory)" segments={20} />
          <SegmentedMeter label={t("swap")} value={swapPercent} color="var(--color-warning)" segments={20} />
        </div>
      </div>
    </MetricPanel>
  );
}
