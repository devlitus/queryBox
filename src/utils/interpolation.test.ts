import { describe, it, expect } from "vitest";
import {
  interpolateVariables,
  extractVariableNames,
  hasVariables,
  interpolateRequest,
} from "./interpolation";
import { makeRequestState, makeKeyValuePair } from "../test/factories";

// ---------------------------------------------------------------------------
// interpolateVariables
// ---------------------------------------------------------------------------

describe("interpolateVariables", () => {
  it("replaces a single variable", () => {
    const vars = new Map([["name", "world"]]);
    expect(interpolateVariables("Hello {{name}}", vars)).toBe("Hello world");
  });

  it("replaces multiple different variables", () => {
    const vars = new Map([["host", "example.com"], ["path", "api/v1"]]);
    expect(interpolateVariables("https://{{host}}/{{path}}", vars)).toBe(
      "https://example.com/api/v1"
    );
  });

  it("replaces the same variable appearing multiple times", () => {
    const vars = new Map([["base", "https://api.example.com"]]);
    expect(interpolateVariables("{{base}} and {{base}}", vars)).toBe(
      "https://api.example.com and https://api.example.com"
    );
  });

  it("leaves placeholder unchanged when variable is not found in map", () => {
    const vars = new Map<string, string>();
    expect(interpolateVariables("Hello {{missing}}", vars)).toBe("Hello {{missing}}");
  });

  it("replaces known variables and leaves unknown ones unchanged", () => {
    const vars = new Map([["known", "VALUE"]]);
    expect(interpolateVariables("{{known}} and {{unknown}}", vars)).toBe(
      "VALUE and {{unknown}}"
    );
  });

  it("trims whitespace inside braces: {{ spaced }} matches key 'spaced'", () => {
    const vars = new Map([["spaced", "resolved"]]);
    expect(interpolateVariables("Hello {{ spaced }}", vars)).toBe("Hello resolved");
  });

  it("trims leading-only whitespace inside braces", () => {
    const vars = new Map([["key", "val"]]);
    expect(interpolateVariables("{{ key}}", vars)).toBe("val");
  });

  it("returns original string when no placeholders are present (fast path)", () => {
    const vars = new Map([["name", "world"]]);
    const input = "no variables here";
    expect(interpolateVariables(input, vars)).toBe(input);
  });

  it("returns empty string unchanged", () => {
    const vars = new Map([["name", "world"]]);
    expect(interpolateVariables("", vars)).toBe("");
  });

  it("handles empty braces {{}} — regex [^}]+ requires at least one char, left unchanged", () => {
    const vars = new Map([["", "value"]]);
    // {{}} has no characters between the braces that satisfy [^}]+
    // so the regex does not match, and the placeholder is left unchanged.
    expect(interpolateVariables("{{}}", vars)).toBe("{{}}");
  });

  it("handles nested-looking braces — processes outermost first", () => {
    const vars = new Map([["outer", "val"]]);
    // {{outer}} is a valid match; {{}} after would be separate
    expect(interpolateVariables("{{outer}}", vars)).toBe("val");
  });

  it("replaces variables in a full URL template", () => {
    const vars = new Map([
      ["baseUrl", "https://api.dev.example.com"],
      ["version", "v2"],
    ]);
    expect(interpolateVariables("{{baseUrl}}/{{version}}/users", vars)).toBe(
      "https://api.dev.example.com/v2/users"
    );
  });
});

// ---------------------------------------------------------------------------
// extractVariableNames
// ---------------------------------------------------------------------------

describe("extractVariableNames", () => {
  it("extracts a single variable name", () => {
    expect(extractVariableNames("Hello {{name}}")).toEqual(["name"]);
  });

  it("extracts multiple different variable names", () => {
    const result = extractVariableNames("{{host}}/{{path}}");
    expect(result).toContain("host");
    expect(result).toContain("path");
    expect(result).toHaveLength(2);
  });

  it("deduplicates variable names that appear multiple times", () => {
    const result = extractVariableNames("{{base}} and {{base}}");
    expect(result).toEqual(["base"]);
  });

  it("trims whitespace inside braces", () => {
    expect(extractVariableNames("{{ spaced }}")).toEqual(["spaced"]);
  });

  it("returns empty array when no variables found", () => {
    expect(extractVariableNames("no variables here")).toEqual([]);
  });

  it("returns empty array for empty string", () => {
    expect(extractVariableNames("")).toEqual([]);
  });

  it("skips empty braces {{}} — trimmed name is empty string, excluded", () => {
    // {{}} trims to "" which has length 0 — excluded
    expect(extractVariableNames("{{}}")).toEqual([]);
  });

  it("handles mixed known and unknown variables", () => {
    const result = extractVariableNames("{{a}} and {{b}} and {{a}}");
    expect(result).toHaveLength(2);
    expect(result).toContain("a");
    expect(result).toContain("b");
  });
});

// ---------------------------------------------------------------------------
// hasVariables
// ---------------------------------------------------------------------------

describe("hasVariables", () => {
  it("returns true when a single variable is present", () => {
    expect(hasVariables("Hello {{name}}")).toBe(true);
  });

  it("returns true when multiple variables are present", () => {
    expect(hasVariables("{{a}} and {{b}}")).toBe(true);
  });

  it("returns false when no variables are present", () => {
    expect(hasVariables("no variables here")).toBe(false);
  });

  it("returns false for empty string", () => {
    expect(hasVariables("")).toBe(false);
  });

  it("returns false for single opening brace", () => {
    expect(hasVariables("{name}")).toBe(false);
  });

  it("returns false for unclosed double braces", () => {
    expect(hasVariables("{{name")).toBe(false);
  });

  it("returns false for empty braces {{}}", () => {
    // {{}} — empty content, the regex [^}]+ requires at least one non-} char
    expect(hasVariables("{{}}")).toBe(false);
  });

  it("returns true for variable with spaces", () => {
    expect(hasVariables("{{ spaced }}")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// interpolateRequest
// ---------------------------------------------------------------------------

describe("interpolateRequest", () => {
  it("interpolates the URL field", () => {
    const vars = new Map([["baseUrl", "https://api.example.com"]]);
    const request = makeRequestState({ url: "{{baseUrl}}/todos/1" });
    const result = interpolateRequest(request, vars);
    expect(result.url).toBe("https://api.example.com/todos/1");
  });

  it("interpolates header keys and values", () => {
    const vars = new Map([["token", "Bearer abc123"], ["headerName", "X-Api-Key"]]);
    const request = makeRequestState({
      headers: [
        makeKeyValuePair({ id: "h1", key: "{{headerName}}", value: "{{token}}", enabled: true }),
      ],
    });
    const result = interpolateRequest(request, vars);
    expect(result.headers[0].key).toBe("X-Api-Key");
    expect(result.headers[0].value).toBe("Bearer abc123");
  });

  it("interpolates param keys and values", () => {
    const vars = new Map([["paramKey", "filter"], ["paramVal", "active"]]);
    const request = makeRequestState({
      params: [
        makeKeyValuePair({ id: "p1", key: "{{paramKey}}", value: "{{paramVal}}", enabled: true }),
      ],
    });
    const result = interpolateRequest(request, vars);
    expect(result.params[0].key).toBe("filter");
    expect(result.params[0].value).toBe("active");
  });

  it("interpolates body.raw field", () => {
    const vars = new Map([["userId", "42"]]);
    const request = makeRequestState({
      body: { mode: "raw", contentType: "json", raw: '{"id": "{{userId}}"}' },
    });
    const result = interpolateRequest(request, vars);
    expect(result.body.raw).toBe('{"id": "42"}');
  });

  it("does not mutate the original request (immutability)", () => {
    const vars = new Map([["x", "replaced"]]);
    const request = makeRequestState({ url: "{{x}}" });
    const originalUrl = request.url;
    interpolateRequest(request, vars);
    expect(request.url).toBe(originalUrl);
  });

  it("leaves unresolved placeholders unchanged when variable is missing", () => {
    const vars = new Map<string, string>();
    const request = makeRequestState({ url: "{{missing}}/api" });
    const result = interpolateRequest(request, vars);
    expect(result.url).toBe("{{missing}}/api");
  });

  it("interpolates all fields simultaneously", () => {
    const vars = new Map([
      ["host", "https://api.example.com"],
      ["key", "Authorization"],
      ["val", "Bearer token123"],
      ["param", "page"],
      ["paramVal", "1"],
      ["userId", "99"],
    ]);
    const request = makeRequestState({
      url: "{{host}}/users",
      headers: [makeKeyValuePair({ id: "h1", key: "{{key}}", value: "{{val}}", enabled: true })],
      params: [makeKeyValuePair({ id: "p1", key: "{{param}}", value: "{{paramVal}}", enabled: true })],
      body: { mode: "raw", contentType: "json", raw: '{"id":"{{userId}}"}' },
    });
    const result = interpolateRequest(request, vars);
    expect(result.url).toBe("https://api.example.com/users");
    expect(result.headers[0].key).toBe("Authorization");
    expect(result.headers[0].value).toBe("Bearer token123");
    expect(result.params[0].key).toBe("page");
    expect(result.params[0].value).toBe("1");
    expect(result.body.raw).toBe('{"id":"99"}');
  });

  it("preserves non-interpolated fields (method, body.mode, body.contentType)", () => {
    const vars = new Map([["x", "y"]]);
    const request = makeRequestState({ method: "POST", body: { mode: "raw", contentType: "xml", raw: "{{x}}" } });
    const result = interpolateRequest(request, vars);
    expect(result.method).toBe("POST");
    expect(result.body.mode).toBe("raw");
    expect(result.body.contentType).toBe("xml");
  });
});
