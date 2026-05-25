import { create } from "zustand";
import { runClient, tauriClient } from "@/lib/tauriClient";
import { useMetricsStore } from "@/stores/metricsStore";
import { useTraySettingsStore } from "@/stores/traySettingsStore";
import type {
  AppError,
  HostConfig,
  HostConnectionState,
  HostCreatePayload,
  HostId,
  HostTestConnectionPayload,
} from "@/types/contracts";

type HostStore = {
  hosts: HostConfig[];
  selectedHostId?: HostId;
  connectionStates: Record<HostId, HostConnectionState>;
  isLoading: boolean;
  error?: AppError;
  loadHosts: () => Promise<void>;
  selectHost: (hostId: HostId) => void;
  createHost: (payload: HostCreatePayload) => Promise<HostConfig>;
  deleteHost: (hostId: HostId) => Promise<void>;
  testConnection: (payload: HostTestConnectionPayload) => Promise<void>;
  setConnectionState: (state: HostConnectionState) => void;
};

const defaultState = (hostId: HostId): HostConnectionState => ({
  hostId,
  status: "disconnected",
  message: "idle",
});

export const useHostStore = create<HostStore>((set, get) => ({
  hosts: [],
  connectionStates: {},
  isLoading: false,
  async loadHosts() {
    set({ isLoading: true, error: undefined });

    try {
      const hosts = await runClient(() => tauriClient.listHosts());
      const previous = get().connectionStates;
      const connectionStates = Object.fromEntries(
        hosts.map((host) => [host.id, previous[host.id] ?? defaultState(host.id)]),
      );

      set({
        hosts,
        connectionStates,
        selectedHostId: hosts.some((host) => host.id === get().selectedHostId)
          ? get().selectedHostId
          : hosts[0]?.id,
        isLoading: false,
      });
    } catch (error) {
      set({ error: error as AppError, isLoading: false });
    }
  },
  selectHost(hostId) {
    set({ selectedHostId: hostId });
  },
  async createHost(payload) {
    const host = await runClient(() => tauriClient.createHost(payload));

    set((state) => ({
      hosts: [host, ...state.hosts],
      selectedHostId: host.id,
      connectionStates: {
        ...state.connectionStates,
        [host.id]: defaultState(host.id),
      },
    }));

    return host;
  },
  async deleteHost(hostId) {
    await runClient(() => tauriClient.deleteHost(hostId));
    await useMetricsStore.getState().removeHostData(hostId);
    useTraySettingsStore.getState().removeHost(hostId);

    set((state) => {
      const hosts = state.hosts.filter((host) => host.id !== hostId);
      const { [hostId]: _deletedConnection, ...connectionStates } = state.connectionStates;
      const selectedHostId = state.selectedHostId === hostId ? hosts[0]?.id : state.selectedHostId;

      return {
        hosts,
        selectedHostId,
        connectionStates,
      };
    });
  },
  async testConnection(payload) {
    const hostId = payload.id ?? "draft";
    set((state) => ({
      connectionStates: {
        ...state.connectionStates,
        [hostId]: { hostId, status: "connecting", message: "testing connection" },
      },
    }));

    try {
      const result = await runClient(() => tauriClient.testConnection(payload));
      set((state) => ({
        connectionStates: {
          ...state.connectionStates,
          [hostId]: {
            hostId,
            status: "connected",
            message: `${result.hostname} responded`,
            latencyMs: result.latencyMs,
            lastConnectedAt: Date.now(),
          },
        },
      }));
    } catch (error) {
      set((state) => ({
        connectionStates: {
          ...state.connectionStates,
          [hostId]: {
            hostId,
            status: "error",
            message: (error as AppError).message,
            lastError: error as AppError,
          },
        },
      }));
    }
  },
  setConnectionState(state) {
    set((current) => ({
      connectionStates: {
        ...current.connectionStates,
        [state.hostId]: state,
      },
    }));
  },
}));

export function useSelectedHost() {
  return useHostStore((state) => state.hosts.find((host) => host.id === state.selectedHostId));
}
