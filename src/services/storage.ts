import type { RequestState, Tab } from "../types/http";
import type { Collection, HistoryEntry } from "../types/persistence";
import type { Environment, EnvironmentVariable } from "../types/environment";

// ---------------------------------------------------------------------------
// Storage keys
// ---------------------------------------------------------------------------

const HISTORY_KEY = "qb:history";
const COLLECTIONS_KEY = "qb:collections";
const WORKBENCH_KEY = "qb:workbench";
const TABS_KEY = "qb:tabs";
const ACTIVE_TAB_KEY = "qb:active-tab";
const ENVIRONMENTS_KEY = "qb:environments";
const ACTIVE_ENV_KEY = "qb:active-environment";

// ---------------------------------------------------------------------------
// Generic read/write primitives
// ---------------------------------------------------------------------------

function getItem<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function setItem<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Swallow quota exceeded and other localStorage errors
  }
}

function removeItem(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // Swallow errors
  }
}

// ---------------------------------------------------------------------------
// Type guards — check only essential fields to allow minor schema evolution
// ---------------------------------------------------------------------------

function isRequestState(value: unknown): value is RequestState {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v["method"] === "string" &&
    typeof v["url"] === "string" &&
    Array.isArray(v["params"]) &&
    Array.isArray(v["headers"]) &&
    typeof v["body"] === "object" && v["body"] !== null
  );
}

function isHistoryEntry(value: unknown): value is HistoryEntry {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v["id"] === "string" &&
    typeof v["method"] === "string" &&
    typeof v["url"] === "string" &&
    typeof v["status"] === "number" &&
    typeof v["timestamp"] === "number" &&
    isRequestState(v["requestSnapshot"])
  );
}

function isCollection(value: unknown): value is Collection {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v["id"] === "string" &&
    typeof v["name"] === "string" &&
    typeof v["createdAt"] === "number" &&
    Array.isArray(v["requests"])
  );
}

function isTab(value: unknown): value is Tab {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v["id"] === "string" &&
    typeof v["name"] === "string" &&
    isRequestState(v["request"])
  );
}

function isEnvironmentVariable(value: unknown): value is EnvironmentVariable {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v["id"] === "string" &&
    typeof v["key"] === "string" &&
    typeof v["value"] === "string" &&
    typeof v["enabled"] === "boolean"
  );
}

function isEnvironment(value: unknown): value is Environment {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v["id"] === "string" &&
    typeof v["name"] === "string" &&
    typeof v["createdAt"] === "number" &&
    Array.isArray(v["variables"]) &&
    (v["variables"] as unknown[]).every(isEnvironmentVariable)
  );
}

// ---------------------------------------------------------------------------
// Domain helpers
// ---------------------------------------------------------------------------

function getHistory(): HistoryEntry[] {
  const data = getItem<unknown>(HISTORY_KEY, []);
  if (!Array.isArray(data)) {
    removeItem(HISTORY_KEY);
    return [];
  }
  const valid = data.filter(isHistoryEntry);
  // If we lost data due to corruption, clear the key
  if (valid.length !== data.length) {
    setItem(HISTORY_KEY, valid);
  }
  return valid;
}

function setHistory(entries: HistoryEntry[]): void {
  setItem(HISTORY_KEY, entries);
}

function getCollections(): Collection[] {
  const data = getItem<unknown>(COLLECTIONS_KEY, []);
  if (!Array.isArray(data)) {
    removeItem(COLLECTIONS_KEY);
    return [];
  }
  const valid = data.filter(isCollection);
  if (valid.length !== data.length) {
    setItem(COLLECTIONS_KEY, valid);
  }
  return valid;
}

function setCollections(collections: Collection[]): void {
  setItem(COLLECTIONS_KEY, collections);
}

function getWorkbenchState(): RequestState | null {
  const data = getItem<unknown>(WORKBENCH_KEY, null);
  if (data === null) return null;
  if (!isRequestState(data)) {
    removeItem(WORKBENCH_KEY);
    return null;
  }
  return data;
}

function setWorkbenchState(state: RequestState): void {
  setItem(WORKBENCH_KEY, state);
}

function getTabs(): Tab[] {
  const data = getItem<unknown>(TABS_KEY, []);
  if (!Array.isArray(data)) {
    removeItem(TABS_KEY);
    return [];
  }
  const valid = data.filter(isTab);
  // If we lost data due to corruption, persist the cleaned array
  if (valid.length !== data.length) {
    setItem(TABS_KEY, valid);
  }
  return valid;
}

function setTabs(tabsToSave: Tab[]): void {
  setItem(TABS_KEY, tabsToSave);
}

function getActiveTabId(): string | null {
  const data = getItem<unknown>(ACTIVE_TAB_KEY, null);
  if (typeof data !== "string") return null;
  return data;
}

function setActiveTabId(id: string): void {
  setItem(ACTIVE_TAB_KEY, id);
}

function getEnvironments(): Environment[] {
  const data = getItem<unknown>(ENVIRONMENTS_KEY, []);
  if (!Array.isArray(data)) {
    removeItem(ENVIRONMENTS_KEY);
    return [];
  }
  const valid = data.filter(isEnvironment);
  if (valid.length !== data.length) {
    setItem(ENVIRONMENTS_KEY, valid);
  }
  return valid;
}

function setEnvironments(environments: Environment[]): void {
  setItem(ENVIRONMENTS_KEY, environments);
}

function getActiveEnvironmentId(): string | null {
  const data = getItem<unknown>(ACTIVE_ENV_KEY, null);
  if (typeof data !== "string") return null;
  return data;
}

function setActiveEnvironmentId(id: string | null): void {
  if (id === null) {
    removeItem(ACTIVE_ENV_KEY);
  } else {
    setItem(ACTIVE_ENV_KEY, id);
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export const StorageService = {
  getItem,
  setItem,
  removeItem,
  getHistory,
  setHistory,
  getCollections,
  setCollections,
  /** @deprecated Use getTabs/setTabs instead. Kept for migration support. */
  getWorkbenchState,
  /** @deprecated Use getTabs/setTabs instead. Kept for migration support. */
  setWorkbenchState,
  getTabs,
  setTabs,
  getActiveTabId,
  setActiveTabId,
  getEnvironments,
  setEnvironments,
  getActiveEnvironmentId,
  setActiveEnvironmentId,
} as const;
