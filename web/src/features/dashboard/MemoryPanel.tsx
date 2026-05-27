import type { CSSProperties } from "react";
import { MetricPanel } from "@/components/panel/MetricPanel";
import { PIXEL_DENSITY } from "@/components/pixelDensity";
import { useI18n } from "@/i18n/useI18n";
import { formatBytes, formatPercent } from "@/lib/format";
import type { HostSnapshot } from "@/types/contracts";

type MemoryPanelProps = {
  snapshot: HostSnapshot;
  history?: unknown;
};

type MemoryDotRowProps = {
  label: string;
  value: string;
  percent: number;
  color: string;
};

function MemoryDotRow({ label, value, percent, color }: MemoryDotRowProps) {
  const columns = PIXEL_DENSITY.memory.columns;
  const rows = PIXEL_DENSITY.memory.rows;
  const activeColumns = percent > 0 ? Math.max(1, Math.ceil((Math.min(100, percent) / 100) * columns)) : 0;
  const dotGridStyle = { "--memory-dot-columns": columns } as CSSProperties;

  return (
    <div className="btop-memory-stat">
      <div className="btop-memory-label">
        <span>{label}:</span>
        <strong>{value}</strong>
      </div>
      <div className="btop-memory-dots" style={dotGridStyle}>
        {Array.from({ length: rows * columns }, (_, index) => {
          const column = index % columns;

          return (
            <span
              key={index}
              className="btop-memory-dot"
              style={{
                backgroundColor: column < activeColumns ? color : "var(--color-bar-track)",
                opacity: column < activeColumns ? 1 : 0.22,
              }}
            />
          );
        })}
      </div>
      <span className="btop-memory-percent">{Math.round(percent)}%</span>
    </div>
  );
}

export function MemoryPanel({ snapshot }: MemoryPanelProps) {
  const { t } = useI18n();
  const usedPercent = snapshot.memory.totalBytes > 0 ? (snapshot.memory.usedBytes / snapshot.memory.totalBytes) * 100 : 0;
  const availablePercent =
    snapshot.memory.totalBytes > 0 ? (snapshot.memory.availableBytes / snapshot.memory.totalBytes) * 100 : 0;
  const cachedPercent = snapshot.memory.totalBytes > 0 ? (snapshot.memory.cachedBytes / snapshot.memory.totalBytes) * 100 : 0;
  const freeBytes = Math.max(0, snapshot.memory.totalBytes - snapshot.memory.usedBytes);
  const freePercent = snapshot.memory.totalBytes > 0 ? (freeBytes / snapshot.memory.totalBytes) * 100 : 0;
  const swapPercent =
    snapshot.memory.swapTotalBytes > 0 ? (snapshot.memory.swapUsedBytes / snapshot.memory.swapTotalBytes) * 100 : 0;

  return (
    <MetricPanel panelId="memory" title={t("memory")} accent="var(--color-memory)" status={formatPercent(usedPercent)} collapsed={false}>
      <div className="btop-memory-grid">
        <div className="btop-stat-lines">
          <div className="btop-memory-total">
            <span>{t("total")}:</span>
            <strong>{formatBytes(snapshot.memory.totalBytes)}</strong>
          </div>
          <MemoryDotRow label={t("used")} value={formatBytes(snapshot.memory.usedBytes)} percent={usedPercent} color="var(--color-memory)" />
          <MemoryDotRow label={t("available")} value={formatBytes(snapshot.memory.availableBytes)} percent={availablePercent} color="var(--color-warning)" />
          <MemoryDotRow label={t("cache")} value={formatBytes(snapshot.memory.cachedBytes)} percent={cachedPercent} color="var(--color-network-tx)" />
          <MemoryDotRow label={t("free")} value={formatBytes(freeBytes)} percent={freePercent} color="var(--color-cpu)" />
          <div className="btop-memory-mini">
            <span>{t("mem")}</span>
            <strong>{Math.round(usedPercent)}%</strong>
            <span>{t("swap")}</span>
            <strong>{Math.round(swapPercent)}%</strong>
          </div>
        </div>
      </div>
    </MetricPanel>
  );
}
