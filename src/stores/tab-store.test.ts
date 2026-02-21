import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Tab } from "../types/http";
import { makeRequestState } from "../test/factories";

// ---------------------------------------------------------------------------
// Module-level mocks (hoisted by Vitest)
// Both mocks are also re-applied inside beforeEach after vi.resetModules().
// ---------------------------------------------------------------------------

vi.mock("../services/storage", () => ({
  StorageService: {
    getTabs: () => [],
    setTabs: vi.fn(),
    getActiveTabId: () => null,
    setActiveTabId: vi.fn(),
    getWorkbenchState: () => null,
    removeItem: vi.fn(),
  },
}));

vi.mock("./ui-store", () => ({
  shouldFocusUrl: { value: false },
  showSaveModal: { value: false },
}));

// Use vi.resetModules() + dynamic import to get fresh module-level signals per test.
// This is the established pattern in the project (see http-store.test.ts).
let tabStore: typeof import("./tab-store");

beforeEach(async () => {
  vi.resetModules();
  vi.mock("../services/storage", () => ({
    StorageService: {
      getTabs: () => [],
      setTabs: vi.fn(),
      getActiveTabId: () => null,
      setActiveTabId: vi.fn(),
      getWorkbenchState: () => null,
      removeItem: vi.fn(),
    },
  }));
  vi.mock("./ui-store", () => ({
    shouldFocusUrl: { value: false },
    showSaveModal: { value: false },
  }));
  tabStore = await import("./tab-store");
});

// ---------------------------------------------------------------------------
// Initialization
// ---------------------------------------------------------------------------

describe("initialization", () => {
  it("creates one default tab on fresh start (no persisted data)", () => {
    expect(tabStore.tabs.value).toHaveLength(1);
    expect(tabStore.tabs.value[0].name).toBe("New Request");
  });

  it("sets activeTabId to the initial tab's id", () => {
    const tab = tabStore.tabs.value[0];
    expect(tabStore.activeTabId.value).toBe(tab.id);
  });

  it("activeTab computed returns the active tab", () => {
    const tab = tabStore.tabs.value[0];
    expect(tabStore.activeTab.value).toBeDefined();
    expect(tabStore.activeTab.value?.id).toBe(tab.id);
  });
});

// ---------------------------------------------------------------------------
// createTab
// ---------------------------------------------------------------------------

describe("createTab", () => {
  it("creates a new tab with a unique id", () => {
    const id1 = tabStore.tabs.value[0].id;
    const id2 = tabStore.createTab();
    expect(typeof id2).toBe("string");
    expect(id2).not.toBe(id1);
  });

  it("appends the new tab to the tabs array", () => {
    tabStore.createTab();
    expect(tabStore.tabs.value).toHaveLength(2);
  });

  it("sets the new tab as active", () => {
    const newId = tabStore.createTab();
    expect(tabStore.activeTabId.value).toBe(newId);
  });

  it("new tab has default name 'New Request'", () => {
    tabStore.createTab();
    const newTab = tabStore.tabs.value[1];
    expect(newTab.name).toBe("New Request");
  });

  it("new tab has empty request state", () => {
    tabStore.createTab();
    const newTab = tabStore.tabs.value[1];
    expect(newTab.request.url).toBe("");
    expect(newTab.request.method).toBe("GET");
    expect(newTab.request.params).toHaveLength(0);
    expect(newTab.request.headers).toHaveLength(0);
  });

  it("returns null and does not add tab when at max limit (20)", () => {
    // Fill up to 20 tabs (1 already exists)
    for (let i = 0; i < 19; i++) {
      tabStore.createTab();
    }
    expect(tabStore.tabs.value).toHaveLength(20);
    const result = tabStore.createTab();
    expect(result).toBeNull();
    expect(tabStore.tabs.value).toHaveLength(20);
  });
});

// ---------------------------------------------------------------------------
// closeTab
// ---------------------------------------------------------------------------

describe("closeTab", () => {
  it("removes the tab with the given id", () => {
    tabStore.createTab();
    const idToClose = tabStore.tabs.value[0].id;
    tabStore.closeTab(idToClose);
    expect(tabStore.tabs.value.every((t: Tab) => t.id !== idToClose)).toBe(true);
  });

  it("activates the nearest neighbor when closing the active tab", () => {
    const firstId = tabStore.tabs.value[0].id;
    tabStore.createTab(); // second tab becomes active
    const secondId = tabStore.activeTabId.value;
    tabStore.closeTab(secondId);
    // after closing second, first should be active
    expect(tabStore.activeTabId.value).toBe(firstId);
  });

  it("does not change active tab when closing an inactive tab", () => {
    const firstId = tabStore.tabs.value[0].id;
    tabStore.createTab(); // second tab is now active
    tabStore.closeTab(firstId); // close inactive first tab
    // second tab should still be active
    const remaining = tabStore.tabs.value;
    expect(remaining).toHaveLength(1);
    expect(tabStore.activeTabId.value).toBe(remaining[0].id);
  });

  it("replaces the last tab with a fresh default tab instead of removing it", () => {
    const originalId = tabStore.tabs.value[0].id;
    tabStore.closeTab(originalId);
    // Still has one tab
    expect(tabStore.tabs.value).toHaveLength(1);
    // But it's a new tab with a different id
    expect(tabStore.tabs.value[0].id).not.toBe(originalId);
    expect(tabStore.tabs.value[0].name).toBe("New Request");
  });

  it("is a no-op for an unknown id", () => {
    const before = tabStore.tabs.value.length;
    tabStore.closeTab("non-existent-id");
    expect(tabStore.tabs.value).toHaveLength(before);
  });
});

// ---------------------------------------------------------------------------
// switchTab
// ---------------------------------------------------------------------------

describe("switchTab", () => {
  it("updates activeTabId to the given id", () => {
    const firstId = tabStore.tabs.value[0].id;
    tabStore.createTab(); // activates second tab
    expect(tabStore.activeTabId.value).not.toBe(firstId);
    tabStore.switchTab(firstId);
    expect(tabStore.activeTabId.value).toBe(firstId);
  });

  it("is a no-op for an unknown id", () => {
    const before = tabStore.activeTabId.value;
    tabStore.switchTab("non-existent-id");
    expect(tabStore.activeTabId.value).toBe(before);
  });
});

// ---------------------------------------------------------------------------
// updateActiveTabRequest
// ---------------------------------------------------------------------------

describe("updateActiveTabRequest", () => {
  it("merges partial request state into the active tab", () => {
    tabStore.updateActiveTabRequest({ url: "https://example.com", method: "POST" });
    const tab = tabStore.activeTab.value;
    expect(tab?.request.url).toBe("https://example.com");
    expect(tab?.request.method).toBe("POST");
  });

  it("preserves existing request fields not in the partial", () => {
    tabStore.updateActiveTabRequest({ url: "https://example.com" });
    tabStore.updateActiveTabRequest({ method: "DELETE" });
    expect(tabStore.activeTab.value?.request.url).toBe("https://example.com");
    expect(tabStore.activeTab.value?.request.method).toBe("DELETE");
  });

  it("marks the active tab as dirty", () => {
    expect(tabStore.activeTab.value?.isDirty).toBe(false);
    tabStore.updateActiveTabRequest({ url: "https://changed.com" });
    expect(tabStore.activeTab.value?.isDirty).toBe(true);
  });

  it("only modifies the active tab, not other tabs", () => {
    const firstId = tabStore.tabs.value[0].id;
    tabStore.createTab();
    // Active is now second tab
    tabStore.updateActiveTabRequest({ url: "https://second.com" });
    const firstTab = tabStore.tabs.value.find((t: Tab) => t.id === firstId);
    expect(firstTab?.request.url).toBe(""); // untouched
  });
});

// ---------------------------------------------------------------------------
// updateActiveTabResponse
// ---------------------------------------------------------------------------

describe("updateActiveTabResponse", () => {
  it("updates response, requestStatus, and requestError on the active tab", () => {
    const mockResponse = {
      status: 200,
      statusText: "OK",
      headers: [],
      body: "{}",
      contentType: "application/json",
      time: 50,
      size: 2,
    };
    tabStore.updateActiveTabResponse(mockResponse, "success", null);
    const tab = tabStore.activeTab.value;
    expect(tab?.response).toEqual(mockResponse);
    expect(tab?.requestStatus).toBe("success");
    expect(tab?.requestError).toBeNull();
  });

  it("can set error state", () => {
    tabStore.updateActiveTabResponse(null, "error", { message: "fail", type: "network" });
    const tab = tabStore.activeTab.value;
    expect(tab?.response).toBeNull();
    expect(tab?.requestStatus).toBe("error");
    expect(tab?.requestError?.message).toBe("fail");
  });
});

// ---------------------------------------------------------------------------
// renameTab
// ---------------------------------------------------------------------------

describe("renameTab", () => {
  it("updates the tab name", () => {
    const id = tabStore.tabs.value[0].id;
    tabStore.renameTab(id, "My Custom Request");
    expect(tabStore.tabs.value[0].name).toBe("My Custom Request");
  });

  it("only renames the targeted tab", () => {
    const firstId = tabStore.tabs.value[0].id;
    tabStore.createTab();
    const secondId = tabStore.tabs.value[1].id;
    tabStore.renameTab(firstId, "Renamed");
    const second = tabStore.tabs.value.find((t: Tab) => t.id === secondId);
    expect(second?.name).toBe("New Request");
  });
});

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

describe("persistence", () => {
  it("persists tabs via StorageService.setTabs on initialization (effect fires once)", async () => {
    vi.resetModules();
    const setTabsMock = vi.fn();
    // Use vi.doMock (not hoisted) for inline test-specific factory with local vars
    vi.doMock("../services/storage", () => ({
      StorageService: {
        getTabs: () => [],
        setTabs: setTabsMock,
        getActiveTabId: () => null,
        setActiveTabId: vi.fn(),
        getWorkbenchState: () => null,
        removeItem: vi.fn(),
      },
    }));
    vi.doMock("./ui-store", () => ({
      shouldFocusUrl: { value: false },
      showSaveModal: { value: false },
    }));
    await import("./tab-store");
    // effect() fires immediately on init
    expect(setTabsMock).toHaveBeenCalled();
  });

  it("restores persisted tabs from StorageService.getTabs", async () => {
    vi.resetModules();
    const persistedTab: Tab = {
      id: "restored-id-1",
      name: "Restored Tab",
      request: makeRequestState({ url: "https://restored.com", method: "POST" }),
      response: null,
      requestStatus: "idle",
      requestError: null,
      isDirty: false,
    };
    vi.doMock("../services/storage", () => ({
      StorageService: {
        getTabs: () => [persistedTab],
        setTabs: vi.fn(),
        getActiveTabId: () => "restored-id-1",
        setActiveTabId: vi.fn(),
        getWorkbenchState: () => null,
        removeItem: vi.fn(),
      },
    }));
    vi.doMock("./ui-store", () => ({
      shouldFocusUrl: { value: false },
      showSaveModal: { value: false },
    }));
    const freshStore = await import("./tab-store");
    expect(freshStore.tabs.value).toHaveLength(1);
    expect(freshStore.tabs.value[0].id).toBe("restored-id-1");
    expect(freshStore.tabs.value[0].name).toBe("Restored Tab");
    expect(freshStore.tabs.value[0].request.url).toBe("https://restored.com");
    expect(freshStore.activeTabId.value).toBe("restored-id-1");
  });

  it("migrates legacy qb:workbench to a tab when qb:tabs is empty", async () => {
    vi.resetModules();
    const legacyRequest = makeRequestState({ url: "https://legacy.com", method: "PUT" });
    const setTabsMock = vi.fn();
    const removeItemMock = vi.fn();
    vi.doMock("../services/storage", () => ({
      StorageService: {
        getTabs: () => [],
        setTabs: setTabsMock,
        getActiveTabId: () => null,
        setActiveTabId: vi.fn(),
        getWorkbenchState: () => legacyRequest,
        removeItem: removeItemMock,
      },
    }));
    vi.doMock("./ui-store", () => ({
      shouldFocusUrl: { value: false },
      showSaveModal: { value: false },
    }));
    const freshStore = await import("./tab-store");
    expect(freshStore.tabs.value).toHaveLength(1);
    expect(freshStore.tabs.value[0].request.url).toBe("https://legacy.com");
    expect(freshStore.tabs.value[0].request.method).toBe("PUT");
    // Verifies qb:workbench was removed after migration
    expect(removeItemMock).toHaveBeenCalledWith("qb:workbench");
  });

  it("responses are not restored from persistence (ephemeral)", async () => {
    vi.resetModules();
    // Define inside the test to avoid hoisting issues — use doMock
    vi.doMock("../services/storage", () => ({
      StorageService: {
        getTabs: () => [
          {
            id: "tab-with-response",
            name: "Tab",
            request: makeRequestState(),
            response: {
              status: 200,
              statusText: "OK",
              headers: [],
              body: "data",
              contentType: "application/json",
              time: 100,
              size: 4,
            },
            requestStatus: "success",
            requestError: null,
            isDirty: false,
          },
        ],
        setTabs: vi.fn(),
        getActiveTabId: () => "tab-with-response",
        setActiveTabId: vi.fn(),
        getWorkbenchState: () => null,
        removeItem: vi.fn(),
      },
    }));
    vi.doMock("./ui-store", () => ({
      shouldFocusUrl: { value: false },
      showSaveModal: { value: false },
    }));
    const freshStore = await import("./tab-store");
    // Response is reset to null on restore
    expect(freshStore.tabs.value[0].response).toBeNull();
    expect(freshStore.tabs.value[0].requestStatus).toBe("idle");
  });
});
