import { create } from "zustand";
import type { Locale } from "@/i18n/messages";
import { applyTheme } from "@/theme/applyTheme";
import { getThemeById, type ThemeId } from "@/theme/presets";
import type { HostId, ProcessListPayload } from "@/types/contracts";

export const dashboardPanelIds = ["cpu", "memory", "network", "disk", "process"] as const;

export type DashboardPanelId = (typeof dashboardPanelIds)[number];

const collapsedPanelsStorageKey = "vpscope-collapsed-panels";
const panelOrderStorageKey = "vpscope-panel-order";
const selectedNetworkInterfaceStorageKey = "vpscope-network-selected-ifaces";
const dashboardPanelIdSet = new Set<DashboardPanelId>(dashboardPanelIds);

type PanelMoveDirection = "up" | "down";

function readCollapsedPanels() {
  try {
    const rawValue = localStorage.getItem(collapsedPanelsStorageKey);
    const parsedValue: unknown = rawValue ? JSON.parse(rawValue) : [];

    if (!Array.isArray(parsedValue)) {
      return [];
    }

    return parsedValue.filter((panelId): panelId is DashboardPanelId => dashboardPanelIdSet.has(panelId as DashboardPanelId));
  } catch {
    return [];
  }
}

function writeCollapsedPanels(collapsedPanels: DashboardPanelId[]) {
  localStorage.setItem(collapsedPanelsStorageKey, JSON.stringify(collapsedPanels));
}

function normalizePanelOrder(candidateOrder: DashboardPanelId[]) {
  const uniqueKnownPanelIds = candidateOrder.filter(
    (panelId, index): panelId is DashboardPanelId =>
      dashboardPanelIdSet.has(panelId) && candidateOrder.indexOf(panelId) === index,
  );
  const missingPanelIds = dashboardPanelIds.filter((panelId) => !uniqueKnownPanelIds.includes(panelId));

  return [...uniqueKnownPanelIds, ...missingPanelIds];
}

function readPanelOrder() {
  try {
    const rawValue = localStorage.getItem(panelOrderStorageKey);
    const parsedValue: unknown = rawValue ? JSON.parse(rawValue) : dashboardPanelIds;

    if (!Array.isArray(parsedValue)) {
      return [...dashboardPanelIds];
    }

    return normalizePanelOrder(
      parsedValue.filter((panelId): panelId is DashboardPanelId => dashboardPanelIdSet.has(panelId as DashboardPanelId)),
    );
  } catch {
    return [...dashboardPanelIds];
  }
}

function writePanelOrder(panelOrder: DashboardPanelId[]) {
  localStorage.setItem(panelOrderStorageKey, JSON.stringify(panelOrder));
}

function readSelectedNetworkInterfaces() {
  try {
    const rawValue = localStorage.getItem(selectedNetworkInterfaceStorageKey);
    const parsedValue: unknown = rawValue ? JSON.parse(rawValue) : {};

    if (!parsedValue || typeof parsedValue !== "object") {
      return {} as Record<HostId, string>;
    }

    return Object.fromEntries(
      Object.entries(parsedValue).filter(
        (entry): entry is [HostId, string] => typeof entry[0] === "string" && typeof entry[1] === "string" && entry[1].length > 0,
      ),
    );
  } catch {
    return {} as Record<HostId, string>;
  }
}

function writeSelectedNetworkInterfaces(selectedNetworkInterfaces: Record<HostId, string>) {
  localStorage.setItem(selectedNetworkInterfaceStorageKey, JSON.stringify(selectedNetworkInterfaces));
}

function networkInterfaceIndex(selectedInterface: string | undefined, interfaces: string[]) {
  if (!selectedInterface || interfaces.length === 0) {
    return -1;
  }

  return interfaces.indexOf(selectedInterface);
}

type UiStore = {
  themeId: ThemeId;
  locale: Locale;
  viewMode: "overview" | "list";
  search: string;
  processSortBy: ProcessListPayload["sortBy"];
  processSortDirection: ProcessListPayload["sortDirection"];
  focusedProcessIndex: number;
  settingsOpen: boolean;
  collapsedPanels: DashboardPanelId[];
  panelOrder: DashboardPanelId[];
  activeDashboardPanelId?: DashboardPanelId;
  selectedNetworkInterfaces: Record<HostId, string>;
  setTheme: (themeId: ThemeId) => void;
  setLocale: (locale: Locale) => void;
  setViewMode: (viewMode: "overview" | "list") => void;
  setSearch: (search: string) => void;
  setProcessSort: (sortBy: ProcessListPayload["sortBy"]) => void;
  moveFocusedProcess: (delta: number, rowCount: number) => void;
  setSettingsOpen: (settingsOpen: boolean) => void;
  togglePanelCollapsed: (panelId: DashboardPanelId) => void;
  showAllPanels: () => void;
  movePanel: (panelId: DashboardPanelId, direction: PanelMoveDirection) => void;
  resetPanelOrder: () => void;
  setActiveDashboardPanel: (panelId?: DashboardPanelId) => void;
  selectNetworkInterface: (hostId: HostId, iface: string) => void;
  selectNextNetworkInterface: (hostId: HostId, interfaces: string[]) => void;
  selectPrevNetworkInterface: (hostId: HostId, interfaces: string[]) => void;
};

const initialTheme = getThemeById(localStorage.getItem("vpscope-theme"));
const initialLocale = (localStorage.getItem("vpscope-locale") === "en-US" ? "en-US" : "zh-CN") satisfies Locale;
const initialCollapsedPanels = readCollapsedPanels();
const initialPanelOrder = readPanelOrder();
const initialSelectedNetworkInterfaces = readSelectedNetworkInterfaces();

export const useUiStore = create<UiStore>((set, get) => ({
  themeId: initialTheme.id,
  locale: initialLocale,
  viewMode: "overview",
  search: "",
  processSortBy: "cpu",
  processSortDirection: "desc",
  focusedProcessIndex: 0,
  settingsOpen: false,
  collapsedPanels: initialCollapsedPanels,
  panelOrder: initialPanelOrder,
  activeDashboardPanelId: undefined,
  selectedNetworkInterfaces: initialSelectedNetworkInterfaces,
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
  togglePanelCollapsed(panelId) {
    set((state) => {
      const collapsedPanels = state.collapsedPanels.includes(panelId)
        ? state.collapsedPanels.filter((candidate) => candidate !== panelId)
        : [...state.collapsedPanels, panelId];

      writeCollapsedPanels(collapsedPanels);
      return { collapsedPanels };
    });
  },
  showAllPanels() {
    writeCollapsedPanels([]);
    set({ collapsedPanels: [] });
  },
  movePanel(panelId, direction) {
    set((state) => {
      const panelOrder = normalizePanelOrder(state.panelOrder);
      const hiddenPanelIds = new Set(state.collapsedPanels);
      const visiblePanelOrder = panelOrder.filter((candidate) => !hiddenPanelIds.has(candidate));
      const currentVisibleIndex = visiblePanelOrder.indexOf(panelId);
      const targetVisibleIndex = direction === "up" ? currentVisibleIndex - 1 : currentVisibleIndex + 1;
      const targetPanelId = visiblePanelOrder[targetVisibleIndex];
      const currentIndex = panelOrder.indexOf(panelId);
      const targetIndex = targetPanelId ? panelOrder.indexOf(targetPanelId) : -1;

      if (currentIndex < 0 || targetIndex < 0) {
        return { panelOrder };
      }

      const nextPanelOrder = [...panelOrder];
      [nextPanelOrder[currentIndex], nextPanelOrder[targetIndex]] = [nextPanelOrder[targetIndex], nextPanelOrder[currentIndex]];
      writePanelOrder(nextPanelOrder);
      return { panelOrder: nextPanelOrder };
    });
  },
  resetPanelOrder() {
    const panelOrder = [...dashboardPanelIds];
    writePanelOrder(panelOrder);
    set({ panelOrder });
  },
  setActiveDashboardPanel(activeDashboardPanelId) {
    set({ activeDashboardPanelId });
  },
  selectNetworkInterface(hostId, iface) {
    set((state) => {
      const selectedNetworkInterfaces = {
        ...state.selectedNetworkInterfaces,
        [hostId]: iface,
      };
      writeSelectedNetworkInterfaces(selectedNetworkInterfaces);
      return { selectedNetworkInterfaces };
    });
  },
  selectNextNetworkInterface(hostId, interfaces) {
    if (interfaces.length === 0) {
      return;
    }

    set((state) => {
      const currentIndex = networkInterfaceIndex(state.selectedNetworkInterfaces[hostId], interfaces);
      const nextIndex = currentIndex >= 0 ? (currentIndex + 1) % interfaces.length : 0;
      const selectedNetworkInterfaces = {
        ...state.selectedNetworkInterfaces,
        [hostId]: interfaces[nextIndex],
      };
      writeSelectedNetworkInterfaces(selectedNetworkInterfaces);
      return { selectedNetworkInterfaces };
    });
  },
  selectPrevNetworkInterface(hostId, interfaces) {
    if (interfaces.length === 0) {
      return;
    }

    set((state) => {
      const currentIndex = networkInterfaceIndex(state.selectedNetworkInterfaces[hostId], interfaces);
      const prevIndex = currentIndex >= 0 ? (currentIndex - 1 + interfaces.length) % interfaces.length : interfaces.length - 1;
      const selectedNetworkInterfaces = {
        ...state.selectedNetworkInterfaces,
        [hostId]: interfaces[prevIndex],
      };
      writeSelectedNetworkInterfaces(selectedNetworkInterfaces);
      return { selectedNetworkInterfaces };
    });
  },
}));
