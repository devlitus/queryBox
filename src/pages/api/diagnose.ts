import type { APIContext } from "astro";
import { checkRateLimit } from "../../server/rate-limiter";
import { streamDiagnosis } from "../../server/groq-service";
import type { DiagnosisContext, DiagnosisApiError } from "../../types/ai";
import Groq from "groq-sdk";

// Mark this endpoint as server-rendered (not pre-rendered)
export const prerender = false;

// Maximum allowed body size: 64 KB. Prevents DoS via large payloads (CWE-400).
const POST_MAX_BODY_SIZE = 64 * 1024;

// Valid HTTP methods for the method field — prevents prompt injection via arbitrary strings (CWE-20).
const VALID_HTTP_METHODS = [
  "GET",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
  "HEAD",
  "OPTIONS",
] as const;

type ValidHttpMethod = (typeof VALID_HTTP_METHODS)[number];

// Maximum string field lengths. Mirrors the sanitizer limits in ai-sanitizer.ts
// but enforced server-side as an independent defense layer.
const MAX_FIELD_LENGTHS = {
  url: 2048,
  method: 10,
  statusText: 256,
  errorType: 64,
  errorMessage: 4096,
  responseBodyExcerpt: 4096,
  requestBodyExcerpt: 2048,
  contentType: 256,
} as const;

/**
 * Validates that the request body has all required fields for a DiagnosisContext,
 * enforces valid HTTP method enum, and enforces maximum string field lengths.
 */
function validateDiagnosisContext(body: unknown): body is DiagnosisContext {
  if (!body || typeof body !== "object") return false;

  const ctx = body as Partial<DiagnosisContext>;

  // Type checks for all required fields
  if (typeof ctx.method !== "string") return false;
  if (typeof ctx.url !== "string") return false;
  if (ctx.statusCode !== null && typeof ctx.statusCode !== "number") return false;
  if (typeof ctx.statusText !== "string") return false;
  if (typeof ctx.errorType !== "string") return false;
  if (typeof ctx.errorMessage !== "string") return false;
  if (typeof ctx.responseBodyExcerpt !== "string") return false;
  if (!Array.isArray(ctx.requestHeaders)) return false;
  if (!Array.isArray(ctx.responseHeaders)) return false;
  if (typeof ctx.requestBodyExcerpt !== "string") return false;
  if (typeof ctx.contentType !== "string") return false;

  // Validate method as a known HTTP verb — prevents prompt injection (M-4)
  if (!VALID_HTTP_METHODS.includes(ctx.method as ValidHttpMethod)) return false;

  // Validate string field lengths — prevents oversized fields bypassing the client sanitizer (H-3)
  if (ctx.url.length > MAX_FIELD_LENGTHS.url) return false;
  if (ctx.method.length > MAX_FIELD_LENGTHS.method) return false;
  if (ctx.statusText.length > MAX_FIELD_LENGTHS.statusText) return false;
  if (ctx.errorType.length > MAX_FIELD_LENGTHS.errorType) return false;
  if (ctx.errorMessage.length > MAX_FIELD_LENGTHS.errorMessage) return false;
  if (ctx.responseBodyExcerpt.length > MAX_FIELD_LENGTHS.responseBodyExcerpt) return false;
  if (ctx.requestBodyExcerpt.length > MAX_FIELD_LENGTHS.requestBodyExcerpt) return false;
  if (ctx.contentType.length > MAX_FIELD_LENGTHS.contentType) return false;

  return true;
}

/**
 * Returns a JSON error response.
 */
function jsonError(
  status: number,
  error: string,
  message: string,
  retryAfter?: number
): Response {
  const body: DiagnosisApiError = {
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
 * POST /api/diagnose
 *
 * Receives a DiagnosisContext, performs rate limiting, and streams a diagnosis
 * from the Groq API back to the client.
 */
export async function POST({ request, clientAddress }: APIContext) {
  // 1. Rate limiting — reject requests with no identifiable client (M-1)
  if (!clientAddress) {
    return jsonError(
      400,
      "bad-request",
      "Cannot process request without client identification"
    );
  }
  const rateLimit = checkRateLimit(clientAddress);

  if (!rateLimit.allowed) {
    const retryAfterSeconds = Math.ceil(rateLimit.resetIn / 1000);
    return jsonError(
      429,
      "rate-limit",
      "Too many diagnosis requests. Try again later.",
      retryAfterSeconds
    );
  }

  // 2. Check Content-Length header before reading the body (fast path for large requests)
  const contentLength = request.headers.get("content-length");
  if (contentLength !== null && parseInt(contentLength, 10) > POST_MAX_BODY_SIZE) {
    return jsonError(413, "payload-too-large", "Request body exceeds maximum allowed size");
  }

  // 3. Read the body as a stream with a hard byte limit to prevent DoS (H-3)
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

      received += value.byteLength;
      if (received > POST_MAX_BODY_SIZE) {
        await reader.cancel();
        return jsonError(413, "payload-too-large", "Request body exceeds maximum allowed size");
      }
      chunks.push(value);
    }

    // Concatenate all chunks into a single Uint8Array, then decode
    const totalLength = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
    const merged = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
      merged.set(chunk, offset);
      offset += chunk.byteLength;
    }
    bodyText = new TextDecoder().decode(merged);
  } catch {
    return jsonError(400, "invalid-request", "Failed to read request body");
  }

  // 4. Parse JSON
  let body: unknown;
  try {
    body = JSON.parse(bodyText);
  } catch {
    return jsonError(400, "invalid-request", "Invalid JSON in request body");
  }

  // 5. Validate structure, enum values, and field lengths
  if (!validateDiagnosisContext(body)) {
    return jsonError(
      400,
      "invalid-request",
      "Request body does not match DiagnosisContext schema"
    );
  }

  // 6. Check if GROQ_API_KEY is configured
  if (!import.meta.env.GROQ_API_KEY) {
    return jsonError(
      503,
      "service-unavailable",
      "AI diagnosis service is not configured. Please contact the administrator."
    );
  }

  // 7. Stream diagnosis from Groq
  try {
    const stream = await streamDiagnosis(body);

    return new Response(stream, {
      status: 200,
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "X-RateLimit-Remaining": String(rateLimit.remaining),
      },
    });
  } catch (error) {
    // Handle Groq API errors
    if (error instanceof Groq.APIError) {
      if (error.status === 401) {
        return jsonError(
          502,
          "ai-service-error",
          "AI service authentication failed. Please contact the administrator."
        );
      }
      if (error.status === 429) {
        return jsonError(
          502,
          "ai-service-error",
          "AI service rate limit reached. Try again later."
        );
      }
    }

    // Log only non-sensitive error metadata to avoid leaking API keys or stack traces
    console.error("Error streaming diagnosis:", {
      type: error instanceof Error ? error.name : typeof error,
      status: error instanceof Groq.APIError ? error.status : "unknown",
    });
    return jsonError(502, "ai-service-error", "AI service unavailable");
  }
}
