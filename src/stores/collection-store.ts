import { signal } from "@preact/signals";
import { StorageService } from "../services/storage";
import type { Collection, SavedRequest } from "../types/persistence";
import type { RequestState } from "../types/http";

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
