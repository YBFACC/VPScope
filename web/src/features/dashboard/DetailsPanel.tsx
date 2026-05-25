import { MetricPanel } from "@/components/panel/MetricPanel";
import { useI18n } from "@/i18n/useI18n";
import { formatDateTime, formatDuration } from "@/lib/format";
import type { HostConfig, HostConnectionState, HostSnapshot } from "@/types/contracts";

type DetailsPanelProps = {
  host: HostConfig;
  snapshot: HostSnapshot;
  connection?: HostConnectionState;
};

export function DetailsPanel({ host, snapshot, connection }: DetailsPanelProps) {
  const { t } = useI18n();
  const connectionStatus =
    connection?.status === "connected"
      ? t("streamingMetrics")
      : connection?.status === "connecting"
        ? t("connecting")
        : connection?.status === "error"
          ? t("error")
          : connection?.status === "disconnected"
            ? t("idle")
            : undefined;
  const details = [
    [t("host"), snapshot.system.hostname],
    [t("address"), `${host.address}:${host.port}`],
    [t("os"), snapshot.system.os],
    [t("kernel"), snapshot.system.kernel ?? "unknown"],
    [t("arch"), snapshot.system.arch ?? "unknown"],
    [t("uptime"), formatDuration(snapshot.system.uptimeSec)],
    [t("load"), snapshot.system.loadAvg.map((value) => value.toFixed(2)).join(" / ")],
    [t("auth"), host.auth.type],
    [t("last"), formatDateTime(snapshot.ts)],
  ];

  return (
    <MetricPanel title={t("details")} accent="var(--color-accent)" status={connectionStatus}>
      <dl className="grid grid-cols-2 gap-x-3 gap-y-2 font-mono text-xs xl:grid-cols-3">
        {details.map(([label, value]) => (
          <div key={label} className="min-w-0">
            <dt className="text-[var(--color-text-muted)]">{label}</dt>
            <dd className="truncate tabular-nums text-[var(--color-text)]">{value}</dd>
          </div>
        ))}
      </dl>
      {connection?.lastError ? (
        <div className="mt-3 rounded-[var(--radius-control)] border border-[var(--color-danger)] bg-[var(--color-input)] p-2 font-mono text-xs text-[var(--color-danger)]">
          {connection.lastError.code}: {connection.lastError.message}
        </div>
      ) : null}
    </MetricPanel>
  );
}
