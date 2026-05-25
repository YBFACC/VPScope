import { useEffect, useState } from "react";
import { EmptyState } from "@/components/empty/EmptyState";
import { TopToolbar } from "@/components/toolbar/TopToolbar";
import { HostSidebar } from "@/features/hosts/HostSidebar";
import { OverviewPage } from "@/features/overview/OverviewPage";
import { useI18n } from "@/i18n/useI18n";
import { runClient, tauriClient } from "@/lib/tauriClient";
import { useHostStore, useSelectedHost } from "@/stores/hostStore";
import {
  useMetricsStore,
  useSelectedHistory,
  useSelectedMetricsError,
  useSelectedSnapshot,
} from "@/stores/metricsStore";
import { trayHostIds, useTraySettingsStore } from "@/stores/traySettingsStore";
import { useUiStore } from "@/stores/uiStore";
import { CpuPanel } from "./CpuPanel";
import { DetailsPanel } from "./DetailsPanel";
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
  const subscribeToHost = useMetricsStore((state) => state.subscribeToHost);
  const subscribeToHosts = useMetricsStore((state) => state.subscribeToHosts);
  const clearSubscription = useMetricsStore((state) => state.clearSubscription);
  const clearOverviewSubscriptions = useMetricsStore((state) => state.clearOverviewSubscriptions);
  const isSubscribing = useMetricsStore((state) => state.isSubscribing);
  const ingestMetricsError = useMetricsStore((state) => state.ingestMetricsError);
  const snapshots = useMetricsStore((state) => state.snapshots);
  const errorsByHost = useMetricsStore((state) => state.errorsByHost);
  const traySettings = useTraySettingsStore((state) => state.settings);
  const loadTraySettings = useTraySettingsStore((state) => state.load);
  const snapshot = useSelectedSnapshot(selectedHostId);
  const history = useSelectedHistory(selectedHostId);
  const metricsError = useSelectedMetricsError(selectedHostId);
  const viewMode = useUiStore((state) => state.viewMode);
  const setViewMode = useUiStore((state) => state.setViewMode);
  const setSearch = useUiStore((state) => state.setSearch);
  const moveFocusedProcess = useUiStore((state) => state.moveFocusedProcess);
  const setProcessSort = useUiStore((state) => state.setProcessSort);
  const { t } = useI18n();
  const isOverview = viewMode === "overview";

  useEffect(() => {
    void loadHosts();
    void loadTraySettings();
  }, [loadHosts, loadTraySettings]);

  useEffect(() => {
    let stopListeningErrors: (() => void) | undefined;
    let stopListeningConnections: (() => void) | undefined;
    let disposed = false;

    void runClient(async () => {
      const [unlistenErrors, unlistenConnections] = await Promise.all([
        tauriClient.listenMetricsErrors(ingestMetricsError),
        tauriClient.listenHostConnectionStates(setConnectionState),
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

    if (!isWindowVisible) {
      void clearSubscription();
      void subscribeToHosts(trayIds, "tray");
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

    void clearOverviewSubscriptions();

    if (!selectedHostId) {
      void clearSubscription();
      void subscribeToHosts(trayIds, "tray");
      return;
    }

    void subscribeToHost(selectedHostId);
    void subscribeToHosts(trayIds.filter((hostId) => hostId !== selectedHostId), "tray");

    return () => {
      void clearSubscription();
    };
  }, [
    clearOverviewSubscriptions,
    clearSubscription,
    hosts,
    selectedHostId,
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
        moveFocusedProcess(1, snapshot?.processes.length ?? 0);
      }

      if (event.key === "ArrowUp") {
        moveFocusedProcess(-1, snapshot?.processes.length ?? 0);
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
  }, [moveFocusedProcess, setProcessSort, setSearch, snapshot?.processes.length]);

  return (
    <main className="h-screen overflow-hidden bg-[var(--color-bg)] p-2 text-[var(--color-text)] lg:p-3">
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
              <div className="dashboard-grid">
                <CpuPanel snapshot={snapshot} history={history?.cpu ?? []} />
                <MemoryPanel snapshot={snapshot} history={history?.memory ?? []} />
                <NetworkPanel snapshot={snapshot} rxHistory={history?.rx ?? []} txHistory={history?.tx ?? []} />
                <DiskPanel snapshot={snapshot} />
                <DetailsPanel host={selectedHost} snapshot={snapshot} connection={connection} />
                <ProcessPanel processes={snapshot.processes} />
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
