import { signal, computed, batch } from "@preact/signals";
import type { HttpMethod, KeyValuePair, RequestState, ResponseState, RequestStatus, HttpError, BodyMode, ContentType } from "../types/http";
import { parseQueryParams, buildUrlWithParams, formatBytes } from "../utils/url";

// ---------------------------------------------------------------------------
// State signals
// ---------------------------------------------------------------------------

export const requestState = signal<RequestState>({
  method: "GET",
  url: "",
  params: [],
  headers: [],
  body: {
    mode: "none",
    contentType: "json",
    raw: "",
  },
});

export const responseState = signal<ResponseState | null>(null);
export const requestStatus = signal<RequestStatus>("idle");
export const requestError = signal<HttpError | null>(null);

// ---------------------------------------------------------------------------
// Computed signals
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
// Action functions
// ---------------------------------------------------------------------------

export function updateMethod(method: HttpMethod): void {
  requestState.value = { ...requestState.value, method };
}

/**
 * Updates the URL and parses query params from it.
 * Uses a flag to prevent re-entry when params update the URL.
 */
let isUpdatingFromParams = false;

export function updateUrl(url: string): void {
  if (isUpdatingFromParams) return;

  const parsed = parseQueryParams(url);

  // Preserve existing params that are not in the URL (user-added with no key sync)
  // Strategy: replace all params with those from the URL, merging by key name
  requestState.value = {
    ...requestState.value,
    url,
    params: parsed,
  };
}

export function addParam(): void {
  requestState.value = {
    ...requestState.value,
    params: [
      ...requestState.value.params,
      { id: crypto.randomUUID(), key: "", value: "", enabled: true },
    ],
  };
}

export function updateParam(id: string, field: keyof Omit<KeyValuePair, "id">, value: string | boolean): void {
  const params = requestState.value.params.map((p) =>
    p.id === id ? { ...p, [field]: value } : p
  );

  // Sync URL from params (avoid re-entry)
  isUpdatingFromParams = true;
  const newUrl = buildUrlWithParams(requestState.value.url, params);
  requestState.value = { ...requestState.value, url: newUrl, params };
  isUpdatingFromParams = false;
}

export function removeParam(id: string): void {
  const params = requestState.value.params.filter((p) => p.id !== id);
  isUpdatingFromParams = true;
  const newUrl = buildUrlWithParams(requestState.value.url, params);
  requestState.value = { ...requestState.value, url: newUrl, params };
  isUpdatingFromParams = false;
}

export function toggleParam(id: string): void {
  updateParam(id, "enabled", !requestState.value.params.find((p) => p.id === id)?.enabled);
}

export function addHeader(): void {
  requestState.value = {
    ...requestState.value,
    headers: [
      ...requestState.value.headers,
      { id: crypto.randomUUID(), key: "", value: "", enabled: true },
    ],
  };
}

export function updateHeader(id: string, field: keyof Omit<KeyValuePair, "id">, value: string | boolean): void {
  requestState.value = {
    ...requestState.value,
    headers: requestState.value.headers.map((h) =>
      h.id === id ? { ...h, [field]: value } : h
    ),
  };
}

export function removeHeader(id: string): void {
  requestState.value = {
    ...requestState.value,
    headers: requestState.value.headers.filter((h) => h.id !== id),
  };
}

export function toggleHeader(id: string): void {
  updateHeader(id, "enabled", !requestState.value.headers.find((h) => h.id === id)?.enabled);
}

export function updateBodyMode(mode: BodyMode): void {
  requestState.value = {
    ...requestState.value,
    body: { ...requestState.value.body, mode },
  };
}

export function updateBodyContentType(contentType: ContentType): void {
  requestState.value = {
    ...requestState.value,
    body: { ...requestState.value.body, contentType },
  };
}

export function updateBodyRaw(raw: string): void {
  requestState.value = {
    ...requestState.value,
    body: { ...requestState.value.body, raw },
  };
}

export function resetResponse(): void {
  batch(() => {
    responseState.value = null;
    requestStatus.value = "idle";
    requestError.value = null;
  });
}
