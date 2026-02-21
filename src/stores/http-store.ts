import { computed } from "@preact/signals";
import type { HttpMethod, KeyValuePair, RequestState, BodyMode, ContentType } from "../types/http";
import type { AuthType } from "../types/auth";
import { DEFAULT_AUTH } from "../types/auth";
import { parseQueryParams, buildUrlWithParams, formatBytes } from "../utils/url";
import {
  activeTab,
  DEFAULT_REQUEST,
  updateActiveTabRequest,
  updateActiveTabResponse,
} from "./tab-store";

// ---------------------------------------------------------------------------
// Computed proxies — delegate to the active tab
// These preserve the same public API so all existing consumers work unchanged.
// ---------------------------------------------------------------------------

export const requestState = computed(
  () => activeTab.value?.request ?? DEFAULT_REQUEST
);

export const responseState = computed(
  () => activeTab.value?.response ?? null
);

export const requestStatus = computed(
  () => activeTab.value?.requestStatus ?? "idle"
);

export const requestError = computed(
  () => activeTab.value?.requestError ?? null
);

// ---------------------------------------------------------------------------
// Computed signals (derive from requestState / responseState as before)
// ---------------------------------------------------------------------------

export const enabledParams = computed(() =>
  requestState.value.params.filter((p) => p.enabled && p.key !== "")
);

export const enabledHeaders = computed(() =>
  requestState.value.headers.filter((h) => h.enabled && h.key !== "")
);

/** Full URL with enabled query params appended */
export const fullUrl = computed(() =>
  buildUrlWithParams(requestState.value.url, requestState.value.params)
);

export const formattedSize = computed(() => {
  const size = responseState.value?.size;
  return size !== undefined ? formatBytes(size) : "";
});

export const statusColorClass = computed(() => {
  const status = responseState.value?.status;
  if (!status) return "text-pm-text-primary";
  if (status >= 200 && status < 300) return "text-pm-status-success";
  if (status >= 300 && status < 400) return "text-pm-status-redirect";
  return "text-pm-status-error";
});

// ---------------------------------------------------------------------------
// Action functions — all writes delegate to tab-store
// ---------------------------------------------------------------------------

export function updateMethod(method: HttpMethod): void {
  updateActiveTabRequest({ method });
}

/**
 * Updates the URL and parses query params from it.
 * Uses a flag to prevent re-entry when params update the URL.
 */
let isUpdatingFromParams = false;

export function updateUrl(url: string): void {
  if (isUpdatingFromParams) return;

  const parsed = parseQueryParams(url);

  updateActiveTabRequest({ url, params: parsed });
}

export function addParam(): void {
  updateActiveTabRequest({
    params: [
      ...requestState.value.params,
      { id: crypto.randomUUID(), key: "", value: "", enabled: true },
    ],
  });
}

export function updateParam(id: string, field: keyof Omit<KeyValuePair, "id">, value: string | boolean): void {
  const params = requestState.value.params.map((p) =>
    p.id === id ? { ...p, [field]: value } : p
  );

  // Sync URL from params (avoid re-entry)
  isUpdatingFromParams = true;
  const newUrl = buildUrlWithParams(requestState.value.url, params);
  updateActiveTabRequest({ url: newUrl, params });
  isUpdatingFromParams = false;
}

export function removeParam(id: string): void {
  const params = requestState.value.params.filter((p) => p.id !== id);
  isUpdatingFromParams = true;
  const newUrl = buildUrlWithParams(requestState.value.url, params);
  updateActiveTabRequest({ url: newUrl, params });
  isUpdatingFromParams = false;
}

export function toggleParam(id: string): void {
  updateParam(id, "enabled", !requestState.value.params.find((p) => p.id === id)?.enabled);
}

export function addHeader(): void {
  updateActiveTabRequest({
    headers: [
      ...requestState.value.headers,
      { id: crypto.randomUUID(), key: "", value: "", enabled: true },
    ],
  });
}

export function updateHeader(id: string, field: keyof Omit<KeyValuePair, "id">, value: string | boolean): void {
  updateActiveTabRequest({
    headers: requestState.value.headers.map((h) =>
      h.id === id ? { ...h, [field]: value } : h
    ),
  });
}

export function removeHeader(id: string): void {
  updateActiveTabRequest({
    headers: requestState.value.headers.filter((h) => h.id !== id),
  });
}

export function toggleHeader(id: string): void {
  updateHeader(id, "enabled", !requestState.value.headers.find((h) => h.id === id)?.enabled);
}

export function updateBodyMode(mode: BodyMode): void {
  updateActiveTabRequest({
    body: { ...requestState.value.body, mode },
  });
}

export function updateBodyContentType(contentType: ContentType): void {
  updateActiveTabRequest({
    body: { ...requestState.value.body, contentType },
  });
}

export function updateBodyRaw(raw: string): void {
  updateActiveTabRequest({
    body: { ...requestState.value.body, raw },
  });
}

export function resetResponse(): void {
  updateActiveTabResponse(null, "idle", null);
}

// ---------------------------------------------------------------------------
// Auth action functions
// ---------------------------------------------------------------------------

/**
 * Changes the auth type for the active tab's request.
 * Reinitializes the config for the new type to avoid residual state from the
 * previous type (e.g. switching from bearer back to basic shouldn't leak tokens).
 */
export function updateAuthType(type: AuthType): void {
  switch (type) {
    case "none":
      updateActiveTabRequest({ auth: { type: "none" } });
      break;
    case "basic":
      updateActiveTabRequest({ auth: { type: "basic", basic: { username: "", password: "" } } });
      break;
    case "bearer":
      updateActiveTabRequest({ auth: { type: "bearer", bearer: { token: "", prefix: "Bearer" } } });
      break;
    case "apikey":
      updateActiveTabRequest({ auth: { type: "apikey", apikey: { key: "", value: "", addTo: "header" } } });
      break;
  }
}

/** Updates a field in the Basic Auth config. */
export function updateBasicAuth(field: "username" | "password", value: string): void {
  const current = requestState.value.auth;
  if (current.type !== "basic") return;
  updateActiveTabRequest({ auth: { ...current, basic: { ...current.basic, [field]: value } } });
}

/** Updates a field in the Bearer Token config. */
export function updateBearerToken(field: "token" | "prefix", value: string): void {
  const current = requestState.value.auth;
  if (current.type !== "bearer") return;
  updateActiveTabRequest({ auth: { ...current, bearer: { ...current.bearer, [field]: value } } });
}

/** Updates a field in the API Key config. */
export function updateApiKey(field: "key" | "value" | "addTo", value: string): void {
  const current = requestState.value.auth;
  if (current.type !== "apikey") return;
  updateActiveTabRequest({ auth: { ...current, apikey: { ...current.apikey, [field]: value } } });
}

/**
 * Loads a saved request snapshot into the active tab's workbench.
 * Regenerates all KeyValuePair IDs to avoid key collisions when the same
 * snapshot is loaded multiple times. Clears any previous response.
 */
export function loadRequest(snapshot: RequestState): void {
  updateActiveTabRequest({
    ...snapshot,
    params: snapshot.params.map((p) => ({ ...p, id: crypto.randomUUID() })),
    headers: snapshot.headers.map((h) => ({ ...h, id: crypto.randomUUID() })),
    // Migration guard: snapshots from history/collections saved before the auth
    // feature won't have an `auth` field. Fall back to DEFAULT_AUTH.
    auth: snapshot.auth ?? DEFAULT_AUTH,
  });
  resetResponse();
}
