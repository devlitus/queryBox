import type { RequestState, ResponseState, HttpError } from "../types/http";
import type { DiagnosisContext } from "../types/ai";

/**
 * Patterns that indicate a sensitive parameter/header/field.
 * If any of these strings appear in a key name (case-insensitive), the value is redacted.
 */
const SENSITIVE_PATTERNS = [
  "key",
  "token",
  "secret",
  "password",
  "auth",
  "api_key",
  "apikey",
  "access_token",
  "credential",
];

/**
 * Headers that should be completely excluded from the diagnosis context.
 */
const EXCLUDED_HEADERS = [
  "authorization",
  "cookie",
  "set-cookie",
  "x-api-key",
];

const MAX_REQUEST_BODY_LENGTH = 1000;
const MAX_RESPONSE_BODY_LENGTH = 2000;
const REDACTED = "[REDACTED]";

/**
 * Checks if a string contains any sensitive pattern (case-insensitive).
 */
function isSensitive(str: string): boolean {
  const lowerStr = str.toLowerCase();
  return SENSITIVE_PATTERNS.some((pattern) => lowerStr.includes(pattern));
}

/**
 * Sanitizes a URL by redacting sensitive query parameter values.
 * Returns the sanitized URL string.
 */
function sanitizeUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    const params = urlObj.searchParams;

    // Check each param and redact sensitive ones
    for (const [key] of params) {
      if (isSensitive(key)) {
        params.set(key, REDACTED);
      }
    }

    return urlObj.toString();
  } catch {
    // URL is malformed — return without query params
    return url.split("?")[0] ?? url;
  }
}

/**
 * Filters and sanitizes request headers.
 * Only includes enabled headers and excludes sensitive ones.
 */
function sanitizeRequestHeaders(
  headers: RequestState["headers"]
): Array<{ key: string; value: string }> {
  return headers
    .filter((h) => h.enabled && h.key !== "")
    .filter((h) => !EXCLUDED_HEADERS.includes(h.key.toLowerCase()))
    .filter((h) => !isSensitive(h.key))
    .map((h) => ({ key: h.key, value: h.value }));
}

/**
 * Filters and sanitizes response headers.
 * Excludes sensitive ones.
 */
function sanitizeResponseHeaders(
  headers: Array<{ key: string; value: string }>
): Array<{ key: string; value: string }> {
  return headers
    .filter((h) => !EXCLUDED_HEADERS.includes(h.key.toLowerCase()))
    .filter((h) => !isSensitive(h.key));
}

/**
 * Truncates and redacts sensitive fields in a JSON body.
 * If the body is not valid JSON, returns the truncated raw body.
 */
function sanitizeBody(body: string, maxLength: number): string {
  const truncated = body.substring(0, maxLength);

  try {
    const parsed = JSON.parse(truncated);

    // Redact sensitive fields in the JSON object
    const sanitized = redactSensitiveFields(parsed);

    return JSON.stringify(sanitized, null, 2);
  } catch {
    // Not valid JSON — return truncated raw body
    return truncated;
  }
}

/**
 * Recursively redacts sensitive fields in a JSON object.
 */
function redactSensitiveFields(obj: unknown): unknown {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(redactSensitiveFields);
  }

  if (typeof obj === "object") {
    const result: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(obj)) {
      if (isSensitive(key)) {
        result[key] = REDACTED;
      } else {
        result[key] = redactSensitiveFields(value);
      }
    }

    return result;
  }

  return obj;
}

/**
 * Sanitizes the request context by removing all sensitive information
 * before sending it to the AI service.
 *
 * @param request - The request state from the active tab
 * @param response - The response state (if available)
 * @param error - The HTTP error (if any)
 * @returns A sanitized DiagnosisContext safe to send to the AI
 */
export function sanitizeRequestContext(
  request: RequestState,
  response: ResponseState | null,
  error: HttpError | null
): DiagnosisContext {
  return {
    method: request.method,
    url: sanitizeUrl(request.url),
    statusCode: response?.status ?? null,
    statusText: response?.statusText ?? (error?.type ?? "unknown"),
    errorType: error?.type ?? "unknown",
    errorMessage: error?.message ?? "No error message",
    responseBodyExcerpt: response
      ? sanitizeBody(response.body, MAX_RESPONSE_BODY_LENGTH)
      : "",
    requestHeaders: sanitizeRequestHeaders(request.headers),
    responseHeaders: response
      ? sanitizeResponseHeaders(response.headers)
      : [],
    requestBodyExcerpt:
      request.body.mode === "raw"
        ? sanitizeBody(request.body.raw, MAX_REQUEST_BODY_LENGTH)
        : "",
    contentType: request.body.contentType,
  };
}
