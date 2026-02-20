import { describe, it, expect, beforeEach, vi } from "vitest";
import { makeHistoryEntry, makeRequestState } from "../test/factories";

// Use dynamic import + vi.resetModules() so each test group gets a fresh
// module instance with clean signal state (module-level signal reads localStorage on load).
let historyStore: typeof import("./history-store");

beforeEach(async () => {
  vi.resetModules();
  localStorage.clear();
  historyStore = await import("./history-store");
});

// ---------------------------------------------------------------------------
// Signal initialization
// ---------------------------------------------------------------------------

describe("historyEntries signal initialization", () => {
  it("initializes to empty array when localStorage is empty", () => {
    expect(historyStore.historyEntries.value).toEqual([]);
  });

  it("initializes from localStorage on module load", async () => {
    const entry = makeHistoryEntry({ id: "pre-loaded" });
    localStorage.setItem("qb:history", JSON.stringify([entry]));
    vi.resetModules();
    const freshStore = await import("./history-store");
    expect(freshStore.historyEntries.value).toHaveLength(1);
    expect(freshStore.historyEntries.value[0].id).toBe("pre-loaded");
  });
});

// ---------------------------------------------------------------------------
// addHistoryEntry
// ---------------------------------------------------------------------------

describe("addHistoryEntry", () => {
  it("adds entry to the beginning of the list", () => {
    const snapshot = makeRequestState();
    historyStore.addHistoryEntry({
      method: "GET",
      url: "https://first.com",
      status: 200,
      statusText: "OK",
      requestSnapshot: snapshot,
    });
    historyStore.addHistoryEntry({
      method: "POST",
      url: "https://second.com",
      status: 201,
      statusText: "Created",
      requestSnapshot: snapshot,
    });
    expect(historyStore.historyEntries.value[0].url).toBe("https://second.com");
    expect(historyStore.historyEntries.value[1].url).toBe("https://first.com");
  });

  it("generates a unique id and timestamp for each entry", () => {
    const snapshot = makeRequestState();
    historyStore.addHistoryEntry({ method: "GET", url: "https://a.com", status: 200, statusText: "OK", requestSnapshot: snapshot });
    historyStore.addHistoryEntry({ method: "GET", url: "https://b.com", status: 200, statusText: "OK", requestSnapshot: snapshot });
    const [e1, e2] = historyStore.historyEntries.value;
    expect(typeof e1.id).toBe("string");
    expect(e1.id.length).toBeGreaterThan(0);
    expect(e1.id).not.toBe(e2.id);
    expect(typeof e1.timestamp).toBe("number");
  });

  it("persists updated list to localStorage via StorageService", () => {
    const snapshot = makeRequestState();
    historyStore.addHistoryEntry({ method: "GET", url: "https://persisted.com", status: 200, statusText: "OK", requestSnapshot: snapshot });
    const stored = JSON.parse(localStorage.getItem("qb:history") ?? "[]");
    expect(stored).toHaveLength(1);
    expect(stored[0].url).toBe("https://persisted.com");
  });

  it("works correctly when adding to an empty history", () => {
    expect(historyStore.historyEntries.value).toHaveLength(0);
    const snapshot = makeRequestState();
    historyStore.addHistoryEntry({ method: "DELETE", url: "https://new.com", status: 204, statusText: "No Content", requestSnapshot: snapshot });
    expect(historyStore.historyEntries.value).toHaveLength(1);
  });

  it("enforces MAX_HISTORY (50) limit by dropping oldest entries (FIFO)", () => {
    const snapshot = makeRequestState();
    // Add 51 entries
    for (let i = 0; i < 51; i++) {
      historyStore.addHistoryEntry({
        method: "GET",
        url: `https://entry-${i}.com`,
        status: 200,
        statusText: "OK",
        requestSnapshot: snapshot,
      });
    }
    expect(historyStore.historyEntries.value).toHaveLength(50);
    // The oldest entry (entry-0) should have been dropped; newest (entry-50) should be first
    expect(historyStore.historyEntries.value[0].url).toBe("https://entry-50.com");
    expect(historyStore.historyEntries.value.some((e) => e.url === "https://entry-0.com")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// clearHistory
// ---------------------------------------------------------------------------

describe("clearHistory", () => {
  it("sets signal value to empty array", () => {
    const snapshot = makeRequestState();
    historyStore.addHistoryEntry({ method: "GET", url: "https://a.com", status: 200, statusText: "OK", requestSnapshot: snapshot });
    historyStore.clearHistory();
    expect(historyStore.historyEntries.value).toEqual([]);
  });

  it("persists empty array to localStorage", () => {
    const snapshot = makeRequestState();
    historyStore.addHistoryEntry({ method: "GET", url: "https://a.com", status: 200, statusText: "OK", requestSnapshot: snapshot });
    historyStore.clearHistory();
    const stored = JSON.parse(localStorage.getItem("qb:history") ?? "null");
    expect(stored).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// removeHistoryEntry
// ---------------------------------------------------------------------------

describe("removeHistoryEntry", () => {
  it("removes entry by id", async () => {
    const entry = makeHistoryEntry({ id: "to-remove" });
    localStorage.setItem("qb:history", JSON.stringify([entry]));
    vi.resetModules();
    const store = await import("./history-store");
    store.removeHistoryEntry("to-remove");
    expect(store.historyEntries.value).toHaveLength(0);
  });

  it("persists updated list after removal", async () => {
    const entry = makeHistoryEntry({ id: "gone" });
    localStorage.setItem("qb:history", JSON.stringify([entry]));
    vi.resetModules();
    const store = await import("./history-store");
    store.removeHistoryEntry("gone");
    const stored = JSON.parse(localStorage.getItem("qb:history") ?? "[]");
    expect(stored).toHaveLength(0);
  });

  it("is a no-op when id does not exist", () => {
    const snapshot = makeRequestState();
    historyStore.addHistoryEntry({ method: "GET", url: "https://a.com", status: 200, statusText: "OK", requestSnapshot: snapshot });
    const lengthBefore = historyStore.historyEntries.value.length;
    historyStore.removeHistoryEntry("nonexistent-id");
    expect(historyStore.historyEntries.value).toHaveLength(lengthBefore);
  });
});
