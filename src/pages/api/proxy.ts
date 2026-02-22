import type { APIContext } from "astro";
import { createRateLimiter } from "../../server/rate-limiter";
import {
  validateProxyRequest,
  isAllowedUrl,
  sanitizeRequestHeaders,
  PROXY_MAX_BODY_SIZE,
  PROXY_DEFAULT_TIMEOUT,
} from "../../server/proxy-validation";
import type {
  ProxyRequest,
  ProxySuccessResponse,
  ProxyErrorResponse,
} from "../../types/proxy";

// Mark this endpoint as server-rendered (not pre-rendered)
export const prerender = false;

// Rate limiter instance for the proxy endpoint
const proxyRateLimiter = createRateLimiter({
  maxRequests: parseInt(import.meta.env.PROXY_RATE_LIMIT_MAX || "100", 10),
  windowMs: parseInt(import.meta.env.PROXY_RATE_LIMIT_WINDOW_MS || "60000", 10),
});

/**
 * Returns a JSON error response.
 */
function jsonError(
  status: number,
  error: string,
  message: string,
  retryAfter?: number
): Response {
  const body: ProxyErrorResponse = {
    error,
    message,
    ...(retryAfter !== undefined && { retryAfter }),
  };

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (retryAfter !== undefined) {
    headers["Retry-After"] = String(retryAfter);
  }

  return new Response(JSON.stringify(body), { status, headers });
}

/**
 * POST /api/proxy
 *
 * Receives a ProxyRequest from the client, forwards it to the external API
 * server-to-server (bypassing CORS), and returns the response wrapped in JSON.
 */
export async function POST({ request, clientAddress }: APIContext) {
  // 1. Rate limiting
  if (!clientAddress) {
    return jsonError(
      400,
      "bad-request",
      "Cannot process request without client identification"
    );
  }

  const rateLimit = proxyRateLimiter.checkRateLimit(clientAddress);
  if (!rateLimit.allowed) {
    const retryAfterSeconds = Math.ceil(rateLimit.resetIn / 1000);
    return jsonError(
      429,
      "rate-limit",
      "Too many proxy requests. Try again later.",
      retryAfterSeconds
    );
  }

  // 2. Check Content-Length before reading body
  const contentLength = request.headers.get("content-length");
  if (contentLength !== null && parseInt(contentLength, 10) > PROXY_MAX_BODY_SIZE) {
    const maxSizeMB = PROXY_MAX_BODY_SIZE / (1024 * 1024);
    return jsonError(
      413,
      "payload-too-large",
      `Request body exceeds the maximum allowed size of ${maxSizeMB} MB.`
    );
  }

  // 3. Read and parse the body with size limit
  let bodyText: string;
  try {
    const reader = request.body?.getReader();
    if (!reader) {
      return jsonError(400, "invalid-request", "Missing request body");
    }

    let received = 0;
    const chunks: Uint8Array[] = [];

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      received += value.length;
      if (received > PROXY_MAX_BODY_SIZE) {
        reader.cancel();
        return jsonError(
          413,
          "payload-too-large",
          `Request body exceeds maximum allowed size of ${PROXY_MAX_BODY_SIZE} bytes`
        );
      }

      chunks.push(value);
    }

    // Concatenate all chunks
    const concatenated = new Uint8Array(received);
    let offset = 0;
    for (const chunk of chunks) {
      concatenated.set(chunk, offset);
      offset += chunk.length;
    }

    const decoder = new TextDecoder();
    bodyText = decoder.decode(concatenated);
  } catch (err) {
    return jsonError(
      400,
      "invalid-request",
      `Failed to read request body: ${err instanceof Error ? err.message : "Unknown error"}`
    );
  }

  // 4. Parse and validate JSON
  let proxyReq: ProxyRequest;
  try {
    proxyReq = JSON.parse(bodyText);
  } catch {
    return jsonError(400, "invalid-request", "Request body must be valid JSON");
  }

  if (!validateProxyRequest(proxyReq)) {
    return jsonError(
      400,
      "invalid-request",
      "Invalid proxy request format. Required fields: url (string), method (string), headers (object)"
    );
  }

  // 5. Validate URL security (SSRF prevention)
  const urlCheck = isAllowedUrl(proxyReq.url, import.meta.env.DEV);
  if (!urlCheck.allowed) {
    return jsonError(403, "forbidden-url", urlCheck.reason ?? "URL is not allowed");
  }

  // 6. Sanitize headers
  const sanitizedHeaders = sanitizeRequestHeaders(proxyReq.headers);

  // 7. Prepare fetch options
  const timeout = proxyReq.timeout ?? PROXY_DEFAULT_TIMEOUT;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  const fetchOptions: RequestInit = {
    method: proxyReq.method,
    headers: sanitizedHeaders,
    signal: controller.signal,
  };

  // Add body if present and method supports it
  if (proxyReq.body) {
    fetchOptions.body = proxyReq.body;
  }

  try {
    // 8. Execute the request to the external API
    const externalResponse = await fetch(proxyReq.url, fetchOptions);

    clearTimeout(timeoutId);

    // 9. Read the response body
    let responseBody = await externalResponse.text();

    // 10. Truncate if too large
    if (responseBody.length > PROXY_MAX_BODY_SIZE) {
      responseBody = responseBody.slice(0, PROXY_MAX_BODY_SIZE) +
        "\n\n[Response truncated: body exceeds 5 MB limit]";
    }

    // 11. Extract response headers
    const responseHeaders: Record<string, string> = {};
    externalResponse.headers.forEach((value, key) => {
      responseHeaders[key] = value;
    });

    const contentType = externalResponse.headers.get("Content-Type") ?? "";

    // 12. Return successful response (always 200, even if external API returned error)
    const successResponse: ProxySuccessResponse = {
      status: externalResponse.status,
      statusText: externalResponse.statusText,
      headers: responseHeaders,
      body: responseBody,
      contentType,
    };

    return new Response(JSON.stringify(successResponse), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
    clearTimeout(timeoutId);

    // Handle abort (timeout)
    if (controller.signal.aborted) {
      return jsonError(
        504,
        "gateway-timeout",
        `Request to external API timed out after ${timeout}ms`
      );
    }

    // Handle network errors
    if (err instanceof TypeError) {
      return jsonError(
        502,
        "bad-gateway",
        `Failed to connect to external API: ${err.message}`
      );
    }

    // Handle other errors
    return jsonError(
      500,
      "internal-error",
      `Proxy error: ${err instanceof Error ? err.message : "Unknown error"}`
    );
  }
}
