import type { APIContext } from "astro";
import { checkRateLimit } from "../../server/rate-limiter";
import { streamDiagnosis } from "../../server/groq-service";
import type { DiagnosisContext, DiagnosisApiError } from "../../types/ai";
import Groq from "groq-sdk";

// Mark this endpoint as server-rendered (not pre-rendered)
export const prerender = false;

/**
 * Validates that the request body has all required fields for a DiagnosisContext.
 */
function validateDiagnosisContext(body: unknown): body is DiagnosisContext {
  if (!body || typeof body !== "object") return false;

  const ctx = body as Partial<DiagnosisContext>;

  return (
    typeof ctx.method === "string" &&
    typeof ctx.url === "string" &&
    (ctx.statusCode === null || typeof ctx.statusCode === "number") &&
    typeof ctx.statusText === "string" &&
    typeof ctx.errorType === "string" &&
    typeof ctx.errorMessage === "string" &&
    typeof ctx.responseBodyExcerpt === "string" &&
    Array.isArray(ctx.requestHeaders) &&
    Array.isArray(ctx.responseHeaders) &&
    typeof ctx.requestBodyExcerpt === "string" &&
    typeof ctx.contentType === "string"
  );
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
  // 1. Rate limiting
  const ip = clientAddress || "unknown";
  const rateLimit = checkRateLimit(ip);

  if (!rateLimit.allowed) {
    const retryAfterSeconds = Math.ceil(rateLimit.resetIn / 1000);
    return jsonError(
      429,
      "rate-limit",
      "Too many diagnosis requests. Try again later.",
      retryAfterSeconds
    );
  }

  // 2. Parse and validate request body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "invalid-request", "Invalid JSON in request body");
  }

  if (!validateDiagnosisContext(body)) {
    return jsonError(
      400,
      "invalid-request",
      "Request body does not match DiagnosisContext schema"
    );
  }

  // 3. Check if GROQ_API_KEY is configured
  if (!import.meta.env.GROQ_API_KEY) {
    return jsonError(
      503,
      "service-unavailable",
      "AI diagnosis service is not configured. Please contact the administrator."
    );
  }

  // 4. Stream diagnosis from Groq
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

    // Generic error
    console.error("Error streaming diagnosis:", error);
    return jsonError(502, "ai-service-error", "AI service unavailable");
  }
}
