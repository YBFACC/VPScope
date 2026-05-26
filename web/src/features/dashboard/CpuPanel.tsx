import { Sparkline } from "@/components/chart/Sparkline";
import { SegmentedMeter } from "@/components/meter/SegmentedMeter";
import { UsageRing } from "@/components/meter/UsageRing";
import { MetricPanel } from "@/components/panel/MetricPanel";
import { useI18n } from "@/i18n/useI18n";
import { formatPercent } from "@/lib/format";
import type { HostSnapshot } from "@/types/contracts";
import type { HistoryPoint } from "@/lib/historyBuffer";

type CpuPanelProps = {
  snapshot: HostSnapshot;
  history: Array<HistoryPoint<number>>;
};

export function CpuPanel({ snapshot, history }: CpuPanelProps) {
  const { t } = useI18n();
  const corePeak = Math.max(0, ...snapshot.cpu.cores.map((core) => core.percent));
  const coreAverage =
    snapshot.cpu.cores.length > 0
      ? snapshot.cpu.cores.reduce((total, core) => total + core.percent, 0) / snapshot.cpu.cores.length
      : snapshot.cpu.totalPercent;

  return (
    <MetricPanel panelId="cpu" title={t("cpu")} accent="var(--color-cpu)" status={formatPercent(snapshot.cpu.totalPercent)}>
      <div className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-3">
        <div className="grid min-h-0 grid-cols-[94px_minmax(0,1fr)] gap-3">
          <UsageRing value={snapshot.cpu.totalPercent} label={t("cpu")} color="var(--color-cpu)" size={92} />
          <div className="grid min-h-0 grid-rows-[auto_48px] gap-2">
            <div className="grid grid-cols-2 gap-2 font-mono text-[11px]">
              <div className="rounded-[var(--radius-control)] border border-[var(--color-border-subtle)] bg-[var(--color-input)] px-2 py-1">
                <div className="text-[var(--color-text-muted)]">{t("average")}</div>
                <div className="mt-0.5 text-xs text-[var(--color-text)] tabular-nums">{formatPercent(coreAverage)}</div>
              </div>
              <div className="rounded-[var(--radius-control)] border border-[var(--color-border-subtle)] bg-[var(--color-input)] px-2 py-1">
                <div className="text-[var(--color-text-muted)]">{t("peak")}</div>
                <div className="mt-0.5 text-xs text-[var(--color-cpu)] tabular-nums">{formatPercent(corePeak)}</div>
              </div>
            </div>
            <div className="min-h-0 rounded-[var(--radius-control)] border border-[var(--color-border-subtle)] bg-[var(--color-input)] p-2">
              <Sparkline
                values={history.map((point) => point.value)}
                color="var(--color-cpu)"
                fillColor="var(--color-chart-fill)"
                max={100}
                strokeWidth={2.4}
              />
            </div>
          </div>
        </div>
        <div className="scrollbar-none min-h-0 overflow-auto">
          <div className="grid gap-1.5">
            {snapshot.cpu.cores.map((core) => (
              <SegmentedMeter key={core.id} label={core.id} value={core.percent} color="var(--color-cpu)" segments={16} />
            ))}
          </div>
        </div>
      </div>
    </MetricPanel>
  );
}
