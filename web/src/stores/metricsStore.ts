import { create } from "zustand";
import { pushHistory, type HistoryPoint } from "@/lib/historyBuffer";
import { runClient, tauriClient } from "@/lib/tauriClient";
import type { AppError, HostId, HostSnapshot, MetricsErrorEvent } from "@/types/contracts";

type MetricHistory = {
  cpu: Array<HistoryPoint<number>>;
  memory: Array<HistoryPoint<number>>;
  rx: Array<HistoryPoint<number>>;
  tx: Array<HistoryPoint<number>>;
};

type MetricsStore = {
  snapshots: Record<HostId, HostSnapshot | undefined>;
  histories: Record<HostId, MetricHistory | undefined>;
  activeHostId?: HostId;
  overviewUnsubscribes: Record<HostId, (() => Promise<void>) | undefined>;
  isSubscribing: boolean;
  error?: AppError;
  errorsByHost: Record<HostId, AppError | undefined>;
  unsubscribe?: () => Promise<void>;
  subscribeToHost: (hostId: HostId) => Promise<void>;
  subscribeToHosts: (hostIds: HostId[]) => Promise<void>;
  clearSubscription: () => Promise<void>;
  clearOverviewSubscriptions: () => Promise<void>;
  ingestSnapshot: (snapshot: HostSnapshot) => void;
  ingestMetricsError: (event: MetricsErrorEvent) => void;
  removeHostData: (hostId: HostId) => Promise<void>;
};

const HISTORY_LIMIT = 120;

const emptyHistory = (): MetricHistory => ({
  cpu: [],
  memory: [],
  rx: [],
  tx: [],
});

function nextHistory(previous: MetricHistory | undefined, snapshot: HostSnapshot) {
  const history = previous ?? emptyHistory();
  const memoryPercent = (snapshot.memory.usedBytes / snapshot.memory.totalBytes) * 100;
  const network = snapshot.network[0];

  return {
    cpu: pushHistory(history.cpu, { ts: snapshot.ts, value: snapshot.cpu.totalPercent }, HISTORY_LIMIT),
    memory: pushHistory(history.memory, { ts: snapshot.ts, value: memoryPercent }, HISTORY_LIMIT),
    rx: pushHistory(history.rx, { ts: snapshot.ts, value: network?.rxBytesPerSec ?? 0 }, HISTORY_LIMIT),
    tx: pushHistory(history.tx, { ts: snapshot.ts, value: network?.txBytesPerSec ?? 0 }, HISTORY_LIMIT),
  };
}

export const useMetricsStore = create<MetricsStore>((set, get) => ({
  snapshots: {},
  histories: {},
  errorsByHost: {},
  overviewUnsubscribes: {},
  isSubscribing: false,
  async subscribeToHost(hostId) {
    const current = get();

    if (current.activeHostId === hostId && current.unsubscribe) {
      return;
    }

    await current.unsubscribe?.();
    set({ activeHostId: hostId, unsubscribe: undefined, isSubscribing: true, error: undefined });

    try {
      const unsubscribe = await runClient(() => tauriClient.subscribeMetrics(hostId, get().ingestSnapshot));
      set({ unsubscribe, isSubscribing: false });
    } catch (error) {
      set({ error: error as AppError, isSubscribing: false });
    }
  },
  async subscribeToHosts(hostIds) {
    const uniqueHostIds = Array.from(new Set(hostIds));
    const current = get();
    const wanted = new Set(uniqueHostIds);

    await Promise.all(
      Object.entries(current.overviewUnsubscribes)
        .filter(([hostId]) => !wanted.has(hostId))
        .map(async ([hostId, unsubscribe]) => {
          await unsubscribe?.();
          set((state) => {
            const { [hostId]: _deleted, ...overviewUnsubscribes } = state.overviewUnsubscribes;
            return { overviewUnsubscribes };
          });
        }),
    );

    const missingHostIds = uniqueHostIds.filter((hostId) => !get().overviewUnsubscribes[hostId]);

    if (missingHostIds.length === 0) {
      return;
    }

    set({ isSubscribing: true, error: undefined });

    await Promise.all(
      missingHostIds.map(async (hostId) => {
        try {
          const unsubscribe = await runClient(() => tauriClient.subscribeMetrics(hostId, get().ingestSnapshot));
          set((state) => ({
            overviewUnsubscribes: {
              ...state.overviewUnsubscribes,
              [hostId]: unsubscribe,
            },
          }));
        } catch (error) {
          set((state) => ({
            error: error as AppError,
            errorsByHost: {
              ...state.errorsByHost,
              [hostId]: error as AppError,
            },
          }));
        }
      }),
    );

    set({ isSubscribing: false });
  },
  async clearSubscription() {
    await get().unsubscribe?.();
    set({ activeHostId: undefined, unsubscribe: undefined, isSubscribing: false });
  },
  async clearOverviewSubscriptions() {
    const unsubscribes = Object.values(get().overviewUnsubscribes);
    await Promise.all(unsubscribes.map((unsubscribe) => unsubscribe?.()));
    set({ overviewUnsubscribes: {}, isSubscribing: false });
  },
  async removeHostData(hostId) {
    const state = get();

    if (state.activeHostId === hostId) {
      await state.unsubscribe?.();
    }

    await state.overviewUnsubscribes[hostId]?.();

    set((current) => {
      const { [hostId]: _deletedSnapshot, ...snapshots } = current.snapshots;
      const { [hostId]: _deletedHistory, ...histories } = current.histories;
      const { [hostId]: _deletedError, ...errorsByHost } = current.errorsByHost;
      const { [hostId]: _deletedOverview, ...overviewUnsubscribes } = current.overviewUnsubscribes;

      return {
        snapshots,
        histories,
        errorsByHost,
        overviewUnsubscribes,
        activeHostId: current.activeHostId === hostId ? undefined : current.activeHostId,
        unsubscribe: current.activeHostId === hostId ? undefined : current.unsubscribe,
        isSubscribing: current.activeHostId === hostId ? false : current.isSubscribing,
      };
    });
  },
  ingestSnapshot(snapshot) {
    set((state) => ({
      snapshots: {
        ...state.snapshots,
        [snapshot.hostId]: snapshot,
      },
      histories: {
        ...state.histories,
        [snapshot.hostId]: nextHistory(state.histories[snapshot.hostId], snapshot),
      },
      error: undefined,
      errorsByHost: {
        ...state.errorsByHost,
        [snapshot.hostId]: undefined,
      },
    }));
  },
  ingestMetricsError(event) {
    set((state) => ({
      errorsByHost: {
        ...state.errorsByHost,
        [event.hostId]: event.error,
      },
      error: event.error,
    }));
  },
}));

export function useSelectedSnapshot(hostId?: HostId) {
  return useMetricsStore((state) => (hostId ? state.snapshots[hostId] : undefined));
}

export function useSelectedHistory(hostId?: HostId) {
  return useMetricsStore((state) => (hostId ? state.histories[hostId] : undefined));
}

export function useSelectedMetricsError(hostId?: HostId) {
  return useMetricsStore((state) => (hostId ? state.errorsByHost[hostId] : state.error));
}
