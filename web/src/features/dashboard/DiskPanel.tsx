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

function DiskUsageBar({ value, color }: { value: number; color: string }) {
  const clamped = Math.max(0, Math.min(100, value));

  return (
    <div className="h-2.5 min-w-0 overflow-hidden rounded-[var(--radius-control)] bg-[var(--color-bar-track)]">
      <div className="h-full rounded-[var(--radius-control)] transition-[width] duration-300" style={{ width: `${clamped}%`, backgroundColor: color }} />
    </div>
  );
}

function DiskUsageRow({
  label,
  value,
  bytes,
  color,
}: {
  label: string;
  value: number;
  bytes: number;
  color: string;
}) {
  return (
    <div className="grid min-w-0 grid-cols-[58px_48px_minmax(0,1fr)_76px] items-center gap-2 font-mono text-[11px] leading-none">
      <span className="text-[var(--color-text-muted)]">{label}</span>
      <span className="text-right tabular-nums text-[var(--color-text)]">{formatPercent(value)}</span>
      <DiskUsageBar value={value} color={color} />
      <span className="truncate text-right tabular-nums text-[var(--color-text-muted)]">{formatBytes(bytes)}</span>
    </div>
  );
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

  return (
    <MetricPanel title={t("disks")} accent="var(--color-disk)" status={t("mounts", { count: diskItems.length })}>
      <div className="scrollbar-none grid h-full min-h-0 content-start gap-2 overflow-auto pr-1">
        {diskItems.map((disk) => {
          const usedPercent = percent(disk.usedBytes, disk.totalBytes);
          const freePercent = Math.max(0, 100 - usedPercent);
          const freeBytes = Math.max(0, disk.totalBytes - disk.usedBytes);

          return (
            <div key={disk.id} className="grid min-w-0 gap-1.5 border-b border-[var(--color-border)]/70 pb-2 last:border-b-0 last:pb-0">
              <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-end gap-2 font-mono">
                <span className="truncate text-sm font-semibold leading-none text-[var(--color-text)]" title={disk.label}>
                  {disk.label}
                </span>
                <span className="tabular-nums leading-none text-[var(--color-text)]">{formatBytes(disk.totalBytes)}</span>
              </div>
              <DiskUsageRow label={t("used")} value={usedPercent} bytes={disk.usedBytes} color={disk.isSwap ? "var(--color-warning)" : "var(--color-disk)"} />
              <DiskUsageRow label={t("free")} value={freePercent} bytes={freeBytes} color="var(--color-cpu)" />
              <div className="grid min-w-0 grid-cols-[58px_minmax(0,1fr)] items-center gap-2 font-mono text-[11px] leading-none text-[var(--color-text-muted)]">
                <span className="truncate">{disk.detail}</span>
                <span className="truncate">
                  {disk.isSwap
                    ? `${formatBytes(disk.usedBytes)} / ${formatBytes(disk.totalBytes)}`
                    : `r ${formatRate(disk.readBytesPerSec ?? 0)} · w ${formatRate(disk.writeBytesPerSec ?? 0)}`}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </MetricPanel>
  );
}
