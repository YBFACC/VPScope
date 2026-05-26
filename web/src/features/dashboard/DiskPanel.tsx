import { SegmentedMeter } from "@/components/meter/SegmentedMeter";
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
    <MetricPanel panelId="disk" title={t("disks")} accent="var(--color-disk)" status={formatPercent(worstUsedPercent)}>
      <div className="scrollbar-none grid h-full min-h-0 content-start gap-2 overflow-auto pr-1">
        {diskItems.map((disk) => {
          const usedPercent = percent(disk.usedBytes, disk.totalBytes);
          const freePercent = Math.max(0, 100 - usedPercent);
          const freeBytes = Math.max(0, disk.totalBytes - disk.usedBytes);

          return (
            <div
              key={disk.id}
              className="grid min-w-0 gap-2 rounded-[var(--radius-control)] border border-[var(--color-border-subtle)] bg-[var(--color-input)] p-2"
            >
              <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-start gap-2 font-mono">
                <div className="min-w-0">
                  <div className="truncate text-xs font-semibold leading-none text-[var(--color-text)]" title={disk.label}>
                    {disk.label}
                  </div>
                  <div className="mt-1 truncate text-[11px] text-[var(--color-text-muted)]">{disk.detail}</div>
                </div>
                <div className="grid gap-1 text-right leading-none">
                  <span className="text-xs text-[var(--color-disk)] tabular-nums">{formatPercent(usedPercent)}</span>
                  <span className="text-[11px] text-[var(--color-text-muted)] tabular-nums">{formatBytes(disk.totalBytes)}</span>
                </div>
              </div>
              <SegmentedMeter
                label={t("used")}
                value={usedPercent}
                detail={formatBytes(disk.usedBytes)}
                color={disk.isSwap ? "var(--color-warning)" : "var(--color-disk)"}
                segments={18}
              />
              <SegmentedMeter
                label={t("free")}
                value={freePercent}
                detail={formatBytes(freeBytes)}
                color="var(--color-cpu)"
                segments={18}
              />
              <div className="grid min-w-0 grid-cols-2 gap-2 font-mono text-[11px] leading-none">
                <div className="grid min-w-0 gap-1">
                  <div className="flex items-center justify-between gap-2 text-[var(--color-text-muted)]">
                    <span>{t("read")}</span>
                    <span className="truncate text-[var(--color-text)] tabular-nums">
                      {disk.isSwap ? "--" : formatRate(disk.readBytesPerSec ?? 0)}
                    </span>
                  </div>
                  <SegmentedMeter
                    value={disk.isSwap ? 0 : ((disk.readBytesPerSec ?? 0) / maxIoRate) * 100}
                    color="var(--color-accent)"
                    compact
                    showValue={false}
                    segments={10}
                  />
                </div>
                <div className="grid min-w-0 gap-1">
                  <div className="flex items-center justify-between gap-2 text-[var(--color-text-muted)]">
                    <span>{t("write")}</span>
                    <span className="truncate text-[var(--color-text)] tabular-nums">
                      {disk.isSwap ? "--" : formatRate(disk.writeBytesPerSec ?? 0)}
                    </span>
                  </div>
                  <SegmentedMeter
                    value={disk.isSwap ? 0 : ((disk.writeBytesPerSec ?? 0) / maxIoRate) * 100}
                    color="var(--color-warning)"
                    compact
                    showValue={false}
                    segments={10}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </MetricPanel>
  );
}
