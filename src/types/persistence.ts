import type { HttpMethod, RequestState } from "./http";

export interface HistoryEntry {
  id: string;
  method: HttpMethod;
  url: string;
  status: number;
  statusText: string;
  timestamp: number; // Date.now() epoch ms
  requestSnapshot: RequestState; // full request state for reload
}

export interface SavedRequest {
  id: string;
  name: string;
  method: HttpMethod;
  url: string;
  savedAt: number;
  requestSnapshot: RequestState;
}

export interface Collection {
  id: string;
  name: string;
  createdAt: number;
  requests: SavedRequest[];
}
