import { create } from "zustand";
import {
  alertHostIds as enabledAlertHostIds,
  createCpuAlertRule,
  evaluateCpuAlert,
  type AlertRuntimeState,
} from "@/lib/alerts";
import {
  type NativeNotificationPermission,
  runClient,
  tauriClient,
} from "@/lib/tauriClient";
import type { AlertRule, AlertSettings, AppError, HostConfig, HostId, HostSnapshot } from "@/types/contracts";

type AlertSettingsStore = {
  settings: AlertSettings;
  permission: NativeNotificationPermission;
  isLoading: boolean;
  isSaving: boolean;
  isRequestingPermission: boolean;
  error?: AppError;
  runtimeByRule: Record<string, AlertRuntimeState | undefined>;
  load: () => Promise<void>;
  save: (settings: AlertSettings) => Promise<void>;
  refreshPermission: () => Promise<void>;
  requestPermission: () => Promise<void>;
  evaluateSnapshot: (snapshot: HostSnapshot, hosts: HostConfig[]) => Promise<void>;
  removeHost: (hostId: HostId) => void;
};

const emptySettings: AlertSettings = {
  rules: [],
};

function cpuAlertTitle(host: HostConfig) {
  return `${host.name} CPU alert`;
}

function cpuAlertBody(value: number, threshold: number) {
  return `CPU ${Math.round(value)}% >= ${Math.round(threshold)}%`;
}

export const useAlertSettingsStore = create<AlertSettingsStore>((set, get) => ({
  settings: emptySettings,
  permission: "prompt",
  isLoading: false,
  isSaving: false,
  isRequestingPermission: false,
  runtimeByRule: {},
  async load() {
    set({ isLoading: true, error: undefined });
    try {
      const [settings, permission] = await Promise.all([
        runClient(() => tauriClient.getAlertSettings()),
        runClient(() => tauriClient.getNotificationPermission()),
      ]);
      set({ settings, permission, isLoading: false });
    } catch (error) {
      set({ error: error as AppError, isLoading: false });
    }
  },
  async save(settings) {
    set({ isSaving: true, error: undefined });
    try {
      const saved = await runClient(() => tauriClient.updateAlertSettings(settings));
      set((state) => ({
        settings: saved,
        isSaving: false,
        runtimeByRule: Object.fromEntries(
          Object.entries(state.runtimeByRule).filter(([ruleId]) =>
            saved.rules.some((rule) => rule.id === ruleId),
          ),
        ),
      }));
    } catch (error) {
      set({ error: error as AppError, isSaving: false });
      throw error;
    }
  },
  async refreshPermission() {
    try {
      const permission = await runClient(() => tauriClient.getNotificationPermission());
      set({ permission });
    } catch (error) {
      set({ error: error as AppError });
    }
  },
  async requestPermission() {
    set({ isRequestingPermission: true, error: undefined });
    try {
      const permission = await runClient(() => tauriClient.requestNotificationPermission());
      set({ permission, isRequestingPermission: false });
    } catch (error) {
      set({ error: error as AppError, isRequestingPermission: false });
    }
  },
  async evaluateSnapshot(snapshot, hosts) {
    const state = get();
    const rules = state.settings.rules.filter(
      (rule) => rule.enabled && rule.metric === "cpu" && rule.hostId === snapshot.hostId,
    );

    if (rules.length === 0) {
      return;
    }

    const hostsById = new Map(hosts.map((host) => [host.id, host]));
    const runtimePatch: Record<string, AlertRuntimeState> = {};

    for (const rule of rules) {
      const result = evaluateCpuAlert(rule, hostsById.get(rule.hostId), snapshot, state.runtimeByRule[rule.id]);
      runtimePatch[rule.id] = result.next;
      const trigger = result.trigger;

      if (!trigger) {
        continue;
      }

      try {
        await runClient(() =>
          tauriClient.sendNativeNotification({
            title: cpuAlertTitle(trigger.host),
            body: cpuAlertBody(trigger.value, trigger.rule.thresholdPercent),
          }),
        );
      } catch (error) {
        set({ error: error as AppError });
      }
    }

    set((current) => ({
      runtimeByRule: {
        ...current.runtimeByRule,
        ...runtimePatch,
      },
    }));
  },
  removeHost(hostId) {
    set((state) => {
      const settings = {
        rules: state.settings.rules.filter((rule) => rule.hostId !== hostId),
      };
      const keptRuleIds = new Set(settings.rules.map((rule) => rule.id));

      return {
        settings,
        runtimeByRule: Object.fromEntries(
          Object.entries(state.runtimeByRule).filter(([ruleId]) => keptRuleIds.has(ruleId)),
        ),
      };
    });
  },
}));

export function alertHostIds(settings: AlertSettings) {
  return enabledAlertHostIds(settings.rules);
}

export function nextAlertSettingsForHost(settings: AlertSettings, host: HostConfig, enabled: boolean) {
  const existing = settings.rules.find((rule) => rule.hostId === host.id && rule.metric === "cpu");

  if (enabled && !existing) {
    return {
      rules: [...settings.rules, createCpuAlertRule(host.id)],
    };
  }

  if (!enabled) {
    return {
      rules: settings.rules.map((rule) =>
        rule.hostId === host.id && rule.metric === "cpu"
          ? { ...rule, enabled: false, updatedAt: Date.now() }
          : rule,
      ),
    };
  }

  return existing
    ? {
        rules: settings.rules.map((rule) =>
          rule.id === existing.id ? { ...rule, enabled: true, updatedAt: Date.now() } : rule,
        ),
      }
    : settings;
}

export function updateAlertRule(settings: AlertSettings, ruleId: string, patch: Partial<AlertRule>) {
  return {
    rules: settings.rules.map((rule) =>
      rule.id === ruleId
        ? {
            ...rule,
            ...patch,
            updatedAt: Date.now(),
          }
        : rule,
    ),
  };
}
