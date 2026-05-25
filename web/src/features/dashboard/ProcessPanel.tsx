import { ProcessTable } from "@/components/table/ProcessTable";
import { MetricPanel } from "@/components/panel/MetricPanel";
import { useI18n } from "@/i18n/useI18n";
import { useUiStore } from "@/stores/uiStore";
import type { ProcessInfo } from "@/types/contracts";

type ProcessPanelProps = {
  processes: ProcessInfo[];
};

export function ProcessPanel({ processes }: ProcessPanelProps) {
  const { t } = useI18n();
  const search = useUiStore((state) => state.search);
  const setSearch = useUiStore((state) => state.setSearch);

  return (
    <MetricPanel
      title={t("processes")}
      accent="var(--color-danger)"
      status={t("rows", { count: processes.length })}
      actions={
        <input
          data-search="processes"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={t("filterProcesses")}
          className="h-7 w-48 rounded-[var(--radius-control)] border border-[var(--color-border)] bg-[var(--color-input)] px-2 font-mono text-xs text-[var(--color-text)] outline-none placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-border-strong)]"
        />
      }
      className="grid grid-rows-[auto_minmax(0,1fr)]"
    >
      <ProcessTable processes={processes} />
    </MetricPanel>
  );
}
