import type { HostConnectionState } from "@/types/contracts";
import { useI18n } from "@/i18n/useI18n";

type HostConnectionBadgeProps = {
  state?: HostConnectionState;
};

const colors = {
  disconnected: "var(--color-text-muted)",
  connecting: "var(--color-warning)",
  connected: "var(--color-cpu)",
  error: "var(--color-danger)",
};

export function HostConnectionBadge({ state }: HostConnectionBadgeProps) {
  const status = state?.status ?? "disconnected";
  const { t } = useI18n();
  const labels = {
    disconnected: t("idle"),
    connecting: t("connecting"),
    connected: t("online"),
    error: t("error"),
  };

  return (
    <span
      className="inline-flex min-w-0 max-w-16 items-center gap-1.5 overflow-hidden font-mono text-[11px] uppercase tracking-normal"
      style={{ color: colors[status] }}
    >
      <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: colors[status] }} />
      <span className="min-w-0 truncate">{labels[status]}</span>
    </span>
  );
}
