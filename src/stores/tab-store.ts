import { signal, computed, effect } from "@preact/signals";
import type { Tab, RequestState, ResponseState, RequestStatus, HttpError } from "../types/http";
import { StorageService } from "../services/storage";
import { shouldFocusUrl } from "./ui-store";

// ---------------------------------------------------------------------------
// Default state constant
// ---------------------------------------------------------------------------

export const DEFAULT_REQUEST: RequestState = {
  method: "GET",
  url: "",
  params: [],
  headers: [],
  body: {
    mode: "none",
    contentType: "json",
    raw: "",
  },
};

const MAX_TABS = 20;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function createDefaultTab(): Tab {
  return {
    id: crypto.randomUUID(),
    name: "New Request",
    request: structuredClone(DEFAULT_REQUEST),
    response: null,
    requestStatus: "idle",
    requestError: null,
    isDirty: false,
  };
}

// ---------------------------------------------------------------------------
// Initialization: load from localStorage, migrate legacy data if needed
// ---------------------------------------------------------------------------

function initializeTabs(): { initialTabs: Tab[]; initialActiveId: string } {
  // Migration: if qb:tabs does not exist but qb:workbench does, migrate
  const persisted = StorageService.getTabs();
  if (persisted.length === 0) {
    const legacy = StorageService.getWorkbenchState();
    if (legacy !== null) {
      // Migrate legacy workbench state to a single tab
      const migratedTab: Tab = {
        id: crypto.randomUUID(),
        name: "New Request",
        request: legacy,
        response: null,
        requestStatus: "idle",
        requestError: null,
        isDirty: false,
      };
      StorageService.setTabs([migratedTab]);
      StorageService.setActiveTabId(migratedTab.id);
      // Remove the legacy key after successful migration
      StorageService.removeItem("qb:workbench");
      return { initialTabs: [migratedTab], initialActiveId: migratedTab.id };
    }

    // No persisted data at all: start fresh with one default tab
    const freshTab = createDefaultTab();
    return { initialTabs: [freshTab], initialActiveId: freshTab.id };
  }

  // Restore persisted tabs, stripping response data (responses are ephemeral)
  const restoredTabs = persisted.map((t) => ({
    ...t,
    response: null,
    requestStatus: "idle" as RequestStatus,
    requestError: null,
  }));

  const persistedActiveId = StorageService.getActiveTabId();
  // Ensure the persisted active ID is valid; fall back to first tab
  const activeId =
    persistedActiveId !== null && restoredTabs.some((t) => t.id === persistedActiveId)
      ? persistedActiveId
      : restoredTabs[0].id;

  return { initialTabs: restoredTabs, initialActiveId: activeId };
}

const { initialTabs, initialActiveId } = initializeTabs();

// ---------------------------------------------------------------------------
// State signals
// ---------------------------------------------------------------------------

export const tabs = signal<Tab[]>(initialTabs);
export const activeTabId = signal<string>(initialActiveId);

// ---------------------------------------------------------------------------
// Computed signals
// ---------------------------------------------------------------------------

export const activeTab = computed<Tab | undefined>(() =>
  tabs.value.find((t) => t.id === activeTabId.value)
);

// ---------------------------------------------------------------------------
// Persistence effects
// Auto-persist tabs and activeTabId on every change.
// effect() is appropriate here because tabs are mutated by many action
// functions; a single effect per signal is cleaner than per-action persist calls.
// Safe from SSR: this module is only imported by client:load islands.
// ---------------------------------------------------------------------------

effect(() => {
  StorageService.setTabs(tabs.value);
});

effect(() => {
  StorageService.setActiveTabId(activeTabId.value);
});

// ---------------------------------------------------------------------------
// Action functions
// ---------------------------------------------------------------------------

/**
 * Creates a new tab with default empty request state, appends it to the tab
 * list, and activates it. No-op if the maximum tab count (20) is reached.
 * Returns the new tab's ID, or null if the limit was reached.
 */
export function createTab(): string | null {
  if (tabs.value.length >= MAX_TABS) return null;

  const newTab = createDefaultTab();
  tabs.value = [...tabs.value, newTab];
  activeTabId.value = newTab.id;
  // Signal RequestBar to auto-focus the URL input on the new tab
  shouldFocusUrl.value = true;
  return newTab.id;
}

/**
 * Closes the tab with the given ID. If the closing tab is active, the nearest
 * neighbor is activated. If it is the last tab, a fresh default tab is created
 * first to ensure there is always at least one tab.
 */
export function closeTab(id: string): void {
  const currentTabs = tabs.value;
  const idx = currentTabs.findIndex((t) => t.id === id);
  if (idx === -1) return;

  const isActive = activeTabId.value === id;

  // If this is the last tab, replace it with a fresh default tab
  if (currentTabs.length === 1) {
    const freshTab = createDefaultTab();
    tabs.value = [freshTab];
    activeTabId.value = freshTab.id;
    return;
  }

  const nextTabs = currentTabs.filter((t) => t.id !== id);
  tabs.value = nextTabs;

  if (isActive) {
    // Activate the tab at the same index (now the next one), or the last tab
    const neighborIdx = Math.min(idx, nextTabs.length - 1);
    activeTabId.value = nextTabs[neighborIdx].id;
  }
}

/**
 * Activates the tab with the given ID.
 */
export function switchTab(id: string): void {
  if (tabs.value.some((t) => t.id === id)) {
    activeTabId.value = id;
  }
}

/**
 * Merges partial RequestState into the active tab's request field and marks
 * the tab as dirty.
 */
export function updateActiveTabRequest(partial: Partial<RequestState>): void {
  const current = activeTab.value;
  if (!current) return;

  tabs.value = tabs.value.map((t) =>
    t.id === current.id
      ? { ...t, request: { ...t.request, ...partial }, isDirty: true }
      : t
  );
}

/**
 * Updates the active tab's response, requestStatus, and requestError fields.
 */
export function updateActiveTabResponse(
  response: ResponseState | null,
  status: RequestStatus,
  error: HttpError | null
): void {
  const current = activeTab.value;
  if (!current) return;

  tabs.value = tabs.value.map((t) =>
    t.id === current.id
      ? { ...t, response, requestStatus: status, requestError: error }
      : t
  );
}

/**
 * Updates the display name of the tab with the given ID.
 */
export function renameTab(id: string, name: string): void {
  tabs.value = tabs.value.map((t) =>
    t.id === id ? { ...t, name } : t
  );
}
