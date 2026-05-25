import { create } from "zustand";
import type { Locale } from "@/i18n/messages";
import { applyTheme } from "@/theme/applyTheme";
import { getThemeById, type ThemeId } from "@/theme/presets";
import type { ProcessListPayload } from "@/types/contracts";

type UiStore = {
  themeId: ThemeId;
  locale: Locale;
  viewMode: "overview" | "list";
  search: string;
  processSortBy: ProcessListPayload["sortBy"];
  processSortDirection: ProcessListPayload["sortDirection"];
  focusedProcessIndex: number;
  settingsOpen: boolean;
  setTheme: (themeId: ThemeId) => void;
  setLocale: (locale: Locale) => void;
  setViewMode: (viewMode: "overview" | "list") => void;
  setSearch: (search: string) => void;
  setProcessSort: (sortBy: ProcessListPayload["sortBy"]) => void;
  moveFocusedProcess: (delta: number, rowCount: number) => void;
  setSettingsOpen: (settingsOpen: boolean) => void;
};

const initialTheme = getThemeById(localStorage.getItem("vpscope-theme"));
const initialLocale = (localStorage.getItem("vpscope-locale") === "en-US" ? "en-US" : "zh-CN") satisfies Locale;

export const useUiStore = create<UiStore>((set, get) => ({
  themeId: initialTheme.id,
  locale: initialLocale,
  viewMode: "overview",
  search: "",
  processSortBy: "cpu",
  processSortDirection: "desc",
  focusedProcessIndex: 0,
  settingsOpen: false,
  setTheme(themeId) {
    applyTheme(getThemeById(themeId));
    set({ themeId });
  },
  setLocale(locale) {
    localStorage.setItem("vpscope-locale", locale);
    set({ locale });
  },
  setViewMode(viewMode) {
    set({ viewMode });
  },
  setSearch(search) {
    set({ search, focusedProcessIndex: 0 });
  },
  setProcessSort(sortBy) {
    const { processSortBy, processSortDirection } = get();
    set({
      processSortBy: sortBy,
      processSortDirection: processSortBy === sortBy && processSortDirection === "desc" ? "asc" : "desc",
    });
  },
  moveFocusedProcess(delta, rowCount) {
    set((state) => ({
      focusedProcessIndex: Math.max(0, Math.min(rowCount - 1, state.focusedProcessIndex + delta)),
    }));
  },
  setSettingsOpen(settingsOpen) {
    set({ settingsOpen });
  },
}));
