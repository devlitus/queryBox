import { describe, it, expect, vi } from "vitest";
import { StorageService } from "./storage";
import { makeRequestState, makeHistoryEntry, makeCollection } from "../test/factories";

// ---------------------------------------------------------------------------
// Generic primitives: getItem / setItem / removeItem
// ---------------------------------------------------------------------------

describe("StorageService.getItem", () => {
  it("returns fallback when key does not exist", () => {
    const result = StorageService.getItem("nonexistent-key", "fallback");
    expect(result).toBe("fallback");
  });

  it("returns parsed JSON when key exists", () => {
    localStorage.setItem("test-key", JSON.stringify({ hello: "world" }));
    const result = StorageService.getItem<{ hello: string }>("test-key", { hello: "default" });
    expect(result).toEqual({ hello: "world" });
  });

  it("returns fallback when stored value is invalid JSON", () => {
    localStorage.setItem("bad-key", "not-valid-json{{{");
    const result = StorageService.getItem("bad-key", 42);
    expect(result).toBe(42);
  });
});

describe("StorageService.setItem", () => {
  it("stores JSON-serialized value", () => {
    StorageService.setItem("set-key", { foo: "bar" });
    const raw = localStorage.getItem("set-key");
    expect(raw).toBe(JSON.stringify({ foo: "bar" }));
  });

  it("silently handles quota exceeded errors", () => {
    const spy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("QuotaExceededError");
    });
    // Must not throw
    expect(() => StorageService.setItem("any-key", "value")).not.toThrow();
    spy.mockRestore();
  });
});

describe("StorageService.removeItem", () => {
  it("removes the key from localStorage", () => {
    localStorage.setItem("to-remove", "value");
    StorageService.removeItem("to-remove");
    expect(localStorage.getItem("to-remove")).toBeNull();
  });

  it("does not throw when key does not exist", () => {
    expect(() => StorageService.removeItem("nonexistent")).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Domain helper: getHistory / setHistory
// ---------------------------------------------------------------------------

describe("StorageService.getHistory", () => {
  it("returns empty array when localStorage is empty", () => {
    expect(StorageService.getHistory()).toEqual([]);
  });

  it("returns valid entries", () => {
    const entry = makeHistoryEntry();
    localStorage.setItem("qb:history", JSON.stringify([entry]));
    const result = StorageService.getHistory();
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(entry.id);
  });

  it("filters out corrupted entries and re-saves filtered data", () => {
    const valid = makeHistoryEntry({ id: "valid" });
    const corrupt = { id: "bad", notAValidEntry: true };
    localStorage.setItem("qb:history", JSON.stringify([valid, corrupt]));
    const result = StorageService.getHistory();
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("valid");
    // The filtered list should be re-persisted
    const stored = JSON.parse(localStorage.getItem("qb:history") ?? "[]");
    expect(stored).toHaveLength(1);
  });

  it("clears key and returns empty array when stored data is not an array", () => {
    localStorage.setItem("qb:history", JSON.stringify({ not: "an array" }));
    const result = StorageService.getHistory();
    expect(result).toEqual([]);
    expect(localStorage.getItem("qb:history")).toBeNull();
  });
});

describe("StorageService.setHistory", () => {
  it("persists array to localStorage", () => {
    const entries = [makeHistoryEntry({ id: "h1" }), makeHistoryEntry({ id: "h2" })];
    StorageService.setHistory(entries);
    const stored = JSON.parse(localStorage.getItem("qb:history") ?? "[]");
    expect(stored).toHaveLength(2);
    expect(stored[0].id).toBe("h1");
  });
});

// ---------------------------------------------------------------------------
// Domain helper: getCollections / setCollections
// ---------------------------------------------------------------------------

describe("StorageService.getCollections", () => {
  it("returns empty array when localStorage is empty", () => {
    expect(StorageService.getCollections()).toEqual([]);
  });

  it("returns valid collections", () => {
    const col = makeCollection();
    localStorage.setItem("qb:collections", JSON.stringify([col]));
    const result = StorageService.getCollections();
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(col.id);
  });

  it("filters out corrupted entries and re-saves filtered data", () => {
    const valid = makeCollection({ id: "col-valid" });
    const corrupt = { notACollection: true };
    localStorage.setItem("qb:collections", JSON.stringify([valid, corrupt]));
    const result = StorageService.getCollections();
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("col-valid");
    const stored = JSON.parse(localStorage.getItem("qb:collections") ?? "[]");
    expect(stored).toHaveLength(1);
  });

  it("clears key and returns empty array when stored data is not an array", () => {
    localStorage.setItem("qb:collections", JSON.stringify("not-an-array"));
    const result = StorageService.getCollections();
    expect(result).toEqual([]);
    expect(localStorage.getItem("qb:collections")).toBeNull();
  });
});

describe("StorageService.setCollections", () => {
  it("persists array to localStorage", () => {
    const cols = [makeCollection({ id: "c1" }), makeCollection({ id: "c2" })];
    StorageService.setCollections(cols);
    const stored = JSON.parse(localStorage.getItem("qb:collections") ?? "[]");
    expect(stored).toHaveLength(2);
    expect(stored[0].id).toBe("c1");
  });
});

// ---------------------------------------------------------------------------
// Domain helper: getWorkbenchState / setWorkbenchState
// ---------------------------------------------------------------------------

describe("StorageService.getWorkbenchState", () => {
  it("returns null when localStorage is empty", () => {
    expect(StorageService.getWorkbenchState()).toBeNull();
  });

  it("returns null and clears key when stored data fails validation", () => {
    localStorage.setItem("qb:workbench", JSON.stringify({ invalid: true }));
    const result = StorageService.getWorkbenchState();
    expect(result).toBeNull();
    expect(localStorage.getItem("qb:workbench")).toBeNull();
  });

  it("returns valid RequestState when data is correct", () => {
    const state = makeRequestState({ url: "https://test.com", method: "POST" });
    localStorage.setItem("qb:workbench", JSON.stringify(state));
    const result = StorageService.getWorkbenchState();
    expect(result).not.toBeNull();
    expect(result?.url).toBe("https://test.com");
    expect(result?.method).toBe("POST");
  });
});

describe("StorageService.setWorkbenchState", () => {
  it("persists state to localStorage", () => {
    const state = makeRequestState({ url: "https://persisted.com" });
    StorageService.setWorkbenchState(state);
    const stored = JSON.parse(localStorage.getItem("qb:workbench") ?? "null");
    expect(stored?.url).toBe("https://persisted.com");
  });
});
