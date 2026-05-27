import { useEffect } from "react";
import { NetworkThroughputChart } from "@/components/chart/NetworkThroughputChart";
import { MetricPanel } from "@/components/panel/MetricPanel";
import { useI18n } from "@/i18n/useI18n";
import { formatBytes, formatRate } from "@/lib/format";
import type { HistoryPoint } from "@/lib/historyBuffer";
import type { NetworkInterfaceHistory } from "@/stores/metricsStore";
import { useUiStore } from "@/stores/uiStore";
import type { HostSnapshot } from "@/types/contracts";

type NetworkPanelProps = {
  snapshot: HostSnapshot;
  networkByInterface: Record<string, NetworkInterfaceHistory>;
};

type SnapshotNetworkInterface = HostSnapshot["network"][number];

const VIRTUAL_INTERFACE_PREFIXES = ["tailscale", "tun", "tap", "wg", "utun", "zt", "docker", "br-", "veth", "virbr", "vmnet"];

function isLoopbackInterface(iface: string) {
  return iface === "lo" || iface.startsWith("lo:");
}

function isDeprioritizedVirtualInterface(iface: string) {
  return VIRTUAL_INTERFACE_PREFIXES.some((prefix) => iface.startsWith(prefix));
}

function interfacePriority(iface: SnapshotNetworkInterface) {
  if (isLoopbackInterface(iface.iface)) {
    return 2;
  }

  if (isDeprioritizedVirtualInterface(iface.iface)) {
    return 1;
  }

  return 0;
}

function pickDefaultInterface(interfaces: SnapshotNetworkInterface[]) {
  if (interfaces.length === 0) {
    return undefined;
  }

  return [...interfaces]
    .sort((left, right) => {
      const priorityDelta = interfacePriority(left) - interfacePriority(right);

      if (priorityDelta !== 0) {
        return priorityDelta;
      }

      return right.rxBytesPerSec + right.txBytesPerSec - (left.rxBytesPerSec + left.txBytesPerSec);
    })[0]
    ?.iface;
}

function historyPeak(history: Array<HistoryPoint<number>>) {
  return history.reduce((peak, point) => Math.max(peak, point.value), 0);
}

function NavigationIcon({ direction }: { direction: "left" | "right" }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2">
      {direction === "left" ? <path d="m10 3-5 5 5 5" /> : <path d="m6 3 5 5-5 5" />}
    </svg>
  );
}

export function NetworkPanel({ snapshot, networkByInterface }: NetworkPanelProps) {
  const { t } = useI18n();
  const activeDashboardPanelId = useUiStore((state) => state.activeDashboardPanelId);
  const selectedNetworkInterface = useUiStore((state) => state.selectedNetworkInterfaces[snapshot.hostId]);
  const setActiveDashboardPanel = useUiStore((state) => state.setActiveDashboardPanel);
  const selectNetworkInterface = useUiStore((state) => state.selectNetworkInterface);
  const selectNextNetworkInterface = useUiStore((state) => state.selectNextNetworkInterface);
  const selectPrevNetworkInterface = useUiStore((state) => state.selectPrevNetworkInterface);
  const interfaces = snapshot.network;
  const interfaceNames = interfaces.map((iface) => iface.iface);
  const defaultInterface = pickDefaultInterface(interfaces);
  const resolvedInterfaceName =
    selectedNetworkInterface && interfaceNames.includes(selectedNetworkInterface)
      ? selectedNetworkInterface
      : defaultInterface;
  const currentInterface = interfaces.find((iface) => iface.iface === resolvedInterfaceName);
  const selectedHistory = currentInterface ? networkByInterface[currentInterface.iface] : undefined;
  const rxHistory = selectedHistory?.rx ?? [];
  const txHistory = selectedHistory?.tx ?? [];
  const rxValues = rxHistory.map((point) => point.value);
  const txValues = txHistory.map((point) => point.value);
  const currentMaxRate = Math.max(currentInterface?.rxBytesPerSec ?? 0, currentInterface?.txBytesPerSec ?? 0);
  const maxRate = Math.max(1, historyPeak(rxHistory), historyPeak(txHistory), currentMaxRate);
  const isActive = activeDashboardPanelId === "network";

  useEffect(() => {
    if (resolvedInterfaceName && resolvedInterfaceName !== selectedNetworkInterface) {
      selectNetworkInterface(snapshot.hostId, resolvedInterfaceName);
    }
  }, [resolvedInterfaceName, selectNetworkInterface, selectedNetworkInterface, snapshot.hostId]);

  const navigation = (
    <div className="flex items-center gap-1">
      <button
        type="button"
        className="host-icon-button"
        aria-label={`${t("previous")} ${t("iface")}`}
        title={`${t("previous")} ${t("iface")}`}
        disabled={interfaceNames.length <= 1}
        onClick={() => selectPrevNetworkInterface(snapshot.hostId, interfaceNames)}
      >
        <NavigationIcon direction="left" />
      </button>
      <button
        type="button"
        className="rounded-[var(--radius-control)] border border-[var(--color-border-subtle)] bg-[var(--color-input)] px-2 py-1 text-[10px] uppercase tracking-normal text-[var(--color-text)]"
        onClick={() => setActiveDashboardPanel("network")}
      >
        {resolvedInterfaceName ?? t("iface")}
      </button>
      <button
        type="button"
        className="host-icon-button"
        aria-label={`${t("next")} ${t("iface")}`}
        title={`${t("next")} ${t("iface")}`}
        disabled={interfaceNames.length <= 1}
        onClick={() => selectNextNetworkInterface(snapshot.hostId, interfaceNames)}
      >
        <NavigationIcon direction="right" />
      </button>
    </div>
  );

  return (
    <MetricPanel
      panelId="network"
      title={t("network")}
      accent="var(--color-network-rx)"
      status={
        <span className="truncate text-[10px] uppercase tracking-normal text-[var(--color-text-muted)]">
          {resolvedInterfaceName ?? t("ifaces", { count: snapshot.network.length })}
        </span>
      }
      actions={navigation}
      active={isActive}
      onActivate={() => setActiveDashboardPanel("network")}
      className={
        isActive
          ? "shadow-[inset_0_0_0_1px_var(--color-border-strong),var(--shadow-panel)]"
          : undefined
      }
    >
      {currentInterface ? (
        <div className="grid h-full min-h-0">
          <div className="grid min-h-0 gap-2 xl:grid-cols-[minmax(0,1.2fr)_208px]">
            <button
              type="button"
              onClick={() => setActiveDashboardPanel("network")}
              className="pixel-card grid min-h-0 overflow-hidden rounded-[var(--radius-control)] border border-[var(--color-border-subtle)] bg-[var(--color-panel-raised)] p-2 text-left"
            >
              <div className="mb-1 flex items-center justify-end gap-2 text-[10px] uppercase tracking-normal text-[var(--color-text-muted)]">
                <span className={isActive ? "text-[var(--color-accent)]" : undefined}>L/R</span>
              </div>
              <div className="grid min-h-0 grid-rows-[minmax(0,1fr)_auto] gap-1.5">
                <div className="min-h-0 overflow-hidden">
                  <NetworkThroughputChart
                    rxValues={rxValues}
                    txValues={txValues}
                    max={maxRate}
                    rxColor="var(--color-network-rx)"
                    txColor="var(--color-network-tx)"
                    height={112}
                  />
                </div>
                <div className="flex items-center justify-between gap-3 text-[10px] uppercase tracking-normal text-[var(--color-text-muted)]">
                  <span>{t("download")}</span>
                  <span>{t("upload")}</span>
                </div>
              </div>
            </button>

            <div className="grid gap-2 font-mono">
              <div className="pixel-card grid gap-2 p-2">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-[10px] uppercase tracking-normal text-[var(--color-text-muted)]">{t("download")}</span>
                  <span className="text-base text-[var(--color-network-rx)] tabular-nums">{formatRate(currentInterface.rxBytesPerSec)}</span>
                </div>
                <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[11px]">
                  <span className="text-[var(--color-text-muted)]">{t("peak")}</span>
                  <span className="text-right text-[var(--color-text)] tabular-nums">{formatRate(historyPeak(rxHistory))}</span>
                  <span className="text-[var(--color-text-muted)]">{t("total")}</span>
                  <span className="text-right text-[var(--color-text)] tabular-nums">{formatBytes(currentInterface.rxTotalBytes)}</span>
                </div>
              </div>

              <div className="pixel-card grid gap-2 p-2">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-[10px] uppercase tracking-normal text-[var(--color-text-muted)]">{t("upload")}</span>
                  <span className="text-base text-[var(--color-network-tx)] tabular-nums">{formatRate(currentInterface.txBytesPerSec)}</span>
                </div>
                <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[11px]">
                  <span className="text-[var(--color-text-muted)]">{t("peak")}</span>
                  <span className="text-right text-[var(--color-text)] tabular-nums">{formatRate(historyPeak(txHistory))}</span>
                  <span className="text-[var(--color-text-muted)]">{t("total")}</span>
                  <span className="text-right text-[var(--color-text)] tabular-nums">{formatBytes(currentInterface.txTotalBytes)}</span>
                </div>
              </div>

              <div className="pixel-card flex items-center justify-between gap-3 p-2 text-[11px]">
                <span className="text-[var(--color-text-muted)]">{t("trafficSplit")}</span>
                <span className="text-[var(--color-accent)] tabular-nums">
                  {formatRate(currentInterface.rxBytesPerSec + currentInterface.txBytesPerSec)}
                </span>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="pixel-card flex h-full items-center justify-center p-3 text-[11px] text-[var(--color-text-muted)]">
          {t("waitingForMetricsMessage")}
        </div>
      )}
    </MetricPanel>
  );
}
