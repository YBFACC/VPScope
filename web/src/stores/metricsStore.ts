import { create } from "zustand";
import { pushHistory, type HistoryPoint } from "@/lib/historyBuffer";
import { runClient, tauriClient } from "@/lib/tauriClient";
import type {
  AppError,
  CollectionProfile,
  HostId,
  HostSnapshot,
  MetricsErrorEvent,
  ProcessInfo,
} from "@/types/contracts";

export type NetworkInterfaceHistory = {
  rx: Array<HistoryPoint<number>>;
  tx: Array<HistoryPoint<number>>;
};

type MetricHistory = {
  cpu: Array<HistoryPoint<number>>;
  memory: Array<HistoryPoint<number>>;
  networkByInterface: Record<string, NetworkInterfaceHistory>;
};

type MetricsStore = {
  snapshots: Record<HostId, HostSnapshot | undefined>;
  histories: Record<HostId, MetricHistory | undefined>;
  processesByHost: Record<HostId, ProcessInfo[] | undefined>;
  activeHostId?: HostId;
  activeSubscriptionEpoch: number;
  overviewSubscriptionEpoch: number;
  overviewUnsubscribes: Record<HostId, { profile: CollectionProfile; unsubscribe: () => Promise<void> } | undefined>;
  isSubscribing: boolean;
  error?: AppError;
  errorsByHost: Record<HostId, AppError | undefined>;
  unsubscribe?: () => Promise<void>;
  subscribeToHost: (hostId: HostId) => Promise<void>;
  subscribeToHosts: (hostIds: HostId[], profile?: CollectionProfile) => Promise<void>;
  clearSubscription: () => Promise<void>;
  clearOverviewSubscriptions: () => Promise<void>;
  ingestSnapshot: (snapshot: HostSnapshot, profile: CollectionProfile) => void;
  ingestMetricsError: (event: MetricsErrorEvent) => void;
  removeHostData: (hostId: HostId) => Promise<void>;
};

const HISTORY_LIMIT = 120;
const EMPTY_PROCESSES: ProcessInfo[] = [];

const emptyHistory = (): MetricHistory => ({
  cpu: [],
  memory: [],
  networkByInterface: {},
});

function nextHistory(previous: MetricHistory | undefined, snapshot: HostSnapshot) {
  const history = previous ?? emptyHistory();
  const memoryPercent =
    snapshot.memory.totalBytes > 0 ? (snapshot.memory.usedBytes / snapshot.memory.totalBytes) * 100 : 0;
  const nextNetworkByInterface = Object.fromEntries(
    snapshot.network.map((iface) => {
      const previousInterfaceHistory = history.networkByInterface[iface.iface];

      return [
        iface.iface,
        {
          rx: pushHistory(
            previousInterfaceHistory?.rx ?? [],
            { ts: snapshot.ts, value: iface.rxBytesPerSec },
            HISTORY_LIMIT,
          ),
          tx: pushHistory(
            previousInterfaceHistory?.tx ?? [],
            { ts: snapshot.ts, value: iface.txBytesPerSec },
            HISTORY_LIMIT,
          ),
        },
      ] satisfies [string, NetworkInterfaceHistory];
    }),
  );

  return {
    cpu: pushHistory(history.cpu, { ts: snapshot.ts, value: snapshot.cpu.totalPercent }, HISTORY_LIMIT),
    memory: pushHistory(history.memory, { ts: snapshot.ts, value: memoryPercent }, HISTORY_LIMIT),
    networkByInterface: nextNetworkByInterface,
  };
}

function sameProcesses(left: ProcessInfo[] | undefined, right: ProcessInfo[]) {
  if (!left || left.length !== right.length) {
    return false;
  }

  return left.every((process, index) => {
    const next = right[index];
    return (
      process.pid === next.pid &&
      process.name === next.name &&
      process.user === next.user &&
      process.cpuPercent === next.cpuPercent &&
      process.memoryBytes === next.memoryBytes &&
      process.command === next.command
    );
  });
}

function stableProcesses(previous: ProcessInfo[] | undefined, next: ProcessInfo[]) {
  return sameProcesses(previous, next) ? previous : next;
}

function lastSnapshotProfile(snapshot: HostSnapshot): CollectionProfile {
  return snapshot.processes.length > 0 ? "active" : "overview";
}

export const useMetricsStore = create<MetricsStore>((set, get) => ({
  snapshots: {},
  histories: {},
  processesByHost: {},
  activeSubscriptionEpoch: 0,
  overviewSubscriptionEpoch: 0,
  errorsByHost: {},
  overviewUnsubscribes: {},
  isSubscribing: false,
  async subscribeToHost(hostId) {
    const current = get();
    const overviewSubscription = current.overviewUnsubscribes[hostId];

    if (current.activeHostId === hostId && current.unsubscribe) {
      if (overviewSubscription) {
        await overviewSubscription.unsubscribe();
        set((state) => {
          const { [hostId]: _deleted, ...overviewUnsubscribes } = state.overviewUnsubscribes;
          return { overviewUnsubscribes };
        });
      }
      return;
    }

    const epoch = current.activeSubscriptionEpoch + 1;
    set({
      activeHostId: hostId,
      activeSubscriptionEpoch: epoch,
      unsubscribe: undefined,
      isSubscribing: true,
      error: undefined,
    });
    await current.unsubscribe?.();

    if (overviewSubscription) {
      await overviewSubscription.unsubscribe();
      set((state) => {
        const { [hostId]: _deleted, ...overviewUnsubscribes } = state.overviewUnsubscribes;
        return { overviewUnsubscribes };
      });
    }

    try {
      const lastSnapshot = await runClient(() => tauriClient.getLastSnapshot(hostId));
      if (get().activeSubscriptionEpoch !== epoch || get().activeHostId !== hostId) {
        return;
      }
      if (lastSnapshot) {
        get().ingestSnapshot(lastSnapshot, lastSnapshotProfile(lastSnapshot));
      }
      const unsubscribe = await runClient(() =>
        tauriClient.subscribeMetrics({ hostId, profile: "active" }, (snapshot) => {
          const state = get();
          if (state.activeSubscriptionEpoch === epoch && state.activeHostId === hostId) {
            state.ingestSnapshot(snapshot, "active");
          }
        }),
      );
      if (get().activeSubscriptionEpoch !== epoch || get().activeHostId !== hostId) {
        await unsubscribe();
        return;
      }
      set({ unsubscribe, isSubscribing: false });
    } catch (error) {
      if (get().activeSubscriptionEpoch === epoch && get().activeHostId === hostId) {
        set({ error: error as AppError, isSubscribing: false });
      }
    }
  },
  async subscribeToHosts(hostIds, profile = "overview") {
    const epoch = get().overviewSubscriptionEpoch + 1;
    set({ overviewSubscriptionEpoch: epoch });
    const current = get();
    const uniqueHostIds = Array.from(new Set(hostIds)).filter((hostId) => hostId !== current.activeHostId);
    const wanted = new Set(uniqueHostIds);

    await Promise.all(
      Object.entries(current.overviewUnsubscribes)
        .filter(([hostId, subscription]) => !wanted.has(hostId) || subscription?.profile !== profile)
        .map(async ([hostId, subscription]) => {
          await subscription?.unsubscribe();
          if (get().overviewSubscriptionEpoch === epoch) {
            set((state) => {
              const { [hostId]: _deleted, ...overviewUnsubscribes } = state.overviewUnsubscribes;
              return { overviewUnsubscribes };
            });
          }
        }),
    );

    if (get().overviewSubscriptionEpoch !== epoch) {
      return;
    }

    const missingHostIds = uniqueHostIds.filter((hostId) => !get().overviewUnsubscribes[hostId]);

    if (missingHostIds.length === 0) {
      return;
    }

    set({ isSubscribing: true, error: undefined });

    await Promise.all(
      missingHostIds.map(async (hostId) => {
        try {
          const lastSnapshot = await runClient(() => tauriClient.getLastSnapshot(hostId));
          if (get().overviewSubscriptionEpoch !== epoch || get().activeHostId === hostId) {
            return;
          }
          if (lastSnapshot) {
            get().ingestSnapshot(lastSnapshot, profile);
          }
          const unsubscribe = await runClient(() =>
            tauriClient.subscribeMetrics({ hostId, profile }, (snapshot) => {
              const state = get();
              if (state.activeHostId !== hostId && state.overviewUnsubscribes[hostId]?.profile === profile) {
                state.ingestSnapshot(snapshot, profile);
              }
            }),
          );
          if (get().overviewSubscriptionEpoch !== epoch || get().activeHostId === hostId) {
            await unsubscribe();
            return;
          }
          set((state) => ({
            overviewUnsubscribes: {
              ...state.overviewUnsubscribes,
              [hostId]: {
                profile,
                unsubscribe,
              },
            },
          }));
        } catch (error) {
          if (get().overviewSubscriptionEpoch === epoch) {
            set((state) => ({
              error: error as AppError,
              errorsByHost: {
                ...state.errorsByHost,
                [hostId]: error as AppError,
              },
            }));
          }
        }
      }),
    );

    if (get().overviewSubscriptionEpoch === epoch) {
      set({ isSubscribing: false });
    }
  },
  async clearSubscription() {
    const unsubscribe = get().unsubscribe;
    set((state) => ({
      activeHostId: undefined,
      activeSubscriptionEpoch: state.activeSubscriptionEpoch + 1,
      unsubscribe: undefined,
      isSubscribing: false,
    }));
    await unsubscribe?.();
  },
  async clearOverviewSubscriptions() {
    const unsubscribes = Object.values(get().overviewUnsubscribes);
    set((state) => ({
      overviewSubscriptionEpoch: state.overviewSubscriptionEpoch + 1,
      overviewUnsubscribes: {},
      isSubscribing: false,
    }));
    await Promise.all(unsubscribes.map((subscription) => subscription?.unsubscribe()));
  },
  async removeHostData(hostId) {
    const state = get();

    if (state.activeHostId === hostId) {
      await state.unsubscribe?.();
    }

    await state.overviewUnsubscribes[hostId]?.unsubscribe();

    set((current) => {
      const { [hostId]: _deletedSnapshot, ...snapshots } = current.snapshots;
      const { [hostId]: _deletedHistory, ...histories } = current.histories;
      const { [hostId]: _deletedProcesses, ...processesByHost } = current.processesByHost;
      const { [hostId]: _deletedError, ...errorsByHost } = current.errorsByHost;
      const { [hostId]: _deletedOverview, ...overviewUnsubscribes } = current.overviewUnsubscribes;

      return {
        snapshots,
        histories,
        processesByHost,
        errorsByHost,
        overviewUnsubscribes,
        activeSubscriptionEpoch:
          current.activeHostId === hostId ? current.activeSubscriptionEpoch + 1 : current.activeSubscriptionEpoch,
        activeHostId: current.activeHostId === hostId ? undefined : current.activeHostId,
        unsubscribe: current.activeHostId === hostId ? undefined : current.unsubscribe,
        isSubscribing: current.activeHostId === hostId ? false : current.isSubscribing,
      };
    });
  },
  ingestSnapshot(snapshot, profile) {
    set((state) => {
      const nextProcesses =
        profile === "active" ? stableProcesses(state.processesByHost[snapshot.hostId], snapshot.processes) : undefined;
      const nextSnapshot =
        profile === "active" && nextProcesses ? { ...snapshot, processes: nextProcesses } : snapshot;

      return {
        snapshots: {
          ...state.snapshots,
          [snapshot.hostId]: nextSnapshot,
        },
        histories: {
          ...state.histories,
          [snapshot.hostId]: nextHistory(state.histories[snapshot.hostId], snapshot),
        },
        processesByHost:
          profile === "active"
            ? {
                ...state.processesByHost,
                [snapshot.hostId]: nextProcesses,
              }
            : state.processesByHost,
        error: undefined,
        errorsByHost: {
          ...state.errorsByHost,
          [snapshot.hostId]: undefined,
        },
      };
    });
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

export function useSelectedProcesses(hostId?: HostId) {
  return useMetricsStore((state) => (hostId ? state.processesByHost[hostId] ?? EMPTY_PROCESSES : EMPTY_PROCESSES));
}

export function useSelectedMetricsError(hostId?: HostId) {
  return useMetricsStore((state) => (hostId ? state.errorsByHost[hostId] : state.error));
}
