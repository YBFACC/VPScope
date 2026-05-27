import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { EmptyState } from "@/components/empty/EmptyState";
import { TopToolbar } from "@/components/toolbar/TopToolbar";
import { HostSidebar } from "@/features/hosts/HostSidebar";
import { OverviewPage } from "@/features/overview/OverviewPage";
import { useI18n } from "@/i18n/useI18n";
import { runClient, tauriClient } from "@/lib/tauriClient";
import { alertHostIds, useAlertSettingsStore } from "@/stores/alertSettingsStore";
import { useHostStore, useSelectedHost } from "@/stores/hostStore";
import {
  useMetricsStore,
  useSelectedHistory,
  useSelectedMetricsError,
  useSelectedProcesses,
  useSelectedSnapshot,
} from "@/stores/metricsStore";
import { trayHostIds, useTraySettingsStore } from "@/stores/traySettingsStore";
import { type DashboardPanelId, useUiStore } from "@/stores/uiStore";
import { CpuPanel } from "./CpuPanel";
import { DiskPanel } from "./DiskPanel";
import { MemoryPanel } from "./MemoryPanel";
import { NetworkPanel } from "./NetworkPanel";
import { ProcessPanel } from "./ProcessPanel";

export function DashboardPage() {
  const [isWindowVisible, setIsWindowVisible] = useState(
    () => typeof document === "undefined" || document.visibilityState !== "hidden",
  );
  const loadHosts = useHostStore((state) => state.loadHosts);
  const isLoadingHosts = useHostStore((state) => state.isLoading);
  const hosts = useHostStore((state) => state.hosts);
  const selectedHost = useSelectedHost();
  const selectedHostId = useHostStore((state) => state.selectedHostId);
  const connection = useHostStore((state) => (selectedHostId ? state.connectionStates[selectedHostId] : undefined));
  const connectionStates = useHostStore((state) => state.connectionStates);
  const selectHost = useHostStore((state) => state.selectHost);
  const setConnectionState = useHostStore((state) => state.setConnectionState);
  const setHostsDisconnected = useHostStore((state) => state.setHostsDisconnected);
  const subscribeToHost = useMetricsStore((state) => state.subscribeToHost);
  const subscribeToHosts = useMetricsStore((state) => state.subscribeToHosts);
  const clearSubscription = useMetricsStore((state) => state.clearSubscription);
  const clearOverviewSubscriptions = useMetricsStore((state) => state.clearOverviewSubscriptions);
  const isSubscribing = useMetricsStore((state) => state.isSubscribing);
  const ingestMetricsError = useMetricsStore((state) => state.ingestMetricsError);
  const snapshots = useMetricsStore((state) => state.snapshots);
  const errorsByHost = useMetricsStore((state) => state.errorsByHost);
  const alertSettings = useAlertSettingsStore((state) => state.settings);
  const loadAlertSettings = useAlertSettingsStore((state) => state.load);
  const evaluateAlertSnapshot = useAlertSettingsStore((state) => state.evaluateSnapshot);
  const traySettings = useTraySettingsStore((state) => state.settings);
  const loadTraySettings = useTraySettingsStore((state) => state.load);
  const snapshot = useSelectedSnapshot(selectedHostId);
  const history = useSelectedHistory(selectedHostId);
  const processes = useSelectedProcesses(selectedHostId);
  const metricsError = useSelectedMetricsError(selectedHostId);
  const viewMode = useUiStore((state) => state.viewMode);
  const setViewMode = useUiStore((state) => state.setViewMode);
  const setSearch = useUiStore((state) => state.setSearch);
  const moveFocusedProcess = useUiStore((state) => state.moveFocusedProcess);
  const setProcessSort = useUiStore((state) => state.setProcessSort);
  const collapsedPanels = useUiStore((state) => state.collapsedPanels);
  const panelOrder = useUiStore((state) => state.panelOrder);
  const activeDashboardPanelId = useUiStore((state) => state.activeDashboardPanelId);
  const togglePanelCollapsed = useUiStore((state) => state.togglePanelCollapsed);
  const showAllPanels = useUiStore((state) => state.showAllPanels);
  const resetPanelOrder = useUiStore((state) => state.resetPanelOrder);
  const selectNextNetworkInterface = useUiStore((state) => state.selectNextNetworkInterface);
  const selectPrevNetworkInterface = useUiStore((state) => state.selectPrevNetworkInterface);
  const { t } = useI18n();
  const isOverview = viewMode === "overview";

  useEffect(() => {
    void loadHosts();
    void loadTraySettings();
    void loadAlertSettings();
  }, [loadAlertSettings, loadHosts, loadTraySettings]);

  useEffect(() => {
    for (const snapshot of Object.values(snapshots)) {
      if (snapshot) {
        void evaluateAlertSnapshot(snapshot, hosts);
      }
    }
  }, [evaluateAlertSnapshot, hosts, snapshots]);

  useEffect(() => {
    let stopListeningErrors: (() => void) | undefined;
    let stopListeningConnections: (() => void) | undefined;
    let disposed = false;

    void runClient(async () => {
      const [unlistenErrors, unlistenConnections] = await Promise.all([
        tauriClient.listenMetricsErrors(ingestMetricsError),
        tauriClient.listenHostConnectionStates((state) => {
          const { selectedHostId } = useHostStore.getState();
          const { viewMode } = useUiStore.getState();

          if (viewMode === "list" && state.hostId !== selectedHostId) {
            return;
          }

          setConnectionState(state);
        }),
      ]);

      if (disposed) {
        unlistenErrors();
        unlistenConnections();
        return;
      }

      stopListeningErrors = unlistenErrors;
      stopListeningConnections = unlistenConnections;
    });

    return () => {
      disposed = true;
      stopListeningErrors?.();
      stopListeningConnections?.();
    };
  }, [ingestMetricsError, setConnectionState]);

  useEffect(() => {
    function onVisibilityChange() {
      setIsWindowVisible(document.visibilityState !== "hidden");
    }

    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, []);

  useEffect(() => {
    const trayIds = trayHostIds(traySettings);
    const enabledAlertIds = alertHostIds(alertSettings);
    const hiddenHostIds = Array.from(new Set([...trayIds, ...enabledAlertIds]));
    const backgroundAlertIds = enabledAlertIds.filter((hostId) => hostId !== selectedHostId);

    if (!isWindowVisible) {
      void clearSubscription();
      void subscribeToHosts(hiddenHostIds, "tray");
      return () => {
        void clearOverviewSubscriptions();
      };
    }

    if (isOverview) {
      void clearSubscription();
      void subscribeToHosts(hosts.map((host) => host.id), "overview");
      return () => {
        void clearOverviewSubscriptions();
      };
    }

    if (!selectedHostId) {
      void clearSubscription();
      void subscribeToHosts(enabledAlertIds, "tray");
      setHostsDisconnected(hosts.map((host) => host.id));
      return;
    }

    void subscribeToHost(selectedHostId);
    void subscribeToHosts(backgroundAlertIds, "tray");
    setHostsDisconnected(
      hosts
        .map((host) => host.id)
        .filter((hostId) => hostId !== selectedHostId && !backgroundAlertIds.includes(hostId)),
    );

    return () => {
      void clearSubscription();
    };
  }, [
    alertSettings,
    clearOverviewSubscriptions,
    clearSubscription,
    hosts,
    selectedHostId,
    setHostsDisconnected,
    subscribeToHost,
    subscribeToHosts,
    traySettings,
    isOverview,
    isWindowVisible,
  ]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "/" && document.activeElement?.tagName !== "INPUT") {
        event.preventDefault();
        const input = document.querySelector<HTMLInputElement>('input[data-search="processes"]');
        input?.focus();
      }

      if (event.key === "ArrowDown") {
        moveFocusedProcess(1, processes.length);
      }

      if (event.key === "ArrowUp") {
        moveFocusedProcess(-1, processes.length);
      }

      if (event.key === "ArrowLeft" && activeDashboardPanelId === "network" && selectedHostId && snapshot?.network.length) {
        event.preventDefault();
        selectPrevNetworkInterface(
          selectedHostId,
          snapshot.network.map((iface) => iface.iface),
        );
      }

      if (event.key === "ArrowRight" && activeDashboardPanelId === "network" && selectedHostId && snapshot?.network.length) {
        event.preventDefault();
        selectNextNetworkInterface(
          selectedHostId,
          snapshot.network.map((iface) => iface.iface),
        );
      }

      if (event.key === "Escape") {
        setSearch("");
      }

      if (event.key.toLowerCase() === "r" && document.activeElement?.tagName !== "INPUT") {
        setProcessSort("cpu");
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    activeDashboardPanelId,
    moveFocusedProcess,
    processes.length,
    selectNextNetworkInterface,
    selectPrevNetworkInterface,
    selectedHostId,
    setProcessSort,
    setSearch,
    snapshot,
  ]);

  return (
    <main className="cockpit-surface h-screen overflow-hidden bg-[var(--color-bg)] p-2 text-[var(--color-text)] lg:p-3">
      <div className="grid h-full w-full grid-rows-[auto_minmax(0,1fr)] gap-2 lg:gap-3">
        <TopToolbar />

        <div
          className={
            isOverview
              ? "grid min-h-0 grid-cols-1 gap-2 lg:gap-3"
              : "grid min-h-0 grid-cols-1 gap-2 lg:grid-cols-[280px_minmax(0,1fr)] lg:gap-3 xl:grid-cols-[296px_minmax(0,1fr)]"
          }
        >
          {!isOverview ? <HostSidebar /> : null}

          <section className="min-h-0">
            {isLoadingHosts ? (
              <EmptyState title={t("connecting")} message={t("waitingForMetricsMessage")} />
            ) : hosts.length === 0 ? (
              <EmptyState title={t("noHosts")} message={t("noHostsMessage")} />
            ) : isOverview ? (
              <OverviewPage
                hosts={hosts}
                snapshots={snapshots}
                connectionStates={connectionStates}
                errorsByHost={errorsByHost}
                isSubscribing={isSubscribing}
                onOpenHost={(hostId) => {
                  selectHost(hostId);
                  setViewMode("list");
                }}
              />
            ) : !selectedHost || !snapshot ? (
              <EmptyState
                title={metricsError ? metricsError.code : isSubscribing ? t("connecting") : t("waitingForMetrics")}
                message={
                  metricsError?.message ??
                  connection?.message ??
                  t("waitingForMetricsMessage")
                }
              />
            ) : (
              <DashboardPanels
                snapshot={snapshot}
                history={history}
                processes={processes}
                collapsedPanels={collapsedPanels}
                panelOrder={panelOrder}
                onTogglePanel={togglePanelCollapsed}
                onShowAllPanels={showAllPanels}
                onResetPanelOrder={resetPanelOrder}
              />
            )}
          </section>
        </div>
      </div>
    </main>
  );
}

type PanelColumn = "left" | "right" | "full";

type DashboardPanelItem = {
  id: DashboardPanelId;
  title: string;
  accent: string;
  summary: string;
  column: PanelColumn;
  element: ReactNode;
};

type DashboardLayoutSection =
  | {
      id: string;
      kind: "columns";
      panels: DashboardPanelItem[];
    }
  | {
      id: string;
      kind: "full";
      panel: DashboardPanelItem;
    };

type DashboardPanelsProps = {
  snapshot: NonNullable<ReturnType<typeof useSelectedSnapshot>>;
  history: ReturnType<typeof useSelectedHistory>;
  processes: ReturnType<typeof useSelectedProcesses>;
  collapsedPanels: DashboardPanelId[];
  panelOrder: DashboardPanelId[];
  onTogglePanel: (panelId: DashboardPanelId) => void;
  onShowAllPanels: () => void;
  onResetPanelOrder: () => void;
};

function panelPercent(usedBytes: number, totalBytes: number) {
  return totalBytes > 0 ? Math.round((usedBytes / totalBytes) * 100) : 0;
}

function DashboardPanels({
  snapshot,
  history,
  processes,
  collapsedPanels,
  panelOrder,
  onTogglePanel,
  onShowAllPanels,
  onResetPanelOrder,
}: DashboardPanelsProps) {
  const { t } = useI18n();
  const memoryPercent = panelPercent(snapshot.memory.usedBytes, snapshot.memory.totalBytes);
  const worstDiskPercent = Math.max(
    0,
    ...snapshot.disks.map((disk) => panelPercent(disk.usedBytes, disk.totalBytes)),
    panelPercent(snapshot.memory.swapUsedBytes, snapshot.memory.swapTotalBytes),
  );
  const panelItems: DashboardPanelItem[] = [
    {
      id: "cpu",
      title: t("cpu"),
      accent: "var(--color-cpu)",
      summary: `${Math.round(snapshot.cpu.totalPercent)}%`,
      column: "left",
      element: <CpuPanel snapshot={snapshot} history={history?.cpu ?? []} />,
    },
    {
      id: "memory",
      title: t("memory"),
      accent: "var(--color-memory)",
      summary: `${memoryPercent}%`,
      column: "left",
      element: <MemoryPanel snapshot={snapshot} history={history?.memory ?? []} />,
    },
    {
      id: "network",
      title: t("network"),
      accent: "var(--color-network-rx)",
      summary: t("ifaces", { count: snapshot.network.length }),
      column: "right",
      element: <NetworkPanel snapshot={snapshot} networkByInterface={history?.networkByInterface ?? {}} />,
    },
    {
      id: "disk",
      title: t("disks"),
      accent: "var(--color-disk)",
      summary: `${worstDiskPercent}%`,
      column: "right",
      element: <DiskPanel snapshot={snapshot} />,
    },
    {
      id: "process",
      title: t("processes"),
      accent: "var(--color-danger)",
      summary: t("rows", { count: processes.length }),
      column: "full",
      element: <ProcessPanel processes={processes} />,
    },
  ];
  const hiddenPanelIds = new Set(collapsedPanels);
  const panelItemById = new Map(panelItems.map((panel) => [panel.id, panel]));
  const sortedPanels = panelOrder.map((panelId) => panelItemById.get(panelId)).filter((panel): panel is DashboardPanelItem => Boolean(panel));
  const hiddenPanels = sortedPanels.filter((panel) => hiddenPanelIds.has(panel.id));
  const visiblePanels = sortedPanels.filter((panel) => !hiddenPanelIds.has(panel.id));
  const layoutSections = toLayoutSections(visiblePanels);

  return (
    <div className="dashboard-workspace" data-has-hidden={hiddenPanels.length > 0}>
      {hiddenPanels.length > 0 ? (
        <div className="hidden-panels-bar">
          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
            <span className="font-mono text-[11px] uppercase text-[var(--color-text-muted)]">{t("hiddenPanels")}</span>
            {hiddenPanels.map((panel) => (
              <button
                key={panel.id}
                type="button"
                onClick={() => onTogglePanel(panel.id)}
                className="hidden-panel-chip"
                aria-label={`${t("expandPanel")}: ${panel.title}`}
                title={`${t("expandPanel")}: ${panel.title}`}
              >
                <span
                  className="h-1.5 w-1.5 shrink-0 rounded-full"
                  style={{ backgroundColor: panel.accent, boxShadow: `0 0 12px ${panel.accent}` }}
                />
                <span className="truncate text-[var(--color-text)]">{panel.title}</span>
                <span className="truncate text-[var(--color-text-muted)]">· {panel.summary}</span>
              </button>
            ))}
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <button type="button" onClick={onResetPanelOrder} className="control-button h-7 px-2">
              {t("resetPanelOrder")}
            </button>
            <button type="button" onClick={onShowAllPanels} className="control-button h-7 px-2">
              {t("showAllPanels")}
            </button>
          </div>
        </div>
      ) : null}

      {visiblePanels.length === 0 ? (
        <EmptyState
          title={t("hiddenPanels")}
          message={t("hiddenPanelsMessage")}
          action={
            <button type="button" onClick={onShowAllPanels} className="control-button">
              {t("showAllPanels")}
            </button>
          }
        />
      ) : (
        <div className="dashboard-grid">
          {layoutSections.map((section) => (
            section.kind === "full" ? (
              <PanelSlot key={section.id} variant="full">{section.panel.element}</PanelSlot>
            ) : (
              <DashboardMasonrySection key={section.id} panels={section.panels} />
            )
          ))}
        </div>
      )}
    </div>
  );
}

function toLayoutSections(visiblePanels: DashboardPanelItem[]) {
  const sections: DashboardLayoutSection[] = [];
  let columnPanels: DashboardPanelItem[] = [];

  for (const panel of visiblePanels) {
    if (panel.column === "full") {
      if (columnPanels.length > 0) {
        sections.push({ id: `columns-${sections.length}`, kind: "columns", panels: columnPanels });
        columnPanels = [];
      }

      sections.push({ id: panel.id, kind: "full", panel });
      continue;
    }

    columnPanels.push(panel);
  }

  if (columnPanels.length > 0) {
    sections.push({ id: `columns-${sections.length}`, kind: "columns", panels: columnPanels });
  }

  return sections;
}

function distributePanels(panels: DashboardPanelItem[]) {
  const columns: [DashboardPanelItem[], DashboardPanelItem[]] = [[], []];

  panels.forEach((panel) => {
    const targetColumn = columns[0].length <= columns[1].length ? columns[0] : columns[1];
    targetColumn.push(panel);
  });

  return columns;
}

function DashboardMasonrySection({ panels }: { panels: DashboardPanelItem[] }) {
  const [leftPanels, rightPanels] = distributePanels(panels);

  return (
    <div
      className="dashboard-masonry-columns"
      data-left-empty={leftPanels.length === 0}
      data-right-empty={rightPanels.length === 0}
    >
      {leftPanels.length > 0 ? (
        <div className="dashboard-column">
          {leftPanels.map((panel) => (
            <PanelSlot key={panel.id}>{panel.element}</PanelSlot>
          ))}
        </div>
      ) : null}
      {rightPanels.length > 0 ? (
        <div className="dashboard-column">
          {rightPanels.map((panel) => (
            <PanelSlot key={panel.id}>{panel.element}</PanelSlot>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function PanelSlot({ children, variant = "default" }: { children: ReactNode; variant?: "default" | "full" }) {
  return (
    <div className="dashboard-panel-slot min-h-0" data-variant={variant}>
      {children}
    </div>
  );
}
