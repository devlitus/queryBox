/**
 * HTTP Client Service
 *
 * All requests are routed through the server-side proxy (/api/proxy) to eliminate
 * CORS restrictions. The proxy forwards requests server-to-server where CORS does not apply.
 *
 * This allows queryBox to make requests to any external API regardless of their CORS configuration.
 */

import {
  requestState,
} from "../stores/http-store";
import type {
  ProxyRequest,
  ProxySuccessResponse,
  ProxyErrorResponse,
} from "../types/proxy";
import { updateActiveTabResponse, activeTab, renameTab } from "../stores/tab-store";
import { addHistoryEntry } from "../stores/history-store";
import { activeVariablesMap } from "../stores/environment-store";
import { interpolateRequest } from "../utils/interpolation";
import { resolveAuthHeaders } from "../utils/auth";
import { buildUrlWithParams } from "../utils/url";
import type { HttpError } from "../types/http";

/** Default tab name that triggers auto-rename. */
const DEFAULT_TAB_NAME = "New Request";

/** Maximum response body size to display (5 MB). Larger bodies are truncated. */
const MAX_BODY_SIZE = 5 * 1024 * 1024;

/** Active AbortController for the current in-flight request. */
let abortController: AbortController | null = null;

/**
 * Cancels any in-flight HTTP request.
 */
export function cancelRequest(): void {
  abortController?.abort();
}

/**
 * Sends the HTTP request described by the current requestState signal.
 * Updates the active tab's response, requestStatus, and requestError via tab-store.
 */
export async function sendRequest(): Promise<void> {
  // Cancel any previous in-flight request
  abortController?.abort();
  abortController = new AbortController();
  const signal = abortController.signal;

  const state = requestState.value;

  // Interpolate variables from the active environment (fast path when no env is active)
  const variables = activeVariablesMap.value;
  const interpolatedState = variables.size > 0
    ? interpolateRequest(state, variables)
    : state;

  // Build resolvedUrl AFTER interpolation, from the already-interpolated state.
  // Using fullUrl.value here would URL-encode {{...}} before interpolation,
  // making the regex unable to match them.
  const resolvedUrl = buildUrlWithParams(interpolatedState.url, interpolatedState.params);

  // Basic URL validation
  if (!resolvedUrl) {
    updateActiveTabResponse(null, "error", {
      message: "Please enter a URL before sending a request.",
      type: "unknown",
    });
    return;
  }

  try {
    new URL(resolvedUrl);
  } catch {
    updateActiveTabResponse(null, "error", {
      message: `"${resolvedUrl}" is not a valid URL. Make sure it starts with http:// or https://.`,
      type: "unknown",
    });
    return;
  }

  // Set loading state
  updateActiveTabResponse(null, "loading", null);

  // Resolve authentication headers/params from the (already-interpolated) auth config
  const resolvedAuth = resolveAuthHeaders(interpolatedState.auth);

  // Inject API Key query params into the URL (if auth type is apikey with addTo="query")
  // searchParams.set() is used intentionally: auth config is the source of truth for auth params.
  let finalUrl = resolvedUrl;
  if (resolvedAuth.params.length > 0) {
    const urlObj = new URL(resolvedUrl);
    for (const p of resolvedAuth.params) {
      urlObj.searchParams.set(p.key, p.value);
    }
    finalUrl = urlObj.toString();
  }

  // Build headers: auth headers first (lower precedence), then user-defined headers.
  // User-defined headers can override auth headers if keys collide (principle of least surprise).
  const fetchHeaders = new Headers();
  for (const h of resolvedAuth.headers) {
    fetchHeaders.set(h.key, h.value);
  }
  for (const h of interpolatedState.headers.filter((h) => h.enabled && h.key !== "")) {
    fetchHeaders.set(h.key, h.value);
  }

  // Auto-add Content-Type for raw body if not already set
  const hasBody = ["POST", "PUT", "PATCH", "DELETE"].includes(interpolatedState.method) &&
    interpolatedState.body.mode === "raw" &&
    interpolatedState.body.raw.length > 0;

  if (hasBody && !fetchHeaders.has("Content-Type")) {
    const contentTypeMap: Record<string, string> = {
      json: "application/json",
      text: "text/plain",
      xml:  "application/xml",
      html: "text/html",
    };
    fetchHeaders.set("Content-Type", contentTypeMap[interpolatedState.body.contentType] ?? "text/plain");
  }

  // Build fetch options
  const fetchOptions: RequestInit = {
    method: interpolatedState.method,
    headers: fetchHeaders,
    signal,
  };

  if (hasBody) {
    fetchOptions.body = interpolatedState.body.raw;
  }

  // Convert Headers object to plain Record for the proxy
  const headersRecord: Record<string, string> = {};
  fetchHeaders.forEach((value, key) => {
    headersRecord[key] = value;
  });

  // Build ProxyRequest payload
  const proxyPayload: ProxyRequest = {
    url: finalUrl,
    method: interpolatedState.method,
    headers: headersRecord,
    ...(hasBody && { body: interpolatedState.body.raw }),
  };

  const startTime = performance.now();

  try {
    // Send request through the proxy
    const proxyResponse = await fetch("/api/proxy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(proxyPayload),
      signal,
    });

    const endTime = performance.now();
    const timeMs = Math.round(endTime - startTime);

    // Handle proxy-level errors (rate limit, timeout, network, etc.)
    if (!proxyResponse.ok) {
      const errorData: ProxyErrorResponse = await proxyResponse.json();

      if (proxyResponse.status === 429) {
        updateActiveTabResponse(null, "error", {
          message: errorData.message,
          type: "rate-limit",
        });
        return;
      }

      if (proxyResponse.status === 504) {
        updateActiveTabResponse(null, "error", {
          message: errorData.message,
          type: "timeout",
        });
        return;
      }

      if (proxyResponse.status === 502) {
        updateActiveTabResponse(null, "error", {
          message: errorData.message,
          type: "network",
        });
        return;
      }

      if (proxyResponse.status === 403) {
        updateActiveTabResponse(null, "error", {
          message: errorData.message,
          type: "forbidden",
        });
        return;
      }

      // Other proxy errors
      updateActiveTabResponse(null, "error", {
        message: errorData.message,
        type: "unknown",
      });
      return;
    }

    // Parse successful proxy response
    const successData: ProxySuccessResponse = await proxyResponse.json();

    // Calculate size from the actual body length
    const size = new Blob([successData.body]).size;

    // Convert headers from Record to Array format
    const responseHeaders: Array<{ key: string; value: string }> = [];
    for (const [key, value] of Object.entries(successData.headers)) {
      responseHeaders.push({ key, value });
    }

    updateActiveTabResponse(
      {
        status: successData.status,
        statusText: successData.statusText,
        headers: responseHeaders,
        body: successData.body,
        contentType: successData.contentType,
        time: timeMs,
        size,
      },
      "success",
      null
    );

    // History stores the original (unresolved) state and URL — preserving templates for re-use
    addHistoryEntry({
      method: state.method,
      url: state.url,
      status: successData.status,
      statusText: successData.statusText,
      requestSnapshot: structuredClone(state),
    });

    // Auto-rename tab using the resolved URL hostname
    const currentTab = activeTab.value;
    if (currentTab && currentTab.name === DEFAULT_TAB_NAME) {
      try {
        const hostname = new URL(resolvedUrl).hostname;
        if (hostname) {
          renameTab(currentTab.id, hostname);
        }
      } catch {
        // Ignore rename on malformed URL (shouldn't happen since we validated above)
      }
    }
  } catch (err: unknown) {
    if (signal.aborted) {
      updateActiveTabResponse(null, "error", {
        message: "Request was cancelled.",
        type: "abort",
      });
      return;
    }

    let httpError: HttpError;

    if (err instanceof TypeError) {
      // With the proxy, CORS errors should not occur, but we keep detection as fallback
      const message = err.message.toLowerCase();
      const isCors = message.includes("cors") ||
        message.includes("cross-origin") ||
        message.includes("network") ||
        message.includes("failed to fetch");

      if (isCors) {
        httpError = {
          message:
            "Network error: Failed to connect to the proxy server. " +
            "Please check your internet connection and try again.",
          type: "cors",
        };
      } else {
        httpError = {
          message: `Network error: ${err.message}`,
          type: "network",
        };
      }
    } else if (err instanceof Error) {
      httpError = {
        message: err.message,
        type: "unknown",
      };
    } else {
      httpError = {
        message: "An unexpected error occurred.",
        type: "unknown",
      };
    }

    updateActiveTabResponse(null, "error", httpError);
  }
}
