import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { APIContext } from "astro";

/**
 * Integration tests for the /api/proxy endpoint.
 *
 * Note: These tests mock the global fetch and the APIContext to test the handler logic
 * without requiring a full Astro server instance.
 */

describe("/api/proxy endpoint", () => {
  let originalFetch: typeof fetch;

  beforeEach(() => {
    // Save original fetch
    originalFetch = globalThis.fetch;

    // Reset rate limiter before each test by re-importing
    vi.resetModules();
  });

  afterEach(() => {
    // Restore original fetch
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  async function createMockContext(body: unknown): Promise<APIContext> {
    const bodyString = JSON.stringify(body);
    const encoder = new TextEncoder();
    const bodyBytes = encoder.encode(bodyString);

    const mockReadableStream = new ReadableStream({
      start(controller) {
        controller.enqueue(bodyBytes);
        controller.close();
      },
    });

    return {
      request: {
        body: mockReadableStream,
        headers: new Headers({
          "content-type": "application/json",
          "content-length": String(bodyBytes.length),
        }),
      } as Request,
      clientAddress: "127.0.0.1",
    } as APIContext;
  }

  it("forwards a valid request and returns the response", async () => {
    // Mock external API response
    globalThis.fetch = vi.fn().mockResolvedValue({
      status: 200,
      statusText: "OK",
      headers: new Headers({
        "Content-Type": "application/json",
        "X-Custom-Header": "custom-value",
      }),
      text: async () => '{"result":"success"}',
    });

    const { POST } = await import("../proxy");

    const context = await createMockContext({
      url: "https://api.example.com/endpoint",
      method: "GET",
      headers: { "User-Agent": "queryBox/1.0" },
    });

    const response = await POST(context);
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.status).toBe(200);
    expect(data.statusText).toBe("OK");
    expect(data.body).toBe('{"result":"success"}');
    expect(data.contentType).toBe("application/json");
    expect(data.headers).toHaveProperty("Content-Type");
    expect(data.headers).toHaveProperty("X-Custom-Header");
  });

  it("rejects request with missing body", async () => {
    const { POST } = await import("../proxy");

    const context = {
      request: {
        body: null,
        headers: new Headers({ "content-type": "application/json" }),
      } as Request,
      clientAddress: "127.0.0.1",
    } as APIContext;

    const response = await POST(context);
    expect(response.status).toBe(400);

    const data = await response.json();
    expect(data.error).toBe("invalid-request");
    expect(data.message).toContain("Missing request body");
  });

  it("rejects request with invalid JSON", async () => {
    const invalidJson = "not valid json";
    const encoder = new TextEncoder();
    const bodyBytes = encoder.encode(invalidJson);

    const mockReadableStream = new ReadableStream({
      start(controller) {
        controller.enqueue(bodyBytes);
        controller.close();
      },
    });

    const { POST } = await import("../proxy");

    const context = {
      request: {
        body: mockReadableStream,
        headers: new Headers({
          "content-type": "application/json",
          "content-length": String(bodyBytes.length),
        }),
      } as Request,
      clientAddress: "127.0.0.1",
    } as APIContext;

    const response = await POST(context);
    expect(response.status).toBe(400);

    const data = await response.json();
    expect(data.error).toBe("invalid-request");
    expect(data.message).toContain("valid JSON");
  });

  it("rejects request with invalid method", async () => {
    const { POST } = await import("../proxy");

    const context = await createMockContext({
      url: "https://api.example.com",
      method: "INVALID",
      headers: {},
    });

    const response = await POST(context);
    expect(response.status).toBe(400);

    const data = await response.json();
    expect(data.error).toBe("invalid-request");
  });

  it("returns 504 on timeout", async () => {
    // Mock a fetch that gets aborted
    let abortCalled = false;
    globalThis.fetch = vi.fn().mockImplementation((_url, options) => {
      return new Promise((resolve, reject) => {
        const signal = options?.signal as AbortSignal | undefined;
        if (signal) {
          signal.addEventListener("abort", () => {
            abortCalled = true;
            reject(new DOMException("The operation was aborted", "AbortError"));
          });
        }
      });
    });

    const { POST } = await import("../proxy");

    const context = await createMockContext({
      url: "https://api.example.com/slow",
      method: "GET",
      headers: {},
      timeout: 50, // Very short timeout
    });

    const response = await POST(context);
    expect(abortCalled).toBe(true);
    expect(response.status).toBe(504);

    const data = await response.json();
    expect(data.error).toBe("gateway-timeout");
    expect(data.message).toContain("timed out");
  }, 5000); // 5 second test timeout

  it("returns 502 on network error", async () => {
    // Mock a network failure
    globalThis.fetch = vi.fn().mockRejectedValue(new TypeError("Network error"));

    const { POST } = await import("../proxy");

    const context = await createMockContext({
      url: "https://api.example.com/endpoint",
      method: "GET",
      headers: {},
    });

    const response = await POST(context);
    expect(response.status).toBe(502);

    const data = await response.json();
    expect(data.error).toBe("bad-gateway");
    expect(data.message).toContain("Failed to connect");
  });
});
