import { describe, it, expect, beforeEach, vi } from "vitest";
import { makeCollection, makeSavedRequest, makeRequestState } from "../../test/factories";

let collectionStore: typeof import("../collection-store");

beforeEach(async () => {
  vi.resetModules();
  localStorage.clear();
  collectionStore = await import("../collection-store");
});

// ---------------------------------------------------------------------------
// importCollections — replace strategy
// ---------------------------------------------------------------------------

describe("importCollections — replace strategy", () => {
  it("replaces existing collections with imported ones", () => {
    collectionStore.createCollection("Old Collection");
    expect(collectionStore.collections.value).toHaveLength(1);

    const imported = [
      makeCollection({ id: "import-1", name: "New Collection A" }),
      makeCollection({ id: "import-2", name: "New Collection B" }),
    ];
    collectionStore.importCollections(imported, "replace");

    expect(collectionStore.collections.value).toHaveLength(2);
    expect(collectionStore.collections.value.map((c) => c.name)).toContain("New Collection A");
    expect(collectionStore.collections.value.map((c) => c.name)).toContain("New Collection B");
    // Old collection should be gone
    expect(collectionStore.collections.value.map((c) => c.name)).not.toContain("Old Collection");
  });

  it("regenerates IDs for all imported collections on replace", () => {
    const imported = [makeCollection({ id: "original-id", name: "Regen" })];
    collectionStore.importCollections(imported, "replace");

    const stored = collectionStore.collections.value[0];
    expect(stored.id).not.toBe("original-id");
    expect(typeof stored.id).toBe("string");
    expect(stored.id.length).toBeGreaterThan(0);
  });

  it("regenerates IDs for nested requests on replace", () => {
    const req = makeSavedRequest({ id: "original-req-id", name: "Saved" });
    const col = makeCollection({ id: "col-id", requests: [req] });
    collectionStore.importCollections([col], "replace");

    const storedReq = collectionStore.collections.value[0].requests[0];
    expect(storedReq.id).not.toBe("original-req-id");
  });

  it("returns correct counts for replace", () => {
    collectionStore.createCollection("Existing");
    const imported = [
      makeCollection({ id: "i1", name: "A" }),
      makeCollection({ id: "i2", name: "B" }),
    ];
    const result = collectionStore.importCollections(imported, "replace");

    expect(result.added).toBe(2);
    expect(result.skipped).toBe(0);
  });

  it("persists replaced collections to localStorage", () => {
    const imported = [makeCollection({ id: "p1", name: "Persisted" })];
    collectionStore.importCollections(imported, "replace");

    const stored = JSON.parse(localStorage.getItem("qb:collections") ?? "[]");
    expect(stored).toHaveLength(1);
    expect(stored[0].name).toBe("Persisted");
  });

  it("handles empty import array on replace", () => {
    collectionStore.createCollection("Existing");
    const result = collectionStore.importCollections([], "replace");

    expect(collectionStore.collections.value).toHaveLength(0);
    expect(result.added).toBe(0);
    expect(result.skipped).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// importCollections — merge strategy
// ---------------------------------------------------------------------------

describe("importCollections — merge strategy", () => {
  it("adds collections whose names do not exist", () => {
    collectionStore.createCollection("Existing");
    const imported = [
      makeCollection({ id: "i1", name: "New A" }),
      makeCollection({ id: "i2", name: "New B" }),
    ];
    collectionStore.importCollections(imported, "merge");

    expect(collectionStore.collections.value).toHaveLength(3);
  });

  it("skips collections with duplicate names (case-insensitive)", () => {
    collectionStore.createCollection("My Collection");
    const imported = [
      makeCollection({ id: "i1", name: "my collection" }), // lowercase duplicate
      makeCollection({ id: "i2", name: "MY COLLECTION" }), // uppercase duplicate
      makeCollection({ id: "i3", name: "Unique Collection" }), // new
    ];
    const result = collectionStore.importCollections(imported, "merge");

    expect(collectionStore.collections.value).toHaveLength(2);
    expect(result.added).toBe(1);
    expect(result.skipped).toBe(2);
  });

  it("regenerates IDs for merged collections", () => {
    const imported = [makeCollection({ id: "original-id", name: "Merged" })];
    collectionStore.importCollections(imported, "merge");

    const added = collectionStore.collections.value.find((c) => c.name === "Merged");
    expect(added?.id).not.toBe("original-id");
  });

  it("preserves existing collections during merge", () => {
    const existing = collectionStore.createCollection("Keep Me");
    const imported = [makeCollection({ id: "new-id", name: "Added" })];
    collectionStore.importCollections(imported, "merge");

    const kept = collectionStore.collections.value.find((c) => c.id === existing.id);
    expect(kept).toBeDefined();
    expect(kept?.name).toBe("Keep Me");
  });

  it("returns correct counts for merge", () => {
    collectionStore.createCollection("Duplicate");
    const imported = [
      makeCollection({ id: "i1", name: "duplicate" }), // will be skipped
      makeCollection({ id: "i2", name: "Brand New" }),
    ];
    const result = collectionStore.importCollections(imported, "merge");

    expect(result.added).toBe(1);
    expect(result.skipped).toBe(1);
  });

  it("persists merged collections to localStorage", () => {
    const imported = [makeCollection({ id: "p1", name: "Merged Persisted" })];
    collectionStore.importCollections(imported, "merge");

    const stored = JSON.parse(localStorage.getItem("qb:collections") ?? "[]");
    expect(stored.some((c: { name: string }) => c.name === "Merged Persisted")).toBe(true);
  });

  it("handles empty import array on merge", () => {
    collectionStore.createCollection("Existing");
    const result = collectionStore.importCollections([], "merge");

    expect(collectionStore.collections.value).toHaveLength(1);
    expect(result.added).toBe(0);
    expect(result.skipped).toBe(0);
  });

  it("deduplicate across imported items themselves during merge", () => {
    // Two items in the imported array with same name — only first should be added
    const imported = [
      makeCollection({ id: "i1", name: "Duplicate Within Import" }),
      makeCollection({ id: "i2", name: "duplicate within import" }),
    ];
    const result = collectionStore.importCollections(imported, "merge");

    expect(collectionStore.collections.value).toHaveLength(1);
    expect(result.added).toBe(1);
    expect(result.skipped).toBe(1);
  });

  it("preserves requests in imported collections during merge", () => {
    const req = makeSavedRequest({ id: "r1", name: "Test Request", url: "https://test.com" });
    const col = makeCollection({ id: "i1", name: "With Requests", requests: [req] });
    collectionStore.importCollections([col], "merge");

    const added = collectionStore.collections.value.find((c) => c.name === "With Requests");
    expect(added?.requests).toHaveLength(1);
    expect(added?.requests[0].url).toBe("https://test.com");
  });
});
