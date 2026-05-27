import { useVirtualizer } from "@tanstack/react-virtual";
import { useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import { useI18n } from "@/i18n/useI18n";
import { formatBytes, formatPercent } from "@/lib/format";
import { useUiStore } from "@/stores/uiStore";
import type { ProcessInfo } from "@/types/contracts";

type ProcessTableProps = {
  processes: ProcessInfo[];
};

const columns = [
  { key: "pid", labelKey: "pid", className: "text-right" },
  { key: "name", labelKey: "processName", className: "" },
  { key: "command", labelKey: "command", className: "" },
  { key: "user", labelKey: "user", className: "" },
  { key: "memory", labelKey: "mem", className: "text-right" },
  { key: "cpu", labelKey: "cpu", className: "text-right" },
] as const;

type RenderedProcessRow = {
  process: ProcessInfo;
  state: "active" | "entering" | "exiting";
};

const ROW_EXIT_MS = 260;

function compareProcesses(
  a: ProcessInfo,
  b: ProcessInfo,
  sortBy: "cpu" | "memory" | "pid" | "name",
  sortDirection: "asc" | "desc",
) {
  const direction = sortDirection === "asc" ? 1 : -1;
  const byPid = a.pid - b.pid;

  if (sortBy === "cpu") {
    return (a.cpuPercent - b.cpuPercent || byPid) * direction;
  }

  if (sortBy === "memory") {
    return (a.memoryBytes - b.memoryBytes || byPid) * direction;
  }

  if (sortBy === "pid") {
    return byPid * direction;
  }

  return (a.name.localeCompare(b.name) || byPid) * direction;
}

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

    return [...filtered].sort((a, b) => compareProcesses(a, b, sortBy, sortDirection));
  }, [processes, search, sortBy, sortDirection]);

  const [renderedRows, setRenderedRows] = useState<RenderedProcessRow[]>(() =>
    rows.map((process) => ({ process, state: "active" })),
  );

  useEffect(() => {
    setRenderedRows((previousRows) => {
      const previousByPid = new Map(previousRows.map((row) => [row.process.pid, row]));
      const nextPidSet = new Set(rows.map((process) => process.pid));
      const nextRows: RenderedProcessRow[] = rows.map((process) => {
        const previous = previousByPid.get(process.pid);
        return {
          process,
          state: previous && previous.state !== "exiting" ? "active" : "entering",
        } satisfies RenderedProcessRow;
      });

      for (const [previousIndex, previous] of previousRows.entries()) {
        if (!nextPidSet.has(previous.process.pid) && previous.state !== "exiting") {
          nextRows.splice(Math.min(previousIndex, nextRows.length), 0, {
            ...previous,
            state: "exiting",
          });
        }
      }

      return nextRows;
    });
  }, [rows]);

  useEffect(() => {
    if (!renderedRows.some((row) => row.state === "exiting")) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setRenderedRows((currentRows) => currentRows.filter((row) => row.state !== "exiting"));
    }, ROW_EXIT_MS);

    return () => window.clearTimeout(timeoutId);
  }, [renderedRows]);

  const virtualizer = useVirtualizer({
    count: renderedRows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 28,
    overscan: 8,
  });

  return (
    <div className="btop-process-table">
      <div className="btop-process-head">
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
            className={clsx("min-w-0 truncate px-1.5 py-0.5 text-left hover:text-[var(--color-accent)]", column.className)}
          >
            {t(column.labelKey)}
            {sortBy === column.key ? <span className="ml-1 text-[var(--color-accent)]">{sortDirection === "asc" ? "^" : "v"}</span> : null}
          </button>
        ))}
      </div>
      <div className="btop-process-scroll-shell">
        <div ref={parentRef} className="scrollbar-none btop-process-scroll min-h-0 overflow-auto">
          <div className="relative min-w-0" style={{ height: `${virtualizer.getTotalSize()}px` }}>
            {virtualizer.getVirtualItems().map((virtualRow) => {
              const row = renderedRows[virtualRow.index];
              const process = row.process;
              const active = virtualRow.index === focusedProcessIndex;

              return (
                <div
                  key={process.pid}
                  className="btop-process-row"
                  data-active={active}
                  data-state={row.state}
                  style={{ height: `${virtualRow.size}px`, transform: `translateY(${virtualRow.start}px)` }}
                >
                  <div className="truncate px-1.5 py-0.5 text-right text-[var(--color-text-muted)]">{process.pid}</div>
                  <div className="truncate px-1.5 py-0.5 text-[var(--color-cpu)]">{process.name}</div>
                  <div className="truncate px-1.5 py-0.5 text-[var(--color-text-muted)]">{process.command}</div>
                  <div className="truncate px-1.5 py-0.5">{process.user}</div>
                  <div className="truncate px-1.5 py-0.5 text-right text-[var(--color-memory)] tabular-nums">{formatBytes(process.memoryBytes)}</div>
                  <div className="truncate px-1.5 py-0.5 text-right text-[var(--color-cpu)] tabular-nums">{formatPercent(process.cpuPercent)}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
