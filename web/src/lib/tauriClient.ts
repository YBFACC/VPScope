import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { createMockTauriClient } from "@/mocks/mockTauriClient";
import type {
  AppError,
  HostConfig,
  HostConnectionState,
  HostCreatePayload,
  HostId,
  HostSnapshot,
  HostTestConnectionPayload,
  HostTestConnectionResult,
  HostUpdatePayload,
  MetricsErrorEvent,
  MetricsSubscribePayload,
  ProcessInfo,
  ProcessListPayload,
  SshConfigHost,
  TraySettings,
} from "@/types/contracts";

export type MetricsSnapshotHandler = (snapshot: HostSnapshot) => void;
export type MetricsErrorHandler = (event: MetricsErrorEvent) => void;
export type HostConnectionStateHandler = (state: HostConnectionState) => void;

export type VPScopeClient = {
  listHosts(): Promise<HostConfig[]>;
  listSshConfigHosts(): Promise<SshConfigHost[]>;
  createHost(payload: HostCreatePayload): Promise<HostConfig>;
  updateHost(payload: HostUpdatePayload): Promise<HostConfig>;
  deleteHost(id: HostId): Promise<void>;
  testConnection(payload: HostTestConnectionPayload): Promise<HostTestConnectionResult>;
  getLastSnapshot(hostId: HostId): Promise<HostSnapshot | null>;
  subscribeMetrics(payload: MetricsSubscribePayload, onSnapshot: MetricsSnapshotHandler): Promise<() => Promise<void>>;
  listenMetricsErrors(onError: MetricsErrorHandler): Promise<() => void>;
  listenHostConnectionStates(onState: HostConnectionStateHandler): Promise<() => void>;
  listProcesses(payload: ProcessListPayload): Promise<ProcessInfo[]>;
  getTraySettings(): Promise<TraySettings>;
  updateTraySettings(settings: TraySettings): Promise<TraySettings>;
};

function toAppError(error: unknown): AppError {
  if (typeof error === "object" && error !== null && "code" in error && "message" in error) {
    return error as AppError;
  }

  return {
    code: "INTERNAL",
    message: error instanceof Error ? error.message : "Unexpected frontend client error",
    retryable: true,
  };
}

function createTauriClient(): VPScopeClient {
  return {
    async listHosts() {
      return invoke<HostConfig[]>("host_list", {});
    },
    async listSshConfigHosts() {
      return invoke<SshConfigHost[]>("host_ssh_config_list", {});
    },
    async createHost(payload) {
      return invoke<HostConfig>("host_create", payload);
    },
    async updateHost(payload) {
      return invoke<HostConfig>("host_update", payload);
    },
    async deleteHost(id) {
      await invoke<{ ok: true }>("host_delete", { payload: { id } });
    },
    async testConnection(payload) {
      return invoke<HostTestConnectionResult>("host_test_connection", payload);
    },
    async getLastSnapshot(hostId) {
      return invoke<HostSnapshot | null>("metrics_last_snapshot", { hostId });
    },
    async subscribeMetrics(payload, onSnapshot) {
      const result = await invoke<{ subscriptionId: string }>("metrics_subscribe", payload);
      const unlisten = await listen<HostSnapshot>("metrics://snapshot", (event) => {
        if (event.payload.hostId === payload.hostId) {
          onSnapshot(event.payload);
        }
      });

      return async () => {
        unlisten();
        await invoke<{ ok: true }>("metrics_unsubscribe", { subscriptionId: result.subscriptionId });
      };
    },
    async listenMetricsErrors(onError) {
      return listen<MetricsErrorEvent>("metrics://error", (event) => {
        onError(event.payload);
      });
    },
    async listenHostConnectionStates(onState) {
      return listen<HostConnectionState>("host://connection-state", (event) => {
        onState(event.payload);
      });
    },
    async listProcesses(payload) {
      return invoke<ProcessInfo[]>("process_list", payload);
    },
    async getTraySettings() {
      return invoke<TraySettings>("tray_settings_get", {});
    },
    async updateTraySettings(settings) {
      return invoke<TraySettings>("tray_settings_update", { settings });
    },
  };
}

function isTauriRuntime() {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in (window as unknown as Record<string, unknown>);
}

export const clientMode = import.meta.env.VITE_VPSCOPE_CLIENT === "tauri" || isTauriRuntime() ? "tauri" : "mock";

export const tauriClient: VPScopeClient = clientMode === "tauri" ? createTauriClient() : createMockTauriClient();

export async function runClient<T>(operation: () => Promise<T>) {
  try {
    return await operation();
  } catch (error) {
    throw toAppError(error);
  }
}
