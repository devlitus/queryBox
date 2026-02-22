import { describe, it, expect } from "vitest";
import {
  validateProxyRequest,
  isAllowedUrl,
  sanitizeRequestHeaders,
  VALID_PROXY_METHODS,
  PROXY_MAX_TIMEOUT,
} from "./proxy-validation";

describe("validateProxyRequest", () => {
  it("validates a valid request", () => {
    const req = {
      url: "https://api.example.com/endpoint",
      method: "GET",
      headers: { "Content-Type": "application/json" },
    };
    expect(validateProxyRequest(req)).toBe(true);
  });

  it("validates a request with optional body", () => {
    const req = {
      url: "https://api.example.com/endpoint",
      method: "POST",
      headers: {},
      body: '{"key":"value"}',
    };
    expect(validateProxyRequest(req)).toBe(true);
  });

  it("validates a request with optional timeout", () => {
    const req = {
      url: "https://api.example.com/endpoint",
      method: "GET",
      headers: {},
      timeout: 5000,
    };
    expect(validateProxyRequest(req)).toBe(true);
  });

  it("rejects request with missing url", () => {
    const req = {
      method: "GET",
      headers: {},
    };
    expect(validateProxyRequest(req)).toBe(false);
  });

  it("rejects request with empty url", () => {
    const req = {
      url: "",
      method: "GET",
      headers: {},
    };
    expect(validateProxyRequest(req)).toBe(false);
  });

  it("rejects request with missing method", () => {
    const req = {
      url: "https://api.example.com",
      headers: {},
    };
    expect(validateProxyRequest(req)).toBe(false);
  });

  it("rejects request with invalid method", () => {
    const req = {
      url: "https://api.example.com",
      method: "INVALID",
      headers: {},
    };
    expect(validateProxyRequest(req)).toBe(false);
  });

  it("rejects request with missing headers", () => {
    const req = {
      url: "https://api.example.com",
      method: "GET",
    };
    expect(validateProxyRequest(req)).toBe(false);
  });

  it("rejects request with non-object headers", () => {
    const req = {
      url: "https://api.example.com",
      method: "GET",
      headers: "not-an-object",
    };
    expect(validateProxyRequest(req)).toBe(false);
  });

  it("rejects request with non-string body", () => {
    const req = {
      url: "https://api.example.com",
      method: "POST",
      headers: {},
      body: 123,
    };
    expect(validateProxyRequest(req)).toBe(false);
  });

  it("rejects request with non-number timeout", () => {
    const req = {
      url: "https://api.example.com",
      method: "GET",
      headers: {},
      timeout: "5000",
    };
    expect(validateProxyRequest(req)).toBe(false);
  });

  it("rejects request with negative timeout", () => {
    const req = {
      url: "https://api.example.com",
      method: "GET",
      headers: {},
      timeout: -100,
    };
    expect(validateProxyRequest(req)).toBe(false);
  });

  it("rejects request with timeout exceeding maximum", () => {
    const req = {
      url: "https://api.example.com",
      method: "GET",
      headers: {},
      timeout: PROXY_MAX_TIMEOUT + 1,
    };
    expect(validateProxyRequest(req)).toBe(false);
  });

  it("accepts all valid HTTP methods", () => {
    for (const method of VALID_PROXY_METHODS) {
      const req = {
        url: "https://api.example.com",
        method,
        headers: {},
      };
      expect(validateProxyRequest(req)).toBe(true);
    }
  });

  it("rejects request with non-string header values", () => {
    const req = {
      url: "https://api.example.com",
      method: "GET",
      headers: { "X-Custom": 123 },
    };
    expect(validateProxyRequest(req)).toBe(false);
  });

  it("rejects non-object input", () => {
    expect(validateProxyRequest(null)).toBe(false);
    expect(validateProxyRequest(undefined)).toBe(false);
    expect(validateProxyRequest("string")).toBe(false);
    expect(validateProxyRequest(123)).toBe(false);
  });
});

describe("isAllowedUrl - Production Mode (isDev=false)", () => {
  it("allows valid HTTPS URLs", () => {
    const result = isAllowedUrl("https://api.example.com/endpoint", false);
    expect(result.allowed).toBe(true);
    expect(result.reason).toBeUndefined();
  });

  it("allows valid HTTP URLs", () => {
    const result = isAllowedUrl("http://api.example.com/endpoint", false);
    expect(result.allowed).toBe(true);
    expect(result.reason).toBeUndefined();
  });

  it("blocks localhost by hostname", () => {
    const result = isAllowedUrl("http://localhost:3000/api", false);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("localhost");
  });

  it("blocks 127.0.0.1 (loopback)", () => {
    const result = isAllowedUrl("http://127.0.0.1:3000/api", false);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("127.x.x.x");
  });

  it("blocks 127.x.x.x range", () => {
    const result = isAllowedUrl("http://127.1.2.3:3000/api", false);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("127.x.x.x");
  });

  it("blocks 10.x.x.x (private network)", () => {
    const result = isAllowedUrl("http://10.0.0.1:3000/api", false);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("10.x.x.x");
  });

  it("blocks 192.168.x.x (private network)", () => {
    const result = isAllowedUrl("http://192.168.1.1:3000/api", false);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("192.168.x.x");
  });

  it("blocks 172.16-31.x.x (private network)", () => {
    const result1 = isAllowedUrl("http://172.16.0.1:3000/api", false);
    expect(result1.allowed).toBe(false);
    expect(result1.reason).toContain("172.16-31.x.x");

    const result2 = isAllowedUrl("http://172.31.255.255:3000/api", false);
    expect(result2.allowed).toBe(false);
    expect(result2.reason).toContain("172.16-31.x.x");
  });

  it("allows 172.32.x.x (not in private range)", () => {
    const result = isAllowedUrl("http://172.32.0.1:3000/api", false);
    expect(result.allowed).toBe(true);
  });

  it("allows 172.15.x.x (not in private range)", () => {
    const result = isAllowedUrl("http://172.15.0.1:3000/api", false);
    expect(result.allowed).toBe(true);
  });

  it("blocks 0.x.x.x", () => {
    const result = isAllowedUrl("http://0.0.0.0:3000/api", false);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("0.x.x.x");
  });

  it("blocks .local domains", () => {
    const result = isAllowedUrl("http://myapi.local:3000/api", false);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain(".local");
  });

  it("blocks IPv6 loopback ::1", () => {
    const result = isAllowedUrl("http://[::1]:3000/api", false);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("IPv6");
  });

  it("blocks IPv6 link-local fe80::", () => {
    const result = isAllowedUrl("http://[fe80::1]:3000/api", false);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("IPv6");
  });

  it("blocks IPv6 unique local fc::", () => {
    const result = isAllowedUrl("http://[fc00::1]:3000/api", false);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("IPv6");
  });

  it("rejects file:// protocol", () => {
    const result = isAllowedUrl("file:///etc/passwd", false);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("file:");
  });

  it("rejects ftp:// protocol", () => {
    const result = isAllowedUrl("ftp://files.example.com/file.txt", false);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("ftp:");
  });

  it("rejects javascript: protocol", () => {
    const result = isAllowedUrl("javascript:alert(1)", false);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("javascript:");
  });

  it("rejects invalid URL format", () => {
    const result = isAllowedUrl("not-a-url", false);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("Invalid URL");
  });

  it("rejects invalid IP addresses", () => {
    // URL constructor rejects obviously invalid IPs before our validation
    const result = isAllowedUrl("http://300.300.300.300", false);
    expect(result.allowed).toBe(false);
    // The error message comes from URL constructor validation, not our IP validation
    expect(result.reason).toContain("Invalid URL");
  });
});

describe("isAllowedUrl - Development Mode (isDev=true)", () => {
  it("allows localhost in dev mode", () => {
    const result = isAllowedUrl("http://localhost:3000/api", true);
    expect(result.allowed).toBe(true);
    expect(result.reason).toBeUndefined();
  });

  it("allows 127.0.0.1 in dev mode", () => {
    const result = isAllowedUrl("http://127.0.0.1:3000/api", true);
    expect(result.allowed).toBe(true);
    expect(result.reason).toBeUndefined();
  });

  it("allows private networks in dev mode", () => {
    expect(isAllowedUrl("http://10.0.0.1:3000/api", true).allowed).toBe(true);
    expect(isAllowedUrl("http://192.168.1.1:3000/api", true).allowed).toBe(true);
    expect(isAllowedUrl("http://172.16.0.1:3000/api", true).allowed).toBe(true);
  });

  it("allows .local domains in dev mode", () => {
    const result = isAllowedUrl("http://myapi.local:3000/api", true);
    expect(result.allowed).toBe(true);
    expect(result.reason).toBeUndefined();
  });

  it("allows public URLs in dev mode", () => {
    const result = isAllowedUrl("https://api.example.com/endpoint", true);
    expect(result.allowed).toBe(true);
    expect(result.reason).toBeUndefined();
  });

  it("still blocks non-HTTP protocols in dev mode", () => {
    const result = isAllowedUrl("file:///etc/passwd", true);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("file:");
  });

  it("still blocks ftp in dev mode", () => {
    const result = isAllowedUrl("ftp://files.example.com/file.txt", true);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("ftp:");
  });

  it("still rejects invalid URLs in dev mode", () => {
    const result = isAllowedUrl("not-a-url", true);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("Invalid URL");
  });
});

describe("sanitizeRequestHeaders", () => {
  it("preserves safe headers", () => {
    const headers = {
      "Content-Type": "application/json",
      "Authorization": "Bearer token123",
      "X-Custom-Header": "custom-value",
    };
    const sanitized = sanitizeRequestHeaders(headers);
    expect(sanitized).toEqual(headers);
  });

  it("removes Host header", () => {
    const headers = {
      "Host": "example.com",
      "Content-Type": "application/json",
    };
    const sanitized = sanitizeRequestHeaders(headers);
    expect(sanitized).not.toHaveProperty("Host");
    expect(sanitized).toHaveProperty("Content-Type");
  });

  it("removes Connection header", () => {
    const headers = {
      "Connection": "keep-alive",
      "Content-Type": "application/json",
    };
    const sanitized = sanitizeRequestHeaders(headers);
    expect(sanitized).not.toHaveProperty("Connection");
    expect(sanitized).toHaveProperty("Content-Type");
  });

  it("removes Keep-Alive header", () => {
    const headers = {
      "Keep-Alive": "timeout=5",
      "Content-Type": "application/json",
    };
    const sanitized = sanitizeRequestHeaders(headers);
    expect(sanitized).not.toHaveProperty("Keep-Alive");
  });

  it("removes Transfer-Encoding header", () => {
    const headers = {
      "Transfer-Encoding": "chunked",
      "Content-Type": "application/json",
    };
    const sanitized = sanitizeRequestHeaders(headers);
    expect(sanitized).not.toHaveProperty("Transfer-Encoding");
  });

  it("removes Upgrade header", () => {
    const headers = {
      "Upgrade": "websocket",
      "Content-Type": "application/json",
    };
    const sanitized = sanitizeRequestHeaders(headers);
    expect(sanitized).not.toHaveProperty("Upgrade");
  });

  it("removes Proxy-* headers", () => {
    const headers = {
      "Proxy-Authorization": "Basic abc123",
      "Proxy-Connection": "keep-alive",
      "Content-Type": "application/json",
    };
    const sanitized = sanitizeRequestHeaders(headers);
    expect(sanitized).not.toHaveProperty("Proxy-Authorization");
    expect(sanitized).not.toHaveProperty("Proxy-Connection");
    expect(sanitized).toHaveProperty("Content-Type");
  });

  it("is case-insensitive for blocklisted headers", () => {
    const headers = {
      "HOST": "example.com",
      "host": "example.com",
      "Host": "example.com",
      "CONNECTION": "keep-alive",
      "Content-Type": "application/json",
    };
    const sanitized = sanitizeRequestHeaders(headers);
    expect(sanitized).not.toHaveProperty("HOST");
    expect(sanitized).not.toHaveProperty("host");
    expect(sanitized).not.toHaveProperty("Host");
    expect(sanitized).not.toHaveProperty("CONNECTION");
    expect(sanitized).toHaveProperty("Content-Type");
  });

  it("removes TE header", () => {
    const headers = {
      "TE": "trailers",
      "Content-Type": "application/json",
    };
    const sanitized = sanitizeRequestHeaders(headers);
    expect(sanitized).not.toHaveProperty("TE");
  });

  it("removes Trailer header", () => {
    const headers = {
      "Trailer": "Expires",
      "Content-Type": "application/json",
    };
    const sanitized = sanitizeRequestHeaders(headers);
    expect(sanitized).not.toHaveProperty("Trailer");
  });

  it("returns empty object for empty input", () => {
    const sanitized = sanitizeRequestHeaders({});
    expect(sanitized).toEqual({});
  });

  it("preserves original header key casing", () => {
    const headers = {
      "Content-Type": "application/json",
      "X-Custom-Header": "value",
    };
    const sanitized = sanitizeRequestHeaders(headers);
    expect(Object.keys(sanitized)).toContain("Content-Type");
    expect(Object.keys(sanitized)).toContain("X-Custom-Header");
  });
});
