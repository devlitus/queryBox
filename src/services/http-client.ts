/**
 * HTTP Client Service
 *
 * CORS LIMITATION NOTICE:
 * This client uses the browser's native fetch() API. Browser security policies
 * enforce CORS (Cross-Origin Resource Sharing). Requests to APIs that do not
 * include the `Access-Control-Allow-Origin` response header will be blocked.
 *
 * This is a known browser limitation, NOT a bug in queryBox.
 *
 * For testing, use CORS-enabled APIs such as:
 * - https://jsonplaceholder.typicode.com (free, CORS-enabled)
 * - https://httpbin.org (flexible HTTP testing)
 * - Your own API with permissive CORS headers
 *
 * Future improvements: local proxy server via Astro SSR API routes.
 */

import { batch } from "@preact/signals";
import {
  requestState,
  responseState,
  requestStatus,
  requestError,
  fullUrl,
} from "../stores/http-store";
import type { HttpError } from "../types/http";

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
 * Updates responseState, requestStatus, and requestError signals based on the result.
 */
export async function sendRequest(): Promise<void> {
  // Cancel any previous in-flight request
  abortController?.abort();
  abortController = new AbortController();
  const signal = abortController.signal;

  const state = requestState.value;
  const url = fullUrl.value;

  // Basic URL validation
  if (!url) {
    requestError.value = {
      message: "Please enter a URL before sending a request.",
      type: "unknown",
    };
    requestStatus.value = "error";
    return;
  }

  try {
    new URL(url);
  } catch {
    requestError.value = {
      message: `"${url}" is not a valid URL. Make sure it starts with http:// or https://.`,
      type: "unknown",
    };
    requestStatus.value = "error";
    return;
  }

  // Set loading state
  batch(() => {
    requestStatus.value = "loading";
    responseState.value = null;
    requestError.value = null;
  });

  // Build headers
  const fetchHeaders = new Headers();
  for (const h of state.headers.filter((h) => h.enabled && h.key !== "")) {
    fetchHeaders.set(h.key, h.value);
  }

  // Auto-add Content-Type for raw body if not already set
  const hasBody = ["POST", "PUT", "PATCH", "DELETE"].includes(state.method) &&
    state.body.mode === "raw" &&
    state.body.raw.length > 0;

  if (hasBody && !fetchHeaders.has("Content-Type")) {
    const contentTypeMap: Record<string, string> = {
      json: "application/json",
      text: "text/plain",
      xml:  "application/xml",
      html: "text/html",
    };
    fetchHeaders.set("Content-Type", contentTypeMap[state.body.contentType] ?? "text/plain");
  }

  // Build fetch options
  const fetchOptions: RequestInit = {
    method: state.method,
    headers: fetchHeaders,
    signal,
  };

  if (hasBody) {
    fetchOptions.body = state.body.raw;
  }

  const startTime = performance.now();

  try {
    const response = await fetch(url, fetchOptions);
    const endTime = performance.now();
    const timeMs = Math.round(endTime - startTime);

    // Read body as text (always; JSON pretty-printing is handled in display)
    let bodyText = await response.text();

    // Truncate very large bodies
    if (bodyText.length > MAX_BODY_SIZE) {
      bodyText = bodyText.slice(0, MAX_BODY_SIZE) +
        "\n\n[Response truncated: body exceeds 5 MB limit]";
    }

    // Calculate size from Content-Length or actual body length
    const contentLengthHeader = response.headers.get("Content-Length");
    const size = contentLengthHeader
      ? parseInt(contentLengthHeader, 10)
      : new Blob([bodyText]).size;

    // Extract response headers
    const responseHeaders: Array<{ key: string; value: string }> = [];
    response.headers.forEach((value, key) => {
      responseHeaders.push({ key, value });
    });

    const contentType = response.headers.get("Content-Type") ?? "";

    batch(() => {
      responseState.value = {
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders,
        body: bodyText,
        contentType,
        time: timeMs,
        size,
      };
      requestStatus.value = "success";
    });
  } catch (err: unknown) {
    if (signal.aborted) {
      batch(() => {
        requestError.value = {
          message: "Request was cancelled.",
          type: "abort",
        };
        requestStatus.value = "error";
      });
      return;
    }

    let httpError: HttpError;

    if (err instanceof TypeError) {
      // Detect CORS by checking the error message
      const message = err.message.toLowerCase();
      const isCors = message.includes("cors") ||
        message.includes("cross-origin") ||
        message.includes("network") ||
        message.includes("failed to fetch");

      if (isCors) {
        httpError = {
          message:
            "The request was blocked by the browser's CORS policy. " +
            "The target API must include 'Access-Control-Allow-Origin' in its response headers. " +
            "Try testing with https://jsonplaceholder.typicode.com or https://httpbin.org instead.",
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

    batch(() => {
      requestError.value = httpError;
      requestStatus.value = "error";
    });
  }
}
