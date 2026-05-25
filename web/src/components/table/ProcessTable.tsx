import { useVirtualizer } from "@tanstack/react-virtual";
import { useMemo, useRef } from "react";
import clsx from "clsx";
import { useI18n } from "@/i18n/useI18n";
import { formatBytes, formatPercent } from "@/lib/format";
import { useUiStore } from "@/stores/uiStore";
import type { ProcessInfo } from "@/types/contracts";

type ProcessTableProps = {
  processes: ProcessInfo[];
};

const columns = [
  { key: "pid", labelKey: "pid", className: "" },
  { key: "name", labelKey: "processName", className: "" },
  { key: "user", labelKey: "user", className: "" },
  { key: "cpu", labelKey: "cpu", className: "text-right" },
  { key: "memory", labelKey: "mem", className: "text-right" },
  { key: "command", labelKey: "command", className: "" },
] as const;

export function ProcessTable({ processes }: ProcessTableProps) {
  const parentRef = useRef<HTMLDivElement | null>(null);
  const { t } = useI18n();
  const search = useUiStore((state) => state.search);
  const sortBy = useUiStore((state) => state.processSortBy);
  const sortDirection = useUiStore((state) => state.processSortDirection);
  const focusedProcessIndex = useUiStore((state) => state.focusedProcessIndex);
  const setProcessSort = useUiStore((state) => state.setProcessSort);

  const rows = useMemo(() => {
    const filter = search.trim().toLowerCase();
    const filtered = filter
      ? processes.filter((process) =>
          [process.pid.toString(), process.name, process.user, process.command].some((value) =>
            value.toLowerCase().includes(filter),
          ),
        )
      : processes;

    return [...filtered].sort((a, b) => {
      const direction = sortDirection === "asc" ? 1 : -1;

      if (sortBy === "cpu") {
        return (a.cpuPercent - b.cpuPercent) * direction;
      }

      if (sortBy === "memory") {
        return (a.memoryBytes - b.memoryBytes) * direction;
      }

      if (sortBy === "pid") {
        return (a.pid - b.pid) * direction;
      }

      return a.name.localeCompare(b.name) * direction;
    });
  }, [processes, search, sortBy, sortDirection]);

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 30,
    overscan: 8,
  });

  return (
    <div className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] overflow-hidden rounded-[var(--radius-control)] border border-[var(--color-border)]">
      <div className="grid grid-cols-[64px_minmax(90px,0.7fr)_minmax(76px,0.55fr)_78px_92px_minmax(160px,1.8fr)] bg-[var(--color-panel-muted)] font-mono text-[11px] text-[var(--color-text-muted)]">
        {columns.map((column) => (
          <button
            key={column.key}
            type="button"
            onClick={() => {
              if (column.key === "command" || column.key === "user") {
                return;
              }
              setProcessSort(column.key === "memory" ? "memory" : column.key === "cpu" ? "cpu" : column.key === "pid" ? "pid" : "name");
            }}
            className={clsx("min-w-0 truncate px-2 py-1.5 text-left", column.className)}
          >
            {t(column.labelKey)}
            {sortBy === column.key ? <span className="ml-1 text-[var(--color-accent)]">{sortDirection === "asc" ? "^" : "v"}</span> : null}
          </button>
        ))}
      </div>
      <div ref={parentRef} className="scrollbar-none min-h-0 overflow-auto">
        <div className="relative min-w-0" style={{ height: `${virtualizer.getTotalSize()}px` }}>
          {virtualizer.getVirtualItems().map((virtualRow) => {
            const process = rows[virtualRow.index];
            const active = virtualRow.index === focusedProcessIndex;

            return (
              <div
                key={process.pid}
                className="absolute left-0 grid w-full grid-cols-[64px_minmax(90px,0.7fr)_minmax(76px,0.55fr)_78px_92px_minmax(160px,1.8fr)] border-t border-[var(--color-border)] font-mono text-[11px] text-[var(--color-text)] data-[active=true]:bg-[var(--color-row-hover)]"
                data-active={active}
                style={{ height: `${virtualRow.size}px`, transform: `translateY(${virtualRow.start}px)` }}
              >
                <div className="truncate px-2 py-1.5 text-[var(--color-text-muted)]">{process.pid}</div>
                <div className="truncate px-2 py-1.5 text-[var(--color-cpu)]">{process.name}</div>
                <div className="truncate px-2 py-1.5">{process.user}</div>
                <div className="truncate px-2 py-1.5 text-right tabular-nums">{formatPercent(process.cpuPercent)}</div>
                <div className="truncate px-2 py-1.5 text-right tabular-nums">{formatBytes(process.memoryBytes)}</div>
                <div className="truncate px-2 py-1.5 text-[var(--color-text-muted)]">{process.command}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
