import { describe, it, expect, beforeEach, vi } from "vitest";
import { makeCollection, makeRequestState } from "../test/factories";

// Use dynamic import + vi.resetModules() so each test group gets a fresh
// module instance with clean signal state (module-level signal reads localStorage on load).
let collectionStore: typeof import("./collection-store");

beforeEach(async () => {
  vi.resetModules();
  localStorage.clear();
  collectionStore = await import("./collection-store");
});

// ---------------------------------------------------------------------------
// Signal initialization
// ---------------------------------------------------------------------------

describe("collections signal initialization", () => {
  it("initializes to empty array when localStorage is empty", () => {
    expect(collectionStore.collections.value).toEqual([]);
  });

  it("initializes from localStorage on module load", async () => {
    const col = makeCollection({ id: "pre-loaded" });
    localStorage.setItem("qb:collections", JSON.stringify([col]));
    vi.resetModules();
    const freshStore = await import("./collection-store");
    expect(freshStore.collections.value).toHaveLength(1);
    expect(freshStore.collections.value[0].id).toBe("pre-loaded");
  });
});

// ---------------------------------------------------------------------------
// createCollection
// ---------------------------------------------------------------------------

describe("createCollection", () => {
  it("creates collection with generated id and createdAt", () => {
    const col = collectionStore.createCollection("My Collection");
    expect(typeof col.id).toBe("string");
    expect(col.id.length).toBeGreaterThan(0);
    expect(typeof col.createdAt).toBe("number");
    expect(col.name).toBe("My Collection");
    expect(col.requests).toEqual([]);
  });

  it("appends to the collections signal", () => {
    collectionStore.createCollection("First");
    collectionStore.createCollection("Second");
    expect(collectionStore.collections.value).toHaveLength(2);
    expect(collectionStore.collections.value[1].name).toBe("Second");
  });

  it("persists to localStorage", () => {
    collectionStore.createCollection("Persisted");
    const stored = JSON.parse(localStorage.getItem("qb:collections") ?? "[]");
    expect(stored).toHaveLength(1);
    expect(stored[0].name).toBe("Persisted");
  });

  it("returns the created collection object", () => {
    const returned = collectionStore.createCollection("Returned");
    const inSignal = collectionStore.collections.value[0];
    expect(returned.id).toBe(inSignal.id);
    expect(returned.name).toBe("Returned");
  });
});

// ---------------------------------------------------------------------------
// deleteCollection
// ---------------------------------------------------------------------------

describe("deleteCollection", () => {
  it("removes collection by id", () => {
    const col = collectionStore.createCollection("ToDelete");
    collectionStore.deleteCollection(col.id);
    expect(collectionStore.collections.value).toHaveLength(0);
  });

  it("persists updated list after deletion", () => {
    const col = collectionStore.createCollection("Gone");
    collectionStore.deleteCollection(col.id);
    const stored = JSON.parse(localStorage.getItem("qb:collections") ?? "[]");
    expect(stored).toHaveLength(0);
  });

  it("is a no-op when id does not exist", () => {
    collectionStore.createCollection("Kept");
    collectionStore.deleteCollection("nonexistent-id");
    expect(collectionStore.collections.value).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// renameCollection
// ---------------------------------------------------------------------------

describe("renameCollection", () => {
  it("updates the name of the matching collection", () => {
    const col = collectionStore.createCollection("OldName");
    collectionStore.renameCollection(col.id, "NewName");
    expect(collectionStore.collections.value[0].name).toBe("NewName");
  });

  it("persists updated list after rename", () => {
    const col = collectionStore.createCollection("OldName");
    collectionStore.renameCollection(col.id, "NewName");
    const stored = JSON.parse(localStorage.getItem("qb:collections") ?? "[]");
    expect(stored[0].name).toBe("NewName");
  });

  it("is a no-op when id does not exist", () => {
    collectionStore.createCollection("Unchanged");
    collectionStore.renameCollection("nonexistent-id", "ShouldNotApply");
    expect(collectionStore.collections.value[0].name).toBe("Unchanged");
  });
});

// ---------------------------------------------------------------------------
// saveRequestToCollection
// ---------------------------------------------------------------------------

describe("saveRequestToCollection", () => {
  it("appends saved request to the correct collection", () => {
    const col = collectionStore.createCollection("MyCol");
    const snapshot = makeRequestState({ url: "https://saved.com" });
    collectionStore.saveRequestToCollection(col.id, "My Request", snapshot);
    const updated = collectionStore.collections.value[0];
    expect(updated.requests).toHaveLength(1);
    expect(updated.requests[0].url).toBe("https://saved.com");
  });

  it("generates unique id and savedAt timestamp", () => {
    const col = collectionStore.createCollection("Col");
    const snapshot = makeRequestState();
    const req = collectionStore.saveRequestToCollection(col.id, "Req", snapshot);
    expect(typeof req.id).toBe("string");
    expect(req.id.length).toBeGreaterThan(0);
    expect(typeof req.savedAt).toBe("number");
  });

  it("persists to localStorage", () => {
    const col = collectionStore.createCollection("Persist");
    const snapshot = makeRequestState({ url: "https://persisted.com" });
    collectionStore.saveRequestToCollection(col.id, "Saved", snapshot);
    const stored = JSON.parse(localStorage.getItem("qb:collections") ?? "[]");
    expect(stored[0].requests).toHaveLength(1);
    expect(stored[0].requests[0].url).toBe("https://persisted.com");
  });

  it("returns the created SavedRequest object", () => {
    const col = collectionStore.createCollection("Col");
    const snapshot = makeRequestState({ method: "POST" });
    const returned = collectionStore.saveRequestToCollection(col.id, "PostReq", snapshot);
    expect(returned.name).toBe("PostReq");
    expect(returned.method).toBe("POST");
    const inSignal = collectionStore.collections.value[0].requests[0];
    expect(returned.id).toBe(inSignal.id);
  });
});

// ---------------------------------------------------------------------------
// removeRequestFromCollection
// ---------------------------------------------------------------------------

describe("removeRequestFromCollection", () => {
  it("removes request by id from the correct collection", () => {
    const col = collectionStore.createCollection("Col");
    const snapshot = makeRequestState();
    const req = collectionStore.saveRequestToCollection(col.id, "ToRemove", snapshot);
    collectionStore.removeRequestFromCollection(col.id, req.id);
    expect(collectionStore.collections.value[0].requests).toHaveLength(0);
  });

  it("persists updated list after removal", () => {
    const col = collectionStore.createCollection("Col");
    const snapshot = makeRequestState();
    const req = collectionStore.saveRequestToCollection(col.id, "Gone", snapshot);
    collectionStore.removeRequestFromCollection(col.id, req.id);
    const stored = JSON.parse(localStorage.getItem("qb:collections") ?? "[]");
    expect(stored[0].requests).toHaveLength(0);
  });

  it("does not affect requests in other collections", () => {
    const col1 = collectionStore.createCollection("Col1");
    const col2 = collectionStore.createCollection("Col2");
    const snapshot = makeRequestState();
    const req1 = collectionStore.saveRequestToCollection(col1.id, "Req1", snapshot);
    collectionStore.saveRequestToCollection(col2.id, "Req2", snapshot);
    collectionStore.removeRequestFromCollection(col1.id, req1.id);
    const col2updated = collectionStore.collections.value.find((c) => c.id === col2.id);
    expect(col2updated?.requests).toHaveLength(1);
  });
});
