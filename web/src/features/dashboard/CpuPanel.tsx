import { DotMatrixChart } from "@/components/chart/DotMatrixChart";
import { TerminalMeter } from "@/components/meter/TerminalMeter";
import { MetricPanel } from "@/components/panel/MetricPanel";
import { useI18n } from "@/i18n/useI18n";
import { formatPercent } from "@/lib/format";
import type { HostSnapshot } from "@/types/contracts";
import type { HistoryPoint } from "@/lib/historyBuffer";

type CpuPanelProps = {
  snapshot: HostSnapshot;
  history: Array<HistoryPoint<number>>;
};

function formatUptime(totalSeconds: number) {
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);

  return `${days}d ${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;
}

export function CpuPanel({ snapshot, history }: CpuPanelProps) {
  const { t } = useI18n();
  const historyValues = history.map((point) => point.value);

  return (
    <MetricPanel panelId="cpu" title={t("cpu")} accent="var(--color-cpu)" status={formatPercent(snapshot.cpu.totalPercent)} collapsed={false}>
      <div className="btop-cpu-grid">
        <div className="btop-cpu-chart">
          <DotMatrixChart
            values={historyValues}
            color="var(--color-cpu)"
            max={100}
            rows={20}
            minColumns={132}
            maxColumns={220}
            cellSize={4}
            dotSize={2}
            inactiveOpacity={0.1}
            minActiveRows={1}
          />
          <div className="btop-faint-label">{t("uptime")} {formatUptime(snapshot.system.uptimeSec)}</div>
        </div>
        <div className="btop-cpu-side">
          <div className="btop-side-title">
            <span>{snapshot.system.hostname}</span>
            <span>{Math.round(snapshot.cpu.totalPercent)}</span>
          </div>
          <TerminalMeter label="CPU" value={snapshot.cpu.totalPercent} color="var(--color-cpu)" segments={18} />
          {snapshot.cpu.cores.slice(0, 8).map((core) => (
            <TerminalMeter key={core.id} label={core.id.toUpperCase()} value={core.percent} color="var(--color-cpu)" segments={18} />
          ))}
          <div className="btop-load">
            LAV: {snapshot.system.loadAvg.map((load) => load.toFixed(2)).join(" ")}
          </div>
        </div>
      </div>
    </MetricPanel>
  );
}
