import type { RequestState, KeyValuePair } from "../types/http";
import type { HistoryEntry, Collection, SavedRequest } from "../types/persistence";

export function makeKeyValuePair(overrides?: Partial<KeyValuePair>): KeyValuePair {
  return {
    id: "kv-id-1",
    key: "Content-Type",
    value: "application/json",
    enabled: true,
    ...overrides,
  };
}

export function makeRequestState(overrides?: Partial<RequestState>): RequestState {
  return {
    method: "GET",
    url: "https://api.example.com",
    params: [],
    headers: [],
    body: { mode: "none", contentType: "json", raw: "" },
    ...overrides,
  };
}

export function makeHistoryEntry(overrides?: Partial<HistoryEntry>): HistoryEntry {
  return {
    id: "test-id-1",
    method: "GET",
    url: "https://api.example.com",
    status: 200,
    statusText: "OK",
    timestamp: 1700000000000,
    requestSnapshot: makeRequestState(),
    ...overrides,
  };
}

export function makeSavedRequest(overrides?: Partial<SavedRequest>): SavedRequest {
  return {
    id: "req-id-1",
    name: "Test Request",
    method: "GET",
    url: "https://api.example.com",
    savedAt: 1700000000000,
    requestSnapshot: makeRequestState(),
    ...overrides,
  };
}

export function makeCollection(overrides?: Partial<Collection>): Collection {
  return {
    id: "col-1",
    name: "Test Collection",
    createdAt: 1700000000000,
    requests: [],
    ...overrides,
  };
}
