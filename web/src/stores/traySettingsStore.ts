import { create } from "zustand";
import { runClient, tauriClient } from "@/lib/tauriClient";
import type { AppError, HostConfig, HostId, TrayItemDisplayMode, TraySettings } from "@/types/contracts";

type TraySettingsStore = {
  settings: TraySettings;
  isLoading: boolean;
  isSaving: boolean;
  error?: AppError;
  load: () => Promise<void>;
  save: (settings: TraySettings) => Promise<void>;
  removeHost: (hostId: HostId) => void;
};

const emptySettings: TraySettings = {
  items: [],
};

export const useTraySettingsStore = create<TraySettingsStore>((set) => ({
  settings: emptySettings,
  isLoading: false,
  isSaving: false,
  async load() {
    set({ isLoading: true, error: undefined });
    try {
      const settings = await runClient(() => tauriClient.getTraySettings());
      set({ settings, isLoading: false });
    } catch (error) {
      set({ error: error as AppError, isLoading: false });
    }
  },
  async save(settings) {
    set({ isSaving: true, error: undefined });
    try {
      const saved = await runClient(() => tauriClient.updateTraySettings(settings));
      set({ settings: saved, isSaving: false });
    } catch (error) {
      set({ error: error as AppError, isSaving: false });
      throw error;
    }
  },
  removeHost(hostId) {
    set((state) => ({
      settings: {
        items: state.settings.items.filter((item) => item.hostId !== hostId),
      },
    }));
  },
}));

export function trayHostIds(settings: TraySettings) {
  return settings.items.map((item) => item.hostId);
}

export function defaultTrayLabel(host: HostConfig) {
  const parts = host.name.split(/[-_\s.]+/).filter(Boolean);
  const acronym = parts.map((part) => part[0]).join("");

  if (acronym.length >= 2 && acronym.length <= 4) {
    return acronym;
  }

  return host.name.trim().slice(0, 6) || "vps";
}

export function nextTraySettingsForHost(
  settings: TraySettings,
  host: HostConfig,
  enabled: boolean,
  displayMode: TrayItemDisplayMode = "text",
) {
  const exists = settings.items.some((item) => item.hostId === host.id);

  if (enabled && !exists) {
    return {
      items: [
        ...settings.items,
        {
          hostId: host.id,
          label: defaultTrayLabel(host),
          displayMode,
        },
      ],
    };
  }

  if (!enabled) {
    return {
      items: settings.items.filter((item) => item.hostId !== host.id),
    };
  }

  return settings;
}

export function updateTrayItem(
  settings: TraySettings,
  hostId: HostId,
  patch: Partial<{ label: string; displayMode: TrayItemDisplayMode }>,
) {
  return {
    items: settings.items.map((item) => (item.hostId === hostId ? { ...item, ...patch } : item)),
  };
}
