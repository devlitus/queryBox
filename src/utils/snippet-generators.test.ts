import { describe, it, expect } from "vitest";
import {
  generateCurl,
  generateJavaScriptFetch,
  generatePythonRequests,
  generateNodeAxios,
  generateSnippet,
} from "./snippet-generators";
import { makeRequestState, makeKeyValuePair } from "../test/factories";

// ---------------------------------------------------------------------------
// Helper factories for this test file
// ---------------------------------------------------------------------------

function makeBasicAuthState() {
  return makeRequestState({
    auth: {
      type: "basic",
      basic: { username: "admin", password: "secret" },
    },
  });
}

function makeBearerState() {
  return makeRequestState({
    auth: {
      type: "bearer",
      bearer: { token: "my-token-123", prefix: "Bearer" },
    },
  });
}

function makeApiKeyHeaderState() {
  return makeRequestState({
    auth: {
      type: "apikey",
      apikey: { key: "X-API-Key", value: "abc123", addTo: "header" },
    },
  });
}

function makeApiKeyQueryState() {
  return makeRequestState({
    auth: {
      type: "apikey",
      apikey: { key: "api_key", value: "abc123", addTo: "query" },
    },
  });
}

// ---------------------------------------------------------------------------
// cURL
// ---------------------------------------------------------------------------

describe("generateCurl", () => {
  it("generates a GET request without -X flag", () => {
    const request = makeRequestState({ method: "GET", url: "https://api.example.com/users" });
    const snippet = generateCurl(request);
    expect(snippet).toContain("curl");
    expect(snippet).toContain("'https://api.example.com/users'");
    expect(snippet).not.toContain("-X GET");
  });

  it("generates a POST request with -X POST and body", () => {
    const request = makeRequestState({
      method: "POST",
      url: "https://api.example.com/users",
      body: { mode: "raw", contentType: "json", raw: '{"name":"John"}' },
    });
    const snippet = generateCurl(request);
    expect(snippet).toContain("-X POST");
    expect(snippet).toContain("-d");
    expect(snippet).toContain('{"name":"John"}');
  });

  it("includes enabled headers and omits disabled headers", () => {
    const request = makeRequestState({
      headers: [
        makeKeyValuePair({ key: "Content-Type", value: "application/json", enabled: true }),
        makeKeyValuePair({ id: "h2", key: "X-Disabled", value: "no", enabled: false }),
      ],
    });
    const snippet = generateCurl(request);
    expect(snippet).toContain("-H 'Content-Type: application/json'");
    expect(snippet).not.toContain("X-Disabled");
  });

  it("includes enabled query params in the URL", () => {
    const request = makeRequestState({
      url: "https://api.example.com/users",
      params: [
        makeKeyValuePair({ id: "p1", key: "page", value: "1", enabled: true }),
        makeKeyValuePair({ id: "p2", key: "disabled", value: "no", enabled: false }),
      ],
    });
    const snippet = generateCurl(request);
    expect(snippet).toContain("page=1");
    expect(snippet).not.toContain("disabled=no");
  });

  it("adds basic auth Authorization header", () => {
    const request = makeBasicAuthState();
    const snippet = generateCurl(request);
    expect(snippet).toContain("-H 'Authorization: Basic");
  });

  it("adds bearer token Authorization header", () => {
    const request = makeBearerState();
    const snippet = generateCurl(request);
    expect(snippet).toContain("-H 'Authorization: Bearer my-token-123'");
  });

  it("adds API key as header when addTo is 'header'", () => {
    const request = makeApiKeyHeaderState();
    const snippet = generateCurl(request);
    expect(snippet).toContain("-H 'X-API-Key: abc123'");
  });

  it("adds API key as query param in URL when addTo is 'query'", () => {
    const request = makeApiKeyQueryState();
    const snippet = generateCurl(request);
    expect(snippet).toContain("api_key=abc123");
    expect(snippet).not.toContain("-H 'api_key:");
  });

  it("escapes single quotes in body", () => {
    const request = makeRequestState({
      method: "POST",
      url: "https://api.example.com",
      body: { mode: "raw", contentType: "text", raw: "it's a test" },
    });
    const snippet = generateCurl(request);
    // Single quote becomes '\''
    expect(snippet).toContain("it'\\''s a test");
  });

  it("omits body for GET requests even if body is set", () => {
    const request = makeRequestState({
      method: "GET",
      body: { mode: "raw", contentType: "json", raw: '{"should":"not appear"}' },
    });
    const snippet = generateCurl(request);
    expect(snippet).not.toContain("-d");
  });

  it("handles empty URL gracefully", () => {
    const request = makeRequestState({ url: "" });
    const snippet = generateCurl(request);
    // Should not throw; URL will be empty
    expect(typeof snippet).toBe("string");
  });

  it("omits body when body mode is 'none'", () => {
    const request = makeRequestState({
      method: "POST",
      body: { mode: "none", contentType: "json", raw: "" },
    });
    const snippet = generateCurl(request);
    expect(snippet).not.toContain("-d");
  });
});

// ---------------------------------------------------------------------------
// JavaScript fetch
// ---------------------------------------------------------------------------

describe("generateJavaScriptFetch", () => {
  it("generates a GET request with async/await pattern", () => {
    const request = makeRequestState({ method: "GET", url: "https://api.example.com/todos/1" });
    const snippet = generateJavaScriptFetch(request);
    expect(snippet).toContain("await fetch(");
    expect(snippet).toContain("method: 'GET'");
    expect(snippet).toContain("'https://api.example.com/todos/1'");
    expect(snippet).toContain("await response.json()");
  });

  it("does not include body for GET requests", () => {
    const request = makeRequestState({ method: "GET" });
    const snippet = generateJavaScriptFetch(request);
    expect(snippet).not.toContain("body:");
  });

  it("includes JSON body for POST requests with json content-type", () => {
    const request = makeRequestState({
      method: "POST",
      url: "https://api.example.com/users",
      body: { mode: "raw", contentType: "json", raw: '{"name":"Alice"}' },
    });
    const snippet = generateJavaScriptFetch(request);
    expect(snippet).toContain("method: 'POST'");
    expect(snippet).toContain("JSON.stringify(");
    expect(snippet).toContain('{"name":"Alice"}');
  });

  it("includes headers as object literal", () => {
    const request = makeRequestState({
      headers: [
        makeKeyValuePair({ key: "Content-Type", value: "application/json", enabled: true }),
      ],
    });
    const snippet = generateJavaScriptFetch(request);
    expect(snippet).toContain("headers: {");
    expect(snippet).toContain("'Content-Type': 'application/json'");
  });

  it("adds bearer Authorization header", () => {
    const request = makeBearerState();
    const snippet = generateJavaScriptFetch(request);
    expect(snippet).toContain("'Authorization': 'Bearer my-token-123'");
  });

  it("adds basic auth Authorization header (base64)", () => {
    const request = makeBasicAuthState();
    const snippet = generateJavaScriptFetch(request);
    expect(snippet).toContain("'Authorization': 'Basic ");
  });

  it("omits headers block when there are no headers and no auth", () => {
    const request = makeRequestState({ method: "GET", headers: [] });
    const snippet = generateJavaScriptFetch(request);
    expect(snippet).not.toContain("headers:");
  });

  it("generates correct structure for PUT with text body", () => {
    const request = makeRequestState({
      method: "PUT",
      url: "https://api.example.com/items/1",
      body: { mode: "raw", contentType: "text", raw: "plain text body" },
    });
    const snippet = generateJavaScriptFetch(request);
    expect(snippet).toContain("method: 'PUT'");
    expect(snippet).toContain("body:");
    expect(snippet).toContain("plain text body");
  });
});

// ---------------------------------------------------------------------------
// Python requests
// ---------------------------------------------------------------------------

describe("generatePythonRequests", () => {
  it("generates a GET request with requests library", () => {
    const request = makeRequestState({ method: "GET", url: "https://api.example.com/users" });
    const snippet = generatePythonRequests(request);
    expect(snippet).toContain("import requests");
    expect(snippet).toContain("response = requests.get(");
    expect(snippet).toContain("url='https://api.example.com/users'");
  });

  it("includes query params in the URL", () => {
    const request = makeRequestState({
      url: "https://api.example.com/users",
      params: [makeKeyValuePair({ id: "p1", key: "limit", value: "10", enabled: true })],
    });
    const snippet = generatePythonRequests(request);
    expect(snippet).toContain("limit=10");
  });

  it("generates a POST request with json= kwarg", () => {
    const request = makeRequestState({
      method: "POST",
      url: "https://api.example.com/users",
      body: { mode: "raw", contentType: "json", raw: '{"name":"Bob"}' },
    });
    const snippet = generatePythonRequests(request);
    expect(snippet).toContain("requests.post(");
    expect(snippet).toContain('json={"name":"Bob"}');
  });

  it("uses auth= tuple for basic auth instead of Authorization header", () => {
    const request = makeBasicAuthState();
    const snippet = generatePythonRequests(request);
    expect(snippet).toContain("auth=('admin', 'secret')");
    expect(snippet).not.toContain("'Authorization'");
  });

  it("adds bearer token as Authorization header in headers dict", () => {
    const request = makeBearerState();
    const snippet = generatePythonRequests(request);
    expect(snippet).toContain("headers = {");
    expect(snippet).toContain("'Authorization': 'Bearer my-token-123'");
  });

  it("adds API key in header when addTo is 'header'", () => {
    const request = makeApiKeyHeaderState();
    const snippet = generatePythonRequests(request);
    expect(snippet).toContain("'X-API-Key': 'abc123'");
  });

  it("adds API key as query param in URL when addTo is 'query'", () => {
    const request = makeApiKeyQueryState();
    const snippet = generatePythonRequests(request);
    expect(snippet).toContain("api_key=abc123");
  });

  it("prints status code and json response", () => {
    const request = makeRequestState();
    const snippet = generatePythonRequests(request);
    expect(snippet).toContain("print(response.status_code)");
    expect(snippet).toContain("print(response.json())");
  });
});

// ---------------------------------------------------------------------------
// Node.js axios
// ---------------------------------------------------------------------------

describe("generateNodeAxios", () => {
  it("generates a GET request with axios", () => {
    const request = makeRequestState({ method: "GET", url: "https://api.example.com/todos" });
    const snippet = generateNodeAxios(request);
    expect(snippet).toContain("require('axios')");
    expect(snippet).toContain("await axios({");
    expect(snippet).toContain("method: 'GET'");
    expect(snippet).toContain("url: 'https://api.example.com/todos'");
  });

  it("generates a POST request with data field", () => {
    const request = makeRequestState({
      method: "POST",
      url: "https://api.example.com/items",
      body: { mode: "raw", contentType: "json", raw: '{"title":"test"}' },
    });
    const snippet = generateNodeAxios(request);
    expect(snippet).toContain("method: 'POST'");
    expect(snippet).toContain("data:");
    expect(snippet).toContain('{"title":"test"}');
  });

  it("includes headers object when headers are present", () => {
    const request = makeRequestState({
      headers: [makeKeyValuePair({ key: "X-Custom", value: "my-value", enabled: true })],
    });
    const snippet = generateNodeAxios(request);
    expect(snippet).toContain("headers: {");
    expect(snippet).toContain("'X-Custom': 'my-value'");
  });

  it("adds auth headers correctly", () => {
    const request = makeBearerState();
    const snippet = generateNodeAxios(request);
    expect(snippet).toContain("'Authorization': 'Bearer my-token-123'");
  });

  it("outputs console.log(response.data)", () => {
    const request = makeRequestState();
    const snippet = generateNodeAxios(request);
    expect(snippet).toContain("console.log(response.data)");
  });

  it("omits headers block when no headers and no auth", () => {
    const request = makeRequestState({ headers: [] });
    const snippet = generateNodeAxios(request);
    expect(snippet).not.toContain("headers:");
  });
});

// ---------------------------------------------------------------------------
// generateSnippet dispatcher
// ---------------------------------------------------------------------------

describe("generateSnippet", () => {
  it("dispatches to generateCurl for 'curl'", () => {
    const request = makeRequestState({ method: "GET", url: "https://api.example.com" });
    const snippet = generateSnippet("curl", request);
    expect(snippet).toContain("curl");
    // URL gets normalized with trailing slash by the URL API — use partial match
    expect(snippet).toContain("https://api.example.com");
  });

  it("dispatches to generateJavaScriptFetch for 'javascript-fetch'", () => {
    const request = makeRequestState({ method: "GET", url: "https://api.example.com" });
    const snippet = generateSnippet("javascript-fetch", request);
    expect(snippet).toContain("await fetch(");
  });

  it("dispatches to generatePythonRequests for 'python-requests'", () => {
    const request = makeRequestState({ method: "GET", url: "https://api.example.com" });
    const snippet = generateSnippet("python-requests", request);
    expect(snippet).toContain("import requests");
  });

  it("dispatches to generateNodeAxios for 'nodejs-axios'", () => {
    const request = makeRequestState({ method: "GET", url: "https://api.example.com" });
    const snippet = generateSnippet("nodejs-axios", request);
    expect(snippet).toContain("require('axios')");
  });

  it("each language produces a non-empty string", () => {
    const request = makeRequestState();
    const languages = ["curl", "javascript-fetch", "python-requests", "nodejs-axios"] as const;
    for (const lang of languages) {
      const snippet = generateSnippet(lang, request);
      expect(snippet.length).toBeGreaterThan(0);
    }
  });
});
