import Groq from "groq-sdk";
import type { ChatCompletionMessageParam } from "groq-sdk/resources/chat/completions";
import type { DiagnosisContext } from "../types/ai";

/**
 * System prompt for the AI diagnosis expert.
 * Instructs the model to act as an HTTP debugging assistant.
 */
const SYSTEM_PROMPT = `You are an expert HTTP debugging assistant. Your role is to analyze failed HTTP requests and responses, diagnose the root cause of the error, and provide actionable suggestions to fix the issue.

Guidelines:
1. Analyze the error type, status code, and response body to identify the most likely cause.
2. Provide a clear, concise diagnosis in 2-3 paragraphs maximum.
3. Always suggest specific, actionable steps to resolve the issue.
4. When relevant, mention common causes for the specific status code.
5. If the error is CORS-related, explain what CORS headers are needed and where to configure them.
6. If the error is a timeout or network error, suggest connectivity checks and alternative approaches.
7. Format your response with clear headings and bullet points for readability.
8. If the response body contains an error message from the API, incorporate it into your diagnosis.
9. Be direct and practical — avoid unnecessary preamble.
10. Respond in the same language as the error message when possible, otherwise use English.`;

/**
 * Creates a Groq client instance with the API key from environment variables.
 *
 * @throws {Error} If GROQ_API_KEY is not configured
 */
export function createGroqClient(): Groq {
  const apiKey = import.meta.env.GROQ_API_KEY;

  if (!apiKey) {
    throw new Error(
      "GROQ_API_KEY is not configured. Please set it in your .env file."
    );
  }

  return new Groq({
    apiKey,
    maxRetries: 1,
    timeout: 30000, // 30 seconds
  });
}

/**
 * Builds the messages array for the chat completion request.
 *
 * @param context - The sanitized diagnosis context
 * @returns Array of messages with system prompt and user context
 */
export function buildDiagnosisMessages(
  context: DiagnosisContext
): ChatCompletionMessageParam[] {
  // Format request headers
  const requestHeadersText = context.requestHeaders.length > 0
    ? context.requestHeaders.map((h) => `${h.key}: ${h.value}`).join("\n")
    : "(no headers)";

  // Format response headers
  const responseHeadersText = context.responseHeaders.length > 0
    ? context.responseHeaders.map((h) => `${h.key}: ${h.value}`).join("\n")
    : "(no headers)";

  // Build user message with structured context
  const userMessage = `Diagnose this HTTP request failure:

**Request:**
- Method: ${context.method}
- URL: ${context.url}
- Content-Type: ${context.contentType}

**Request Headers:**
${requestHeadersText}

**Request Body (excerpt):**
${context.requestBodyExcerpt || "(empty)"}

**Error:**
- Type: ${context.errorType}
- Message: ${context.errorMessage}

**Response (if available):**
- Status: ${context.statusCode ?? "N/A"} ${context.statusText}
- Response Headers:
${responseHeadersText}
- Body (excerpt):
${context.responseBodyExcerpt || "(no response body)"}`;

  return [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: userMessage },
  ];
}

/**
 * Streams a diagnosis from the Groq API.
 *
 * @param context - The sanitized diagnosis context
 * @returns A ReadableStream that emits text chunks
 * @throws {Error} If the Groq API returns an error
 */
export async function streamDiagnosis(
  context: DiagnosisContext
): Promise<ReadableStream<Uint8Array>> {
  const client = createGroqClient();
  const messages = buildDiagnosisMessages(context);

  try {
    const stream = await client.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages,
      stream: true,
      temperature: 0.3,
      max_completion_tokens: 1024,
    });

    // Convert Groq stream to standard ReadableStream
    return new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            const content = chunk.choices[0]?.delta?.content;
            if (content) {
              controller.enqueue(new TextEncoder().encode(content));
            }
          }
          controller.close();
        } catch (error) {
          controller.error(error);
        }
      },
    });
  } catch (error) {
    // Handle Groq API errors
    if (error instanceof Groq.APIError) {
      throw error;
    }
    throw new Error("Failed to create diagnosis stream");
  }
}
