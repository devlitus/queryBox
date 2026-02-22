import { signal } from "@preact/signals";
import { StorageService } from "../services/storage";
import type { Collection, SavedRequest } from "../types/persistence";
import type { RequestState } from "../types/http";
import type { ImportStrategy } from "../types/export";

export const collections = signal<Collection[]>(StorageService.getCollections());

export function createCollection(name: string): Collection {
  const newCollection: Collection = {
    id: crypto.randomUUID(),
    name,
    createdAt: Date.now(),
    requests: [],
  };
  collections.value = [...collections.value, newCollection];
  StorageService.setCollections(collections.value);
  return newCollection;
}

export function deleteCollection(id: string): void {
  collections.value = collections.value.filter((c) => c.id !== id);
  StorageService.setCollections(collections.value);
}

export function renameCollection(id: string, name: string): void {
  collections.value = collections.value.map((c) =>
    c.id === id ? { ...c, name } : c
  );
  StorageService.setCollections(collections.value);
}

export function saveRequestToCollection(
  collectionId: string,
  name: string,
  requestSnapshot: RequestState
): SavedRequest {
  const newRequest: SavedRequest = {
    id: crypto.randomUUID(),
    name,
    method: requestSnapshot.method,
    url: requestSnapshot.url,
    savedAt: Date.now(),
    requestSnapshot,
  };
  collections.value = collections.value.map((c) =>
    c.id === collectionId
      ? { ...c, requests: [...c.requests, newRequest] }
      : c
  );
  StorageService.setCollections(collections.value);
  return newRequest;
}

export function removeRequestFromCollection(
  collectionId: string,
  requestId: string
): void {
  collections.value = collections.value.map((c) =>
    c.id === collectionId
      ? { ...c, requests: c.requests.filter((r) => r.id !== requestId) }
      : c
  );
  StorageService.setCollections(collections.value);
}

/**
 * Imports collections using the specified strategy.
 *
 * - "replace": Replaces all existing collections with the imported ones.
 *   All items receive new IDs to prevent conflicts with existing references.
 * - "merge": Adds only collections whose name (case-insensitive) does not
 *   already exist. Duplicate-named collections are skipped.
 *
 * Returns the count of added and skipped collections for user feedback.
 */
export function importCollections(
  imported: Collection[],
  strategy: ImportStrategy
): { added: number; skipped: number } {
  if (strategy === "replace") {
    const reassigned = imported.map((c) => ({
      ...c,
      id: crypto.randomUUID(),
      requests: c.requests.map((r) => ({ ...r, id: crypto.randomUUID() })),
    }));
    collections.value = reassigned;
    StorageService.setCollections(collections.value);
    return { added: reassigned.length, skipped: 0 };
  }

  // merge: add only if name does not already exist (case-insensitive)
  const existingNames = new Set(
    collections.value.map((c) => c.name.toLowerCase())
  );
  const toAdd: Collection[] = [];
  let skipped = 0;

  for (const c of imported) {
    if (existingNames.has(c.name.toLowerCase())) {
      skipped++;
    } else {
      toAdd.push({
        ...c,
        id: crypto.randomUUID(),
        requests: c.requests.map((r) => ({ ...r, id: crypto.randomUUID() })),
      });
      existingNames.add(c.name.toLowerCase());
    }
  }

  collections.value = [...collections.value, ...toAdd];
  StorageService.setCollections(collections.value);
  return { added: toAdd.length, skipped };
}
