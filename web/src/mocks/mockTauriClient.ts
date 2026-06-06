import { mockConnectionStates, mockHosts } from "@/mocks/mockHosts";
import { createMockSnapshot } from "@/mocks/mockSnapshots";
import type { VPScopeClient } from "@/lib/tauriClient";
import type {
  AlertSettings,
  HostConfig,
  HostCreatePayload,
  HostId,
  ProcessListPayload,
  TerminalSettings,
  TraySettings,
} from "@/types/contracts";

let hosts: HostConfig[] = mockHosts.map((host) => ({ ...host }));
let traySettings: TraySettings = {
  items: [
    {
      hostId: mockHosts[0]?.id ?? "mock-vps-1",
      label: "fl",
      displayMode: "text",
    },
  ],
};
let alertSettings: AlertSettings = {
  rules: [],
};
let terminalSettings: TerminalSettings = {
  app: "terminal_app",
};

function wait(ms = 180) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function createHostConfig(payload: HostCreatePayload): HostConfig {
  const now = Date.now();
  const id = `mock-vps-${now}`;

  return {
    id,
    name: payload.name,
    address: payload.address,
    port: payload.port,
    auth: sanitizeHostAuth(payload.auth),
    refreshIntervalMs: payload.refreshIntervalMs,
    tags: payload.tags ?? [],
    createdAt: now,
    updatedAt: now,
  };
}

function sanitizeHostAuth(auth: HostCreatePayload["auth"]): HostConfig["auth"] {
  if (auth.type === "private_key") {
    return {
      type: "private_key",
      username: auth.username,
      keyPath: auth.keyPath,
    };
  }

  return auth;
}

function sortProcesses(payload: ProcessListPayload) {
  const snapshot = createMockSnapshot(payload.hostId);
  const filter = payload.filter?.trim().toLowerCase();
  const processes = filter
    ? snapshot.processes.filter((process) =>
        [process.pid.toString(), process.name, process.user, process.command].some((value) =>
          value.toLowerCase().includes(filter),
        ),
      )
    : snapshot.processes;

  const sorted = [...processes].sort((a, b) => {
    const direction = payload.sortDirection === "asc" ? 1 : -1;

    if (payload.sortBy === "cpu") {
      return (a.cpuPercent - b.cpuPercent) * direction;
    }

    if (payload.sortBy === "memory") {
      return (a.memoryBytes - b.memoryBytes) * direction;
    }

    if (payload.sortBy === "pid") {
      return (a.pid - b.pid) * direction;
    }

    return a.name.localeCompare(b.name) * direction;
  });

  return typeof payload.limit === "number" ? sorted.slice(0, payload.limit) : sorted;
}

function createSubscriptionSnapshot(hostId: HostId, profile = "active") {
  const snapshot = createMockSnapshot(hostId);

  if (profile !== "active") {
    return {
      ...snapshot,
      processes: [],
    };
  }

  return snapshot;
}

export function createMockTauriClient(): VPScopeClient {
  return {
    async listHosts() {
      await wait();
      return hosts.map((host) => ({ ...host }));
    },
    async listSshConfigHosts() {
      await wait(120);
      return [
        {
          alias: "flux-logic",
          hostName: "flux-logic",
          user: "ubuntu",
          port: 22,
          identityFile: "~/.ssh/tx3.pem",
        },
        {
          alias: "staging-box",
          hostName: "10.8.0.42",
          user: "ops",
          port: 22,
          identityFile: "~/.ssh/id_ed25519",
        },
      ];
    },
    async createHost(payload) {
      await wait(260);
      const host = createHostConfig(payload);
      hosts = [...hosts, host];
      return { ...host };
    },
    async updateHost(payload) {
      await wait(220);
      const existing = hosts.find((host) => host.id === payload.id);

      if (!existing) {
        throw {
          code: "HOST_NOT_FOUND",
          message: "Host was not found",
          retryable: false,
        };
      }

      const updated = {
        ...existing,
        ...payload.patch,
        auth: payload.patch.auth ? sanitizeHostAuth(payload.patch.auth) : existing.auth,
        tags: payload.patch.tags ?? existing.tags,
        updatedAt: Date.now(),
      };

      hosts = hosts.map((host) => (host.id === payload.id ? updated : host));
      return { ...updated };
    },
    async reorderHosts(payload) {
      await wait(180);
      if (payload.orderedHostIds.length !== hosts.length) {
        throw {
          code: "CONFIG_INVALID",
          message: "Host reorder payload must include every saved host exactly once",
          retryable: false,
        };
      }

      const reordered: HostConfig[] = [];

      for (const hostId of payload.orderedHostIds) {
        if (reordered.some((host) => host.id === hostId)) {
          throw {
            code: "CONFIG_INVALID",
            message: "Host reorder payload contains a duplicate host id",
            retryable: false,
          };
        }

        const host = hosts.find((candidate) => candidate.id === hostId);
        if (!host) {
          throw {
            code: "HOST_NOT_FOUND",
            message: "Host was not found",
            retryable: false,
          };
        }

        reordered.push(host);
      }

      hosts = reordered;
      return hosts.map((host) => ({ ...host }));
    },
    async deleteHost(id: HostId) {
      await wait(160);
      hosts = hosts.filter((host) => host.id !== id);
      alertSettings = {
        rules: alertSettings.rules.filter((rule) => rule.hostId !== id),
      };
    },
    async openTerminal(hostId: HostId) {
      await wait(120);
      const host = hosts.find((candidate) => candidate.id === hostId);

      if (!host) {
        throw {
          code: "HOST_NOT_FOUND",
          message: "Host was not found",
          retryable: false,
        };
      }

      console.info("[mock terminal]", terminalSettings.app, `${host.auth.username}@${host.address}:${host.port}`);
      return {
        ok: true,
        app: terminalSettings.app,
      };
    },
    async testConnection(payload) {
      await wait(520);
      const host =
        (payload.id ? hosts.find((candidate) => candidate.id === payload.id) : undefined) ??
        (payload.draft ? createHostConfig(payload.draft) : hosts[0]);

      return {
        ok: true,
        latencyMs: host.id === "mock-vps-2" ? 64 : 38,
        hostname: host.name,
        os: host.id === "mock-vps-2" ? "Debian 12" : "Ubuntu 24.04",
        kernel: host.id === "mock-vps-2" ? "6.1.0" : "6.8.0",
        fingerprint: "SHA256:mockedHostKeyFingerprintvpscope",
      };
    },
    async acceptHostKey(payload) {
      await wait(180);
      return {
        ok: true,
        fingerprint: payload.fingerprint,
      };
    },
    async getLastSnapshot(hostId) {
      await wait(40);
      return createMockSnapshot(hostId);
    },
    async subscribeMetrics(payload, onSnapshot) {
      await wait(80);
      const { hostId } = payload;
      onSnapshot(createSubscriptionSnapshot(hostId, payload.profile));
      const host = hosts.find((candidate) => candidate.id === hostId);
      const profileInterval =
        payload.profile === "tray" ? 30_000 : payload.profile === "overview" ? 5_000 : undefined;
      const interval = window.setInterval(() => {
        onSnapshot(createSubscriptionSnapshot(hostId, payload.profile));
      }, payload.intervalMs ?? profileInterval ?? host?.refreshIntervalMs ?? 2_000);

      return async () => {
        window.clearInterval(interval);
      };
    },
    async listenMetricsErrors() {
      return () => {};
    },
    async listenHostConnectionStates(onState) {
      const interval = window.setInterval(() => {
        for (const state of Object.values(mockConnectionStates)) {
          onState(state);
        }
      }, 5_000);

      return () => {
        window.clearInterval(interval);
      };
    },
    async listProcesses(payload) {
      await wait(120);
      return sortProcesses(payload);
    },
    async getTraySettings() {
      await wait(80);
      return {
        items: traySettings.items.map((item) => ({ ...item })),
      };
    },
    async updateTraySettings(settings) {
      await wait(160);
      traySettings = {
        items: settings.items.map((item) => ({
          ...item,
          label: item.label.trim().slice(0, 12),
        })),
      };
      return {
        items: traySettings.items.map((item) => ({ ...item })),
      };
    },
    async getAlertSettings() {
      await wait(80);
      return {
        rules: alertSettings.rules.map((rule) => ({ ...rule })),
      };
    },
    async updateAlertSettings(settings) {
      await wait(160);
      alertSettings = {
        rules: settings.rules.map((rule) => ({ ...rule })),
      };
      return {
        rules: alertSettings.rules.map((rule) => ({ ...rule })),
      };
    },
    async getTerminalSettings() {
      await wait(80);
      return { ...terminalSettings };
    },
    async updateTerminalSettings(settings) {
      await wait(140);
      terminalSettings = { ...settings };
      return { ...terminalSettings };
    },
    async getNotificationPermission() {
      return "granted";
    },
    async requestNotificationPermission() {
      return "granted";
    },
    async sendNativeNotification(payload) {
      console.info("[mock notification]", payload.title, payload.body);
    },
  };
}

export { mockConnectionStates };
