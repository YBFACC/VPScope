import { useEffect, useRef, useState } from "react";
import { ProcessTable } from "@/components/table/ProcessTable";
import { MetricPanel } from "@/components/panel/MetricPanel";
import { useI18n } from "@/i18n/useI18n";
import { processTableRefreshOptionsMs, type ProcessTableRefreshMs, useUiStore } from "@/stores/uiStore";
import type { ProcessInfo } from "@/types/contracts";

type ProcessPanelProps = {
  processes: ProcessInfo[];
};

const refreshLabelKeys: Record<ProcessTableRefreshMs, "processRefresh2s" | "processRefresh5s" | "processRefresh10s" | "processRefresh30s"> = {
  2_000: "processRefresh2s",
  5_000: "processRefresh5s",
  10_000: "processRefresh10s",
  30_000: "processRefresh30s",
};

export function ProcessPanel({ processes }: ProcessPanelProps) {
  const { t } = useI18n();
  const search = useUiStore((state) => state.search);
  const sortBy = useUiStore((state) => state.processSortBy);
  const sortDirection = useUiStore((state) => state.processSortDirection);
  const processTableRefreshMs = useUiStore((state) => state.processTableRefreshMs);
  const setSearch = useUiStore((state) => state.setSearch);
  const setProcessTableRefreshMs = useUiStore((state) => state.setProcessTableRefreshMs);
  const latestProcessesRef = useRef(processes);
  const [sampledProcesses, setSampledProcesses] = useState(processes);

  useEffect(() => {
    latestProcessesRef.current = processes;
  }, [processes]);

  useEffect(() => {
    setSampledProcesses(latestProcessesRef.current);
    const intervalId = window.setInterval(() => {
      setSampledProcesses(latestProcessesRef.current);
    }, processTableRefreshMs);

    return () => window.clearInterval(intervalId);
  }, [processTableRefreshMs]);

  useEffect(() => {
    setSampledProcesses(latestProcessesRef.current);
  }, [search, sortBy, sortDirection]);

  return (
    <MetricPanel
      panelId="process"
      title={t("processes")}
      accent="var(--color-danger)"
      status={t("rows", { count: sampledProcesses.length })}
      collapsed={false}
      actions={
        <>
          <label className="process-refresh-control" title={t("processRefresh")}>
            <span className="sr-only">{t("processRefresh")}</span>
            <select
              value={processTableRefreshMs}
              onChange={(event) => setProcessTableRefreshMs(Number(event.target.value) as ProcessTableRefreshMs)}
              aria-label={t("processRefresh")}
              className="process-refresh-select"
            >
              {processTableRefreshOptionsMs.map((refreshMs) => (
                <option key={refreshMs} value={refreshMs}>
                  {t(refreshLabelKeys[refreshMs])}
                </option>
              ))}
            </select>
          </label>
          <input
            data-search="processes"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t("filterProcesses")}
            className="h-5 w-48 border border-[var(--color-border-subtle)] bg-[var(--color-input)] px-2 font-mono text-[11px] uppercase text-[var(--color-text)] outline-none placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-border-strong)]"
          />
        </>
      }
      className="grid grid-rows-[auto_minmax(0,1fr)]"
    >
      <ProcessTable processes={sampledProcesses} />
    </MetricPanel>
  );
}
