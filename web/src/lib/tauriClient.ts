import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
  type PermissionState,
} from "@tauri-apps/plugin-notification";
import { createMockTauriClient } from "@/mocks/mockTauriClient";
import type {
  AlertSettings,
  AppError,
  DockerComposeActionPayload,
  DockerComposeActionResult,
  DockerContainerActionPayload,
  DockerContainerActionResult,
  DockerContainer,
  DockerContainerLogsPayload,
  DockerContainerLogsResult,
  HostAcceptKeyPayload,
  HostAcceptKeyResult,
  HostConfig,
  HostConnectionState,
  HostCreatePayload,
  HostId,
  HostOpenTerminalResult,
  HostReorderPayload,
  HostSnapshot,
  HostTestConnectionPayload,
  HostTestConnectionResult,
  HostUpdatePayload,
  MetricsErrorEvent,
  MetricsSubscribePayload,
  ProcessInfo,
  ProcessListPayload,
  SshConfigHost,
  TerminalSettings,
  TraySettings,
  VpscopeCommandPayloads,
  VpscopeCommandResults,
} from "@/types/contracts";

export type NativeNotificationPermission = "granted" | "denied" | "prompt";
export type MetricsSnapshotHandler = (snapshot: HostSnapshot) => void;
export type MetricsErrorHandler = (event: MetricsErrorEvent) => void;
export type HostConnectionStateHandler = (state: HostConnectionState) => void;
export type NotificationPayload = {
  title: string;
  body: string;
};

export type VPScopeClient = {
  listHosts(): Promise<HostConfig[]>;
  listSshConfigHosts(): Promise<SshConfigHost[]>;
  createHost(payload: HostCreatePayload): Promise<HostConfig>;
  updateHost(payload: HostUpdatePayload): Promise<HostConfig>;
  reorderHosts(payload: HostReorderPayload): Promise<HostConfig[]>;
  deleteHost(id: HostId): Promise<void>;
  openTerminal(hostId: HostId): Promise<HostOpenTerminalResult>;
  testConnection(payload: HostTestConnectionPayload): Promise<HostTestConnectionResult>;
  acceptHostKey(payload: HostAcceptKeyPayload): Promise<HostAcceptKeyResult>;
  getLastSnapshot(hostId: HostId): Promise<HostSnapshot | null>;
  subscribeMetrics(payload: MetricsSubscribePayload, onSnapshot: MetricsSnapshotHandler): Promise<() => Promise<void>>;
  listenMetricsErrors(onError: MetricsErrorHandler): Promise<() => void>;
  listenHostConnectionStates(onState: HostConnectionStateHandler): Promise<() => void>;
  listProcesses(payload: ProcessListPayload): Promise<ProcessInfo[]>;
  listDockerContainers(hostId: HostId): Promise<DockerContainer[]>;
  getDockerContainerLogs(payload: DockerContainerLogsPayload): Promise<DockerContainerLogsResult>;
  runDockerContainerAction(payload: DockerContainerActionPayload): Promise<DockerContainerActionResult>;
  runDockerComposeAction(payload: DockerComposeActionPayload): Promise<DockerComposeActionResult>;
  getTraySettings(): Promise<TraySettings>;
  updateTraySettings(settings: TraySettings): Promise<TraySettings>;
  getAlertSettings(): Promise<AlertSettings>;
  updateAlertSettings(settings: AlertSettings): Promise<AlertSettings>;
  getTerminalSettings(): Promise<TerminalSettings>;
  updateTerminalSettings(settings: TerminalSettings): Promise<TerminalSettings>;
  getNotificationPermission(): Promise<NativeNotificationPermission>;
  requestNotificationPermission(): Promise<NativeNotificationPermission>;
  sendNativeNotification(payload: NotificationPayload): Promise<void>;
};

export type ClientMode = "mock" | "tauri";

const clientModeStorageKey = "vpscope-client-mode";

function invokeCommand<Command extends keyof VpscopeCommandPayloads>(
  command: Command,
  payload: VpscopeCommandPayloads[Command],
) {
  return invoke<VpscopeCommandResults[Command]>(command, payload);
}

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
  const normalizePermission = (permission: PermissionState | NotificationPermission): NativeNotificationPermission =>
    permission === "granted" || permission === "denied" ? permission : "prompt";

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
    async reorderHosts(payload) {
      return invoke<HostConfig[]>("host_reorder", { payload });
    },
    async deleteHost(id) {
      await invoke<{ ok: true }>("host_delete", { payload: { id } });
    },
    async openTerminal(hostId) {
      return invoke<HostOpenTerminalResult>("host_open_terminal", { payload: { hostId } });
    },
    async testConnection(payload) {
      return invoke<HostTestConnectionResult>("host_test_connection", payload);
    },
    async acceptHostKey(payload) {
      return invoke<HostAcceptKeyResult>("host_accept_key", payload);
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
    async listDockerContainers(hostId) {
      return invokeCommand("docker_container_list", { hostId });
    },
    async getDockerContainerLogs(payload) {
      return invokeCommand("docker_container_logs", payload);
    },
    async runDockerContainerAction(payload) {
      return invokeCommand("docker_container_action", payload);
    },
    async runDockerComposeAction(payload) {
      return invokeCommand("docker_compose_action", payload);
    },
    async getTraySettings() {
      return invoke<TraySettings>("tray_settings_get", {});
    },
    async updateTraySettings(settings) {
      return invokeCommand("tray_settings_update", { settings });
    },
    async getAlertSettings() {
      return invoke<AlertSettings>("alert_settings_get", {});
    },
    async updateAlertSettings(settings) {
      return invokeCommand("alert_settings_update", { settings });
    },
    async getTerminalSettings() {
      return invoke<TerminalSettings>("terminal_settings_get", {});
    },
    async updateTerminalSettings(settings) {
      return invokeCommand("terminal_settings_update", { settings });
    },
    async getNotificationPermission() {
      if (typeof window === "undefined" || !("Notification" in window)) {
        return "denied";
      }

      const granted = await isPermissionGranted();
      return granted ? "granted" : normalizePermission(window.Notification.permission);
    },
    async requestNotificationPermission() {
      if (typeof window === "undefined" || !("Notification" in window)) {
        return "denied";
      }

      return normalizePermission(await requestPermission());
    },
    async sendNativeNotification(payload) {
      const granted = await isPermissionGranted();

      if (!granted) {
        throw {
          code: "CONFIG_INVALID",
          message: "macOS notification permission is not granted",
          retryable: false,
        } satisfies AppError;
      }

      sendNotification(payload);
    },
  };
}

function isTauriRuntime() {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in (window as unknown as Record<string, unknown>);
}

function readStoredClientMode(): ClientMode | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }

  const storedValue = window.localStorage.getItem(clientModeStorageKey);
  return storedValue === "mock" || storedValue === "tauri" ? storedValue : undefined;
}

function readEnvClientMode(): ClientMode | undefined {
  return import.meta.env.VITE_VPSCOPE_CLIENT === "mock" || import.meta.env.VITE_VPSCOPE_CLIENT === "tauri"
    ? import.meta.env.VITE_VPSCOPE_CLIENT
    : undefined;
}

export function resolveClientMode(): ClientMode {
  return readStoredClientMode() ?? readEnvClientMode() ?? (isTauriRuntime() ? "tauri" : "mock");
}

export function persistClientMode(mode: ClientMode) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(clientModeStorageKey, mode);
}

export const clientMode = resolveClientMode();

export const tauriClient: VPScopeClient = clientMode === "tauri" ? createTauriClient() : createMockTauriClient();

export async function runClient<T>(operation: () => Promise<T>) {
  try {
    return await operation();
  } catch (error) {
    throw toAppError(error);
  }
}
