import { TerminalMeter } from "@/components/meter/TerminalMeter";
import { MetricPanel } from "@/components/panel/MetricPanel";
import { useI18n } from "@/i18n/useI18n";
import { formatBytes, formatPercent, formatRate } from "@/lib/format";
import type { HostSnapshot } from "@/types/contracts";

type DiskPanelProps = {
  snapshot: HostSnapshot;
};

type DiskItem = {
  id: string;
  label: string;
  detail: string;
  totalBytes: number;
  usedBytes: number;
  readBytesPerSec?: number;
  writeBytesPerSec?: number;
  isSwap?: boolean;
};

function percent(usedBytes: number, totalBytes: number) {
  return totalBytes > 0 ? (usedBytes / totalBytes) * 100 : 0;
}

export function DiskPanel({ snapshot }: DiskPanelProps) {
  const { t } = useI18n();
  const diskItems: DiskItem[] = [
    ...snapshot.disks.map((disk) => ({
      id: disk.mount,
      label: disk.mount,
      detail: disk.fs,
      totalBytes: disk.totalBytes,
      usedBytes: disk.usedBytes,
      readBytesPerSec: disk.readBytesPerSec,
      writeBytesPerSec: disk.writeBytesPerSec,
    })),
    {
      id: "swap",
      label: t("swap"),
      detail: t("swap"),
      totalBytes: snapshot.memory.swapTotalBytes,
      usedBytes: snapshot.memory.swapUsedBytes,
      isSwap: true,
    },
  ];
  const worstUsedPercent = diskItems.reduce((max, disk) => Math.max(max, percent(disk.usedBytes, disk.totalBytes)), 0);
  const maxIoRate = Math.max(
    1,
    ...diskItems.map((disk) => (disk.readBytesPerSec ?? 0) + (disk.writeBytesPerSec ?? 0)),
  );

  return (
    <MetricPanel panelId="disk" title={t("disks")} accent="var(--color-disk)" status={formatPercent(worstUsedPercent)} collapsed={false}>
      <div className="scrollbar-none btop-disk-list">
        {diskItems.map((disk) => {
          const usedPercent = percent(disk.usedBytes, disk.totalBytes);
          const freePercent = disk.totalBytes > 0 ? Math.max(0, 100 - usedPercent) : 0;
          const freeBytes = Math.max(0, disk.totalBytes - disk.usedBytes);

          return (
            <div key={disk.id} className="btop-disk-item">
              <div className="btop-disk-head">
                <span className="truncate" title={disk.label}>{disk.label}</span>
                <strong>{formatBytes(disk.totalBytes)}</strong>
              </div>
              <TerminalMeter label="U" value={usedPercent} detail={formatBytes(disk.usedBytes)} color={disk.isSwap ? "var(--color-warning)" : "var(--color-disk)"} segments={24} />
              <TerminalMeter label="F" value={freePercent} detail={formatBytes(freeBytes)} color="var(--color-cpu)" segments={24} />
              <div className="btop-io-row">
                <span>{disk.isSwap ? "IO" : t("read")}</span>
                <TerminalMeter value={disk.isSwap ? 0 : ((disk.readBytesPerSec ?? 0) / maxIoRate) * 100} color="var(--color-accent)" segments={12} showPercent={false} />
                <span>{disk.isSwap ? "--" : formatRate(disk.readBytesPerSec ?? 0)}</span>
              </div>
              <div className="btop-io-row">
                <span>{disk.isSwap ? "" : t("write")}</span>
                <TerminalMeter value={disk.isSwap ? 0 : ((disk.writeBytesPerSec ?? 0) / maxIoRate) * 100} color="var(--color-disk)" segments={12} showPercent={false} />
                <span>{disk.isSwap ? "" : formatRate(disk.writeBytesPerSec ?? 0)}</span>
              </div>
            </div>
          );
        })}
      </div>
    </MetricPanel>
  );
}
