import { describe, it, expect } from "vitest";
import { sanitizeRequestContext } from "../ai-sanitizer";
import type { RequestState, ResponseState, HttpError } from "../../types/http";
import type { AuthConfig } from "../../types/auth";

const DEFAULT_AUTH: AuthConfig = { type: "none" };

function makeRequestState(overrides?: Partial<RequestState>): RequestState {
  return {
    method: "GET",
    url: "https://api.example.com/users",
    params: [],
    headers: [],
    body: {
      mode: "none",
      contentType: "json",
      raw: "",
    },
    auth: DEFAULT_AUTH,
    ...overrides,
  };
}

function makeResponseState(overrides?: Partial<ResponseState>): ResponseState {
  return {
    status: 200,
    statusText: "OK",
    headers: [],
    body: "",
    contentType: "application/json",
    time: 100,
    size: 1024,
    ...overrides,
  };
}

function makeHttpError(overrides?: Partial<HttpError>): HttpError {
  return {
    message: "Network error",
    type: "network",
    ...overrides,
  };
}

describe("sanitizeRequestContext", () => {
  describe("URL sanitization", () => {
    it("redacts sensitive query params (api_key)", () => {
      const request = makeRequestState({
        url: "https://api.example.com/users?api_key=secret123&page=1",
      });
      const context = sanitizeRequestContext(request, null, null);

      // URL params are URL-encoded, so [REDACTED] becomes %5BREDACTED%5D
      expect(decodeURIComponent(context.url)).toContain("api_key=[REDACTED]");
      expect(context.url).toContain("page=1");
      expect(context.url).not.toContain("secret123");
    });

    it("redacts sensitive query params (token)", () => {
      const request = makeRequestState({
        url: "https://api.example.com/data?token=xyz789&limit=10",
      });
      const context = sanitizeRequestContext(request, null, null);

      expect(decodeURIComponent(context.url)).toContain("token=[REDACTED]");
      expect(context.url).toContain("limit=10");
      expect(context.url).not.toContain("xyz789");
    });

    it("redacts multiple sensitive params", () => {
      const request = makeRequestState({
        url: "https://api.example.com/endpoint?api_key=key1&password=pass1&user=john",
      });
      const context = sanitizeRequestContext(request, null, null);

      const decoded = decodeURIComponent(context.url);
      expect(decoded).toContain("api_key=[REDACTED]");
      expect(decoded).toContain("password=[REDACTED]");
      expect(context.url).toContain("user=john");
    });

    it("handles malformed URLs gracefully", () => {
      const request = makeRequestState({
        url: "not-a-valid-url?api_key=secret",
      });
      const context = sanitizeRequestContext(request, null, null);

      // Should return URL without query params
      expect(context.url).toBe("not-a-valid-url");
    });
  });

  describe("Header sanitization", () => {
    it("excludes Authorization header", () => {
      const request = makeRequestState({
        headers: [
          {
            id: "1",
            key: "Authorization",
            value: "Bearer secret-token",
            enabled: true,
          },
          { id: "2", key: "Content-Type", value: "application/json", enabled: true },
        ],
      });
      const context = sanitizeRequestContext(request, null, null);

      expect(context.requestHeaders).toHaveLength(1);
      expect(context.requestHeaders[0].key).toBe("Content-Type");
      expect(context.requestHeaders.some((h) => h.key === "Authorization")).toBe(
        false
      );
    });

    it("excludes Cookie and Set-Cookie headers", () => {
      const request = makeRequestState({
        headers: [
          { id: "1", key: "Cookie", value: "session=abc123", enabled: true },
          {
            id: "2",
            key: "X-Custom-Header",
            value: "custom-value",
            enabled: true,
          },
        ],
      });
      const response = makeResponseState({
        headers: [
          { key: "Set-Cookie", value: "session=xyz; HttpOnly" },
          { key: "Content-Type", value: "application/json" },
        ],
      });
      const context = sanitizeRequestContext(request, response, null);

      expect(context.requestHeaders.some((h) => h.key === "Cookie")).toBe(false);
      expect(
        context.responseHeaders.some((h) => h.key === "Set-Cookie")
      ).toBe(false);
      expect(context.responseHeaders.some((h) => h.key === "Content-Type")).toBe(
        true
      );
    });

    it("excludes headers with sensitive patterns", () => {
      const request = makeRequestState({
        headers: [
          { id: "1", key: "X-API-Key", value: "secret", enabled: true },
          { id: "2", key: "X-Auth-Token", value: "token123", enabled: true },
          { id: "3", key: "User-Agent", value: "MyApp/1.0", enabled: true },
        ],
      });
      const context = sanitizeRequestContext(request, null, null);

      // X-API-Key and X-Auth-Token should be excluded
      expect(context.requestHeaders).toHaveLength(1);
      expect(context.requestHeaders[0].key).toBe("User-Agent");
    });

    it("only includes enabled headers", () => {
      const request = makeRequestState({
        headers: [
          { id: "1", key: "Accept", value: "*/*", enabled: true },
          { id: "2", key: "X-Custom", value: "test", enabled: false },
        ],
      });
      const context = sanitizeRequestContext(request, null, null);

      expect(context.requestHeaders).toHaveLength(1);
      expect(context.requestHeaders[0].key).toBe("Accept");
    });

    it("excludes empty header keys", () => {
      const request = makeRequestState({
        headers: [
          { id: "1", key: "", value: "value", enabled: true },
          { id: "2", key: "Accept", value: "application/json", enabled: true },
        ],
      });
      const context = sanitizeRequestContext(request, null, null);

      expect(context.requestHeaders).toHaveLength(1);
      expect(context.requestHeaders[0].key).toBe("Accept");
    });
  });

  describe("Body sanitization", () => {
    it("truncates request body to 1000 characters", () => {
      const longBody = "x".repeat(2000);
      const request = makeRequestState({
        body: { mode: "raw", contentType: "text", raw: longBody },
      });
      const context = sanitizeRequestContext(request, null, null);

      expect(context.requestBodyExcerpt.length).toBeLessThanOrEqual(1000);
    });

    it("truncates response body to 2000 characters", () => {
      const longBody = "y".repeat(5000);
      const response = makeResponseState({ body: longBody });
      const context = sanitizeRequestContext(
        makeRequestState(),
        response,
        null
      );

      expect(context.responseBodyExcerpt.length).toBeLessThanOrEqual(2000);
    });

    it("redacts sensitive JSON fields in request body", () => {
      const request = makeRequestState({
        body: {
          mode: "raw",
          contentType: "json",
          raw: JSON.stringify({
            username: "john",
            password: "secret123",
            api_key: "key456",
            email: "john@example.com",
          }),
        },
      });
      const context = sanitizeRequestContext(request, null, null);

      const bodyObj = JSON.parse(context.requestBodyExcerpt);
      expect(bodyObj.password).toBe("[REDACTED]");
      expect(bodyObj.api_key).toBe("[REDACTED]");
      expect(bodyObj.username).toBe("john");
      expect(bodyObj.email).toBe("john@example.com");
    });

    it("redacts object with sensitive field name", () => {
      const request = makeRequestState({
        body: {
          mode: "raw",
          contentType: "json",
          raw: JSON.stringify({
            user: {
              name: "Alice",
              credentials: {
                password: "pass123",
                token: "token456",
              },
            },
          }),
        },
      });
      const context = sanitizeRequestContext(request, null, null);

      const bodyObj = JSON.parse(context.requestBodyExcerpt);
      expect(bodyObj.user.name).toBe("Alice");
      // The entire "credentials" object is redacted because the key name is sensitive
      expect(bodyObj.user.credentials).toBe("[REDACTED]");
    });

    it("redacts individual sensitive fields in nested objects", () => {
      const request = makeRequestState({
        body: {
          mode: "raw",
          contentType: "json",
          raw: JSON.stringify({
            user: {
              name: "Alice",
              auth: {
                username: "alice",
                password: "pass123",
              },
              publicKey: "key789",
            },
          }),
        },
      });
      const context = sanitizeRequestContext(request, null, null);

      const bodyObj = JSON.parse(context.requestBodyExcerpt);
      expect(bodyObj.user.name).toBe("Alice");
      // The "auth" object is redacted entirely because "auth" is sensitive
      expect(bodyObj.user.auth).toBe("[REDACTED]");
      // The "publicKey" field is redacted because "key" is sensitive
      expect(bodyObj.user.publicKey).toBe("[REDACTED]");
    });

    it("handles non-JSON body gracefully", () => {
      const request = makeRequestState({
        body: {
          mode: "raw",
          contentType: "text",
          raw: "This is plain text with password=secret123",
        },
      });
      const context = sanitizeRequestContext(request, null, null);

      // Should return truncated raw text (not crash)
      expect(context.requestBodyExcerpt).toContain("This is plain text");
    });

    it("handles empty body", () => {
      const request = makeRequestState({
        body: { mode: "none", contentType: "json", raw: "" },
      });
      const context = sanitizeRequestContext(request, null, null);

      expect(context.requestBodyExcerpt).toBe("");
    });
  });

  describe("Error context", () => {
    it("includes error type and message", () => {
      const error = makeHttpError({ type: "cors", message: "CORS error" });
      const context = sanitizeRequestContext(makeRequestState(), null, error);

      expect(context.errorType).toBe("cors");
      expect(context.errorMessage).toBe("CORS error");
    });

    it("handles missing error gracefully", () => {
      const context = sanitizeRequestContext(makeRequestState(), null, null);

      expect(context.errorType).toBe("unknown");
      expect(context.errorMessage).toBe("No error message");
    });
  });

  describe("Response context", () => {
    it("includes status code and text", () => {
      const response = makeResponseState({
        status: 404,
        statusText: "Not Found",
      });
      const context = sanitizeRequestContext(
        makeRequestState(),
        response,
        null
      );

      expect(context.statusCode).toBe(404);
      expect(context.statusText).toBe("Not Found");
    });

    it("handles missing response gracefully", () => {
      const error = makeHttpError({ type: "timeout" });
      const context = sanitizeRequestContext(makeRequestState(), null, error);

      expect(context.statusCode).toBeNull();
      expect(context.statusText).toBe("timeout");
    });
  });

  describe("Complete context", () => {
    it("generates complete diagnosis context", () => {
      const request = makeRequestState({
        method: "POST",
        url: "https://api.example.com/login?session_key=abc123",
        headers: [
          { id: "1", key: "Content-Type", value: "application/json", enabled: true },
        ],
        body: {
          mode: "raw",
          contentType: "json",
          raw: JSON.stringify({ username: "alice", password: "pass123" }),
        },
      });

      const response = makeResponseState({
        status: 401,
        statusText: "Unauthorized",
        body: JSON.stringify({ error: "Invalid credentials" }),
        headers: [{ key: "Content-Type", value: "application/json" }],
      });

      const error = makeHttpError({
        type: "unknown",
        message: "Authentication failed",
      });

      const context = sanitizeRequestContext(request, response, error);

      expect(context.method).toBe("POST");
      expect(decodeURIComponent(context.url)).toContain("session_key=[REDACTED]");
      expect(context.statusCode).toBe(401);
      expect(context.statusText).toBe("Unauthorized");
      expect(context.errorType).toBe("unknown");
      expect(context.errorMessage).toBe("Authentication failed");

      const reqBody = JSON.parse(context.requestBodyExcerpt);
      expect(reqBody.password).toBe("[REDACTED]");
      expect(reqBody.username).toBe("alice");

      expect(context.requestHeaders).toHaveLength(1);
      expect(context.responseHeaders).toHaveLength(1);
      expect(context.contentType).toBe("json");
    });
  });
});
