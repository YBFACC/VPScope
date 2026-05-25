import { Sparkline } from "@/components/chart/Sparkline";
import { BarMeter } from "@/components/meter/BarMeter";
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

  return (
    <MetricPanel title={t("cpu")} accent="var(--color-cpu)" status={formatPercent(snapshot.cpu.totalPercent)}>
      <div className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-2">
        <div className="grid grid-cols-[96px_minmax(0,1fr)] gap-2">
          <div className="font-mono text-3xl leading-none text-[var(--color-cpu)] tabular-nums">
            {formatPercent(snapshot.cpu.totalPercent)}
          </div>
          <Sparkline values={history.map((point) => point.value)} color="var(--color-cpu)" max={100} />
        </div>
        <div className="scrollbar-none min-h-0 overflow-auto">
          <div className="grid gap-1.5">
          {snapshot.cpu.cores.map((core) => (
            <BarMeter key={core.id} label={core.id} value={core.percent} color="var(--color-cpu)" />
          ))}
          </div>
        </div>
      </div>
    </MetricPanel>
  );
}
