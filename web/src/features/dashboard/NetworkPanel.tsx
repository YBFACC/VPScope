import { useEffect } from "react";
import { DotMatrixChart } from "@/components/chart/DotMatrixChart";
import { MetricPanel } from "@/components/panel/MetricPanel";
import { PIXEL_DENSITY } from "@/components/pixelDensity";
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
      collapsed={false}
      onActivate={() => setActiveDashboardPanel("network")}
    >
      {currentInterface ? (
        <div className="btop-network-grid">
            <button
              type="button"
              onClick={() => setActiveDashboardPanel("network")}
              className="btop-network-chart"
            >
              <div className="mb-1 flex items-center justify-end gap-2 text-[11px] uppercase tracking-normal text-[var(--color-text-muted)]">
                <span className={isActive ? "text-[var(--color-accent)]" : undefined}>L/R</span>
              </div>
              <div className="grid min-h-0 grid-rows-[minmax(0,1fr)_auto] gap-1.5">
                <div className="btop-network-dot-field">
                  <DotMatrixChart
                    values={rxValues}
                    max={maxRate}
                    rows={8}
                    minColumns={PIXEL_DENSITY.networkChart.minColumns}
                    maxColumns={PIXEL_DENSITY.networkChart.maxColumns}
                    color="var(--color-network-rx)"
                    toneScale="networkRx"
                  />
                  <DotMatrixChart
                    values={txValues}
                    max={maxRate}
                    rows={8}
                    minColumns={PIXEL_DENSITY.networkChart.minColumns}
                    maxColumns={PIXEL_DENSITY.networkChart.maxColumns}
                    color="var(--color-network-tx)"
                    invert
                    toneScale="networkTx"
                  />
                </div>
                <div className="flex items-center justify-between gap-3 text-[10px] uppercase tracking-normal text-[var(--color-text-muted)]">
                  <span>{t("download")}</span>
                  <span>{t("upload")}</span>
                </div>
              </div>
            </button>

            <div className="btop-network-stats">
              <div className="btop-rate-box">
                <div className="flex items-baseline justify-between gap-3">
                  <span>{t("download")}</span>
                  <strong className="text-[var(--color-network-rx)]">{formatRate(currentInterface.rxBytesPerSec)}</strong>
                </div>
                <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
                  <span className="text-[var(--color-text-muted)]">{t("peak")}</span>
                  <span className="text-right text-[var(--color-text)] tabular-nums">{formatRate(historyPeak(rxHistory))}</span>
                  <span className="text-[var(--color-text-muted)]">{t("total")}</span>
                  <span className="text-right text-[var(--color-text)] tabular-nums">{formatBytes(currentInterface.rxTotalBytes)}</span>
                </div>
              </div>

              <div className="btop-rate-box">
                <div className="flex items-baseline justify-between gap-3">
                  <span>{t("upload")}</span>
                  <strong className="text-[var(--color-network-tx)]">{formatRate(currentInterface.txBytesPerSec)}</strong>
                </div>
                <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
                  <span className="text-[var(--color-text-muted)]">{t("peak")}</span>
                  <span className="text-right text-[var(--color-text)] tabular-nums">{formatRate(historyPeak(txHistory))}</span>
                  <span className="text-[var(--color-text-muted)]">{t("total")}</span>
                  <span className="text-right text-[var(--color-text)] tabular-nums">{formatBytes(currentInterface.txTotalBytes)}</span>
                </div>
              </div>
              <div className="btop-rate-box flex items-center justify-between gap-3">
                <span className="text-[var(--color-text-muted)]">{t("trafficSplit")}</span>
                <span className="text-[var(--color-accent)] tabular-nums">
                  {formatRate(currentInterface.rxBytesPerSec + currentInterface.txBytesPerSec)}
                </span>
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
