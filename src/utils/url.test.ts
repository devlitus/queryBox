import { describe, it, expect } from "vitest";
import { parseQueryParams, buildUrlWithParams, formatBytes } from "./url";
import type { KeyValuePair } from "../types/http";

// ---------------------------------------------------------------------------
// parseQueryParams
// ---------------------------------------------------------------------------

describe("parseQueryParams", () => {
  it("returns empty array for empty string", () => {
    expect(parseQueryParams("")).toEqual([]);
  });

  it("returns empty array for URL without query params", () => {
    expect(parseQueryParams("https://api.example.com")).toEqual([]);
  });

  it("parses single query param from full URL", () => {
    const result = parseQueryParams("https://api.example.com?key=value");
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ key: "key", value: "value", enabled: true });
    expect(typeof result[0].id).toBe("string");
    expect(result[0].id.length).toBeGreaterThan(0);
  });

  it("parses multiple query params", () => {
    const result = parseQueryParams("https://api.example.com?a=1&b=2&c=3");
    expect(result).toHaveLength(3);
    expect(result[0]).toMatchObject({ key: "a", value: "1", enabled: true });
    expect(result[1]).toMatchObject({ key: "b", value: "2", enabled: true });
    expect(result[2]).toMatchObject({ key: "c", value: "3", enabled: true });
  });

  it("handles URL without protocol", () => {
    const result = parseQueryParams("path?foo=bar");
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ key: "foo", value: "bar", enabled: true });
  });

  it("returns empty array for completely invalid/malformed input", () => {
    // A string that can't be parsed as URL even with dummy base
    expect(parseQueryParams(":::invalid:::")).toEqual([]);
  });

  it("each returned item has id, key, value and enabled:true", () => {
    const result = parseQueryParams("https://api.example.com?x=y");
    expect(result[0]).toHaveProperty("id");
    expect(result[0]).toHaveProperty("key", "x");
    expect(result[0]).toHaveProperty("value", "y");
    expect(result[0]).toHaveProperty("enabled", true);
  });

  it("handles URL-encoded characters in params", () => {
    const result = parseQueryParams("https://api.example.com?q=hello%20world&name=foo%2Bbar");
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ key: "q", value: "hello world" });
    expect(result[1]).toMatchObject({ key: "name", value: "foo+bar" });
  });

  it("generates unique ids for each param", () => {
    const result = parseQueryParams("https://api.example.com?a=1&b=2");
    expect(result[0].id).not.toBe(result[1].id);
  });

  it("returns empty array for URL with path but no query params", () => {
    expect(parseQueryParams("https://api.example.com/v1/users")).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// buildUrlWithParams
// ---------------------------------------------------------------------------

describe("buildUrlWithParams", () => {
  it("returns empty string for empty baseUrl", () => {
    expect(buildUrlWithParams("", [])).toBe("");
  });

  it("returns baseUrl unchanged when params array is empty", () => {
    expect(buildUrlWithParams("https://api.example.com", [])).toBe("https://api.example.com/");
  });

  it("returns baseUrl unchanged when all params are disabled", () => {
    const params: KeyValuePair[] = [
      { id: "1", key: "foo", value: "bar", enabled: false },
    ];
    expect(buildUrlWithParams("https://api.example.com", params)).toBe("https://api.example.com/");
  });

  it("appends single enabled param to URL", () => {
    const params: KeyValuePair[] = [
      { id: "1", key: "foo", value: "bar", enabled: true },
    ];
    expect(buildUrlWithParams("https://api.example.com", params)).toBe(
      "https://api.example.com/?foo=bar"
    );
  });

  it("appends multiple enabled params", () => {
    const params: KeyValuePair[] = [
      { id: "1", key: "a", value: "1", enabled: true },
      { id: "2", key: "b", value: "2", enabled: true },
    ];
    const result = buildUrlWithParams("https://api.example.com", params);
    expect(result).toContain("a=1");
    expect(result).toContain("b=2");
  });

  it("skips params with empty key", () => {
    const params: KeyValuePair[] = [
      { id: "1", key: "", value: "bar", enabled: true },
      { id: "2", key: "valid", value: "yes", enabled: true },
    ];
    const result = buildUrlWithParams("https://api.example.com", params);
    expect(result).not.toContain("bar");
    expect(result).toContain("valid=yes");
  });

  it("skips disabled params", () => {
    const params: KeyValuePair[] = [
      { id: "1", key: "disabled", value: "no", enabled: false },
      { id: "2", key: "active", value: "yes", enabled: true },
    ];
    const result = buildUrlWithParams("https://api.example.com", params);
    expect(result).not.toContain("disabled=no");
    expect(result).toContain("active=yes");
  });

  it("handles URL without protocol", () => {
    const params: KeyValuePair[] = [
      { id: "1", key: "q", value: "test", enabled: true },
    ];
    const result = buildUrlWithParams("search", params);
    expect(result).toContain("q=test");
  });

  it("handles malformed URLs with fallback to string concatenation", () => {
    // "http://[invalid" throws TypeError in new URL() — exercises the catch block
    // which falls back to direct string concatenation of params.
    const params: KeyValuePair[] = [
      { id: "1", key: "key", value: "val", enabled: true },
    ];
    const result = buildUrlWithParams("http://[invalid", params);
    expect(result).toContain("key=val");
    expect(result).toContain("http://[invalid");
  });

  it("preserves existing path in URL", () => {
    const result = buildUrlWithParams("https://api.example.com/v1/users", []);
    expect(result).toContain("/v1/users");
  });

  it("returns baseUrl unchanged when params are empty (no trailing slash for path-less URL)", () => {
    const result = buildUrlWithParams("https://api.example.com/path", []);
    expect(result).toBe("https://api.example.com/path");
  });

  it("handles malformed URL with no enabled params: returns baseUrl as-is on full parse failure", () => {
    // ":::invalid:::" has no valid scheme path and no dummy base parse possible
    // The function catches the error and returns baseUrl when enabledParams is empty
    const result = buildUrlWithParams(":::invalid:::", []);
    expect(result).toBe(":::invalid:::");
  });
});

// ---------------------------------------------------------------------------
// formatBytes
// ---------------------------------------------------------------------------

describe("formatBytes", () => {
  it("formats 0 bytes as '0 B'", () => {
    expect(formatBytes(0)).toBe("0 B");
  });

  it("formats bytes below 1024 as 'X B'", () => {
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(1023)).toBe("1023 B");
  });

  it("formats exactly 1024 bytes as '1.00 KB'", () => {
    expect(formatBytes(1024)).toBe("1.00 KB");
  });

  it("formats kilobytes as 'X.XX KB'", () => {
    expect(formatBytes(2048)).toBe("2.00 KB");
    expect(formatBytes(1536)).toBe("1.50 KB");
  });

  it("formats exactly 1048576 bytes (1 MB) as '1.00 MB'", () => {
    expect(formatBytes(1024 * 1024)).toBe("1.00 MB");
  });

  it("formats megabytes as 'X.XX MB'", () => {
    expect(formatBytes(2 * 1024 * 1024)).toBe("2.00 MB");
    expect(formatBytes(1.5 * 1024 * 1024)).toBe("1.50 MB");
  });

  it("formats values just below 1048576 as KB", () => {
    expect(formatBytes(1048575)).toBe("1024.00 KB");
  });
});
