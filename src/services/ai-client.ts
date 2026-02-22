import type {
  DiagnosisContext,
  DiagnosisApiError,
  DiagnosisError,
} from "../types/ai";

/**
 * Requests a diagnosis from the server-side AI service.
 * Streams the response progressively and calls onChunk for each text chunk.
 *
 * @param context - The sanitized diagnosis context
 * @param onChunk - Callback invoked for each chunk of text received
 * @param signal - Optional AbortSignal for cancellation
 * @throws {DiagnosisError} If the request fails
 */
export async function requestDiagnosis(
  context: DiagnosisContext,
  onChunk: (text: string) => void,
  signal?: AbortSignal
): Promise<void> {
  const response = await fetch("/api/diagnose", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(context),
    signal,
  });

  // Handle rate limiting
  if (response.status === 429) {
    const errorData: DiagnosisApiError = await response.json();
    throw {
      message: errorData.message,
      type: "rate-limit",
      retryAfter: errorData.retryAfter,
    } as DiagnosisError;
  }

  // Handle other errors
  if (!response.ok) {
    let errorMessage = "Failed to get diagnosis";
    let errorType: DiagnosisError["type"] = "unknown";

    try {
      const errorData: DiagnosisApiError = await response.json();
      errorMessage = errorData.message;
      // Map error types from API to client error types
      if (errorData.error === "ai-service-error") {
        errorType = "server";
      }
    } catch {
      // Failed to parse error response
      errorMessage = `HTTP ${response.status}: ${response.statusText}`;
    }

    throw {
      message: errorMessage,
      type: errorType,
    } as DiagnosisError;
  }

  // Stream the response
  const reader = response.body?.getReader();
  if (!reader) {
    throw {
      message: "Response body is not readable",
      type: "network",
    } as DiagnosisError;
  }

  const decoder = new TextDecoder();

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      onChunk(chunk);
    }
  } catch (error) {
    // Check if it was aborted
    if (error instanceof Error && error.name === "AbortError") {
      // Cancellation is expected — don't throw
      return;
    }

    throw {
      message: error instanceof Error ? error.message : "Network error",
      type: "network",
    } as DiagnosisError;
  } finally {
    reader.releaseLock();
  }
}
