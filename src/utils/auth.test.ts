import { describe, it, expect } from "vitest";
import { resolveAuthHeaders } from "./auth";
import type { AuthConfig } from "../types/auth";

// ---------------------------------------------------------------------------
// resolveAuthHeaders — none
// ---------------------------------------------------------------------------

describe("resolveAuthHeaders — none", () => {
  it("returns empty headers and params arrays", () => {
    const auth: AuthConfig = { type: "none" };
    const result = resolveAuthHeaders(auth);
    expect(result.headers).toHaveLength(0);
    expect(result.params).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// resolveAuthHeaders — basic
// ---------------------------------------------------------------------------

describe("resolveAuthHeaders — basic", () => {
  it("generates Authorization: Basic header with base64(username:password)", () => {
    const auth: AuthConfig = { type: "basic", basic: { username: "user", password: "pass" } };
    const result = resolveAuthHeaders(auth);
    expect(result.headers).toHaveLength(1);
    expect(result.headers[0].key).toBe("Authorization");
    // "user:pass" in base64
    expect(result.headers[0].value).toBe("Basic dXNlcjpwYXNz");
    expect(result.params).toHaveLength(0);
  });

  it("handles password containing colons (valid per RFC 7617)", () => {
    const auth: AuthConfig = { type: "basic", basic: { username: "user", password: "pa:ss:word" } };
    const result = resolveAuthHeaders(auth);
    // "user:pa:ss:word" base64
    const expected = btoa("user:pa:ss:word");
    expect(result.headers[0].value).toBe(`Basic ${expected}`);
  });

  it("handles unicode characters in username and password", () => {
    const auth: AuthConfig = { type: "basic", basic: { username: "ユーザー", password: "パスワード" } };
    const result = resolveAuthHeaders(auth);
    expect(result.headers).toHaveLength(1);
    expect(result.headers[0].key).toBe("Authorization");
    // Should start with "Basic " and not throw
    expect(result.headers[0].value).toMatch(/^Basic /);
  });

  it("handles emoji characters (multi-byte Unicode) without throwing", () => {
    const auth: AuthConfig = { type: "basic", basic: { username: "user🔑", password: "pass🔐" } };
    expect(() => resolveAuthHeaders(auth)).not.toThrow();
    const result = resolveAuthHeaders(auth);
    expect(result.headers[0].value).toMatch(/^Basic /);
  });

  it("generates header even when username and password are empty strings", () => {
    const auth: AuthConfig = { type: "basic", basic: { username: "", password: "" } };
    const result = resolveAuthHeaders(auth);
    // ":" base64 = "Og=="
    expect(result.headers[0].value).toBe("Basic Og==");
  });

  it("generates header when only password is empty", () => {
    const auth: AuthConfig = { type: "basic", basic: { username: "admin", password: "" } };
    const result = resolveAuthHeaders(auth);
    // "admin:" base64
    const expected = btoa("admin:");
    expect(result.headers[0].value).toBe(`Basic ${expected}`);
  });
});

// ---------------------------------------------------------------------------
// resolveAuthHeaders — bearer
// ---------------------------------------------------------------------------

describe("resolveAuthHeaders — bearer", () => {
  it("generates Authorization header with default 'Bearer' prefix", () => {
    const auth: AuthConfig = { type: "bearer", bearer: { token: "abc123", prefix: "Bearer" } };
    const result = resolveAuthHeaders(auth);
    expect(result.headers).toHaveLength(1);
    expect(result.headers[0].key).toBe("Authorization");
    expect(result.headers[0].value).toBe("Bearer abc123");
    expect(result.params).toHaveLength(0);
  });

  it("uses custom prefix (Token — Django REST)", () => {
    const auth: AuthConfig = { type: "bearer", bearer: { token: "mytoken", prefix: "Token" } };
    const result = resolveAuthHeaders(auth);
    expect(result.headers[0].value).toBe("Token mytoken");
  });

  it("uses custom prefix (Bot — Discord)", () => {
    const auth: AuthConfig = { type: "bearer", bearer: { token: "bottoken", prefix: "Bot" } };
    const result = resolveAuthHeaders(auth);
    expect(result.headers[0].value).toBe("Bot bottoken");
  });

  it("generates header even when token is empty", () => {
    const auth: AuthConfig = { type: "bearer", bearer: { token: "", prefix: "Bearer" } };
    const result = resolveAuthHeaders(auth);
    // Per plan: does not filter — empty fields still produce headers
    expect(result.headers[0].value).toBe("Bearer ");
  });

  it("handles JWT-length tokens without truncation", () => {
    const jwt = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9." + "a".repeat(400) + "." + "b".repeat(43);
    const auth: AuthConfig = { type: "bearer", bearer: { token: jwt, prefix: "Bearer" } };
    const result = resolveAuthHeaders(auth);
    expect(result.headers[0].value).toBe(`Bearer ${jwt}`);
  });
});

// ---------------------------------------------------------------------------
// resolveAuthHeaders — apikey (header)
// ---------------------------------------------------------------------------

describe("resolveAuthHeaders — apikey as header", () => {
  it("generates a custom header with the given key and value", () => {
    const auth: AuthConfig = {
      type: "apikey",
      apikey: { key: "X-API-Key", value: "secret123", addTo: "header" },
    };
    const result = resolveAuthHeaders(auth);
    expect(result.headers).toHaveLength(1);
    expect(result.headers[0].key).toBe("X-API-Key");
    expect(result.headers[0].value).toBe("secret123");
    expect(result.params).toHaveLength(0);
  });

  it("generates header even when key and value are empty strings", () => {
    const auth: AuthConfig = {
      type: "apikey",
      apikey: { key: "", value: "", addTo: "header" },
    };
    const result = resolveAuthHeaders(auth);
    expect(result.headers).toHaveLength(1);
    expect(result.headers[0].key).toBe("");
    expect(result.headers[0].value).toBe("");
  });
});

// ---------------------------------------------------------------------------
// resolveAuthHeaders — apikey (query)
// ---------------------------------------------------------------------------

describe("resolveAuthHeaders — apikey as query param", () => {
  it("returns empty headers and one query param", () => {
    const auth: AuthConfig = {
      type: "apikey",
      apikey: { key: "api_key", value: "mykey123", addTo: "query" },
    };
    const result = resolveAuthHeaders(auth);
    expect(result.headers).toHaveLength(0);
    expect(result.params).toHaveLength(1);
    expect(result.params[0].key).toBe("api_key");
    expect(result.params[0].value).toBe("mykey123");
  });

  it("generates query param even when key and value are empty strings", () => {
    const auth: AuthConfig = {
      type: "apikey",
      apikey: { key: "", value: "", addTo: "query" },
    };
    const result = resolveAuthHeaders(auth);
    expect(result.params).toHaveLength(1);
    expect(result.params[0].key).toBe("");
    expect(result.params[0].value).toBe("");
  });
});
