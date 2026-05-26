import { create } from "zustand";
import { runClient, tauriClient } from "@/lib/tauriClient";
import type { AppError, HostId, TerminalSettings } from "@/types/contracts";

type TerminalSettingsStore = {
  settings: TerminalSettings;
  isLoading: boolean;
  isSaving: boolean;
  openingHostIds: Record<HostId, boolean | undefined>;
  errorsByHost: Record<HostId, AppError | undefined>;
  error?: AppError;
  load: () => Promise<void>;
  save: (settings: TerminalSettings) => Promise<void>;
  openHostTerminal: (hostId: HostId) => Promise<void>;
};

const defaultSettings: TerminalSettings = {
  app: "terminal_app",
};

export const useTerminalSettingsStore = create<TerminalSettingsStore>((set) => ({
  settings: defaultSettings,
  isLoading: false,
  isSaving: false,
  openingHostIds: {},
  errorsByHost: {},
  async load() {
    set({ isLoading: true, error: undefined });
    try {
      const settings = await runClient(() => tauriClient.getTerminalSettings());
      set({ settings, isLoading: false });
    } catch (error) {
      set({ error: error as AppError, isLoading: false });
    }
  },
  async save(settings) {
    set({ isSaving: true, error: undefined });
    try {
      const saved = await runClient(() => tauriClient.updateTerminalSettings(settings));
      set({ settings: saved, isSaving: false });
    } catch (error) {
      set({ error: error as AppError, isSaving: false });
      throw error;
    }
  },
  async openHostTerminal(hostId) {
    set((state) => ({
      openingHostIds: {
        ...state.openingHostIds,
        [hostId]: true,
      },
      errorsByHost: {
        ...state.errorsByHost,
        [hostId]: undefined,
      },
    }));

    try {
      await runClient(() => tauriClient.openTerminal(hostId));
      set((state) => ({
        openingHostIds: {
          ...state.openingHostIds,
          [hostId]: false,
        },
      }));
    } catch (error) {
      set((state) => ({
        openingHostIds: {
          ...state.openingHostIds,
          [hostId]: false,
        },
        errorsByHost: {
          ...state.errorsByHost,
          [hostId]: error as AppError,
        },
      }));
    }
  },
}));
