import type { RequestState, KeyValuePair } from "../types/http";
import type { SnippetLanguage } from "../types/snippet";
import { resolveAuthHeaders, type ResolvedAuth } from "./auth";
import { buildUrlWithParams } from "./url";

// ---------------------------------------------------------------------------
// Internal helpers — shared across generators
// ---------------------------------------------------------------------------

/** Returns only enabled headers/params that have a non-empty key. */
function filterEnabled(pairs: KeyValuePair[]): Array<{ key: string; value: string }> {
  return pairs
    .filter((p) => p.enabled && p.key !== "")
    .map(({ key, value }) => ({ key, value }));
}

/**
 * Builds the final URL including enabled params from the request state
 * plus any auth params (API Key in query position).
 * Receives a pre-resolved ResolvedAuth to avoid calling resolveAuthHeaders twice per generator.
 */
function buildFinalUrl(request: RequestState, auth: ResolvedAuth): string {
  // Merge request params with auth query params (auth params appended last)
  const allParams: KeyValuePair[] = [
    ...request.params,
    ...auth.params.map((p) => ({
      id: "",
      key: p.key,
      value: p.value,
      enabled: true,
    })),
  ];
  return buildUrlWithParams(request.url, allParams);
}

/**
 * Returns merged headers: resolved auth headers first, then user headers.
 * User headers take precedence (they come last — when duplicate keys exist,
 * last writer wins in fetch/requests/axios).
 * Receives a pre-resolved ResolvedAuth to avoid calling resolveAuthHeaders twice per generator.
 */
function buildHeaders(
  request: RequestState,
  auth: ResolvedAuth
): Array<{ key: string; value: string }> {
  const userHeaders = filterEnabled(request.headers);
  // Auth headers first; user headers can override them
  return [...auth.headers, ...userHeaders];
}

/** Returns true for HTTP methods that conventionally carry a request body. */
function hasBody(method: string): boolean {
  return ["POST", "PUT", "PATCH", "DELETE"].includes(method.toUpperCase());
}

/**
 * Escapes backticks and template-literal interpolation sequences (`${`)
 * so the string can be safely embedded inside a JS template literal.
 */
function escapeTemplateLiteral(str: string): string {
  return str.replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\$\{/g, "\\${");
}

// ---------------------------------------------------------------------------
// cURL
// ---------------------------------------------------------------------------

/**
 * Escapes single quotes in a shell string wrapped with single quotes.
 * Pattern: replace `'` with `'\''` (end quote, escaped quote, start quote).
 */
function escapeSingleQuotes(str: string): string {
  return str.replace(/'/g, "'\\''");
}

/**
 * Generates a cURL command from a RequestState.
 *
 * Format:
 *   curl -X METHOD \
 *     'URL' \
 *     -H 'Key: Value' \
 *     -d 'body'
 *
 * - GET method flag is omitted (curl default).
 * - Each flag is on its own line for readability (backslash continuation).
 * - Body only included for POST/PUT/PATCH/DELETE with mode "raw".
 */
export function generateCurl(request: RequestState): string {
  const auth = resolveAuthHeaders(request.auth);
  const url = buildFinalUrl(request, auth);
  const headers = buildHeaders(request, auth);
  const lines: string[] = ["curl"];

  // Method — omit -X GET since it is curl's default
  if (request.method !== "GET") {
    lines.push(`  -X ${request.method}`);
  }

  // URL
  lines.push(`  '${escapeSingleQuotes(url)}'`);

  // Headers
  for (const { key, value } of headers) {
    lines.push(`  -H '${escapeSingleQuotes(key)}: ${escapeSingleQuotes(value)}'`);
  }

  // Body
  if (hasBody(request.method) && request.body.mode === "raw" && request.body.raw) {
    lines.push(`  -d '${escapeSingleQuotes(request.body.raw)}'`);
  }

  return lines.join(" \\\n");
}

// ---------------------------------------------------------------------------
// JavaScript fetch
// ---------------------------------------------------------------------------

/**
 * Generates an ES6+ async/await fetch snippet.
 *
 * Format:
 *   const response = await fetch('URL', {
 *     method: 'METHOD',
 *     headers: { 'Key': 'Value' },
 *     body: JSON.stringify(data) | 'raw body',
 *   });
 *   const data = await response.json();
 */
export function generateJavaScriptFetch(request: RequestState): string {
  const auth = resolveAuthHeaders(request.auth);
  const url = buildFinalUrl(request, auth);
  const headers = buildHeaders(request, auth);

  const parts: string[] = [];
  parts.push(`const response = await fetch('${url}', {`);
  parts.push(`  method: '${request.method}',`);

  // Headers object
  if (headers.length > 0) {
    parts.push("  headers: {");
    for (const { key, value } of headers) {
      parts.push(`    '${key}': '${value}',`);
    }
    parts.push("  },");
  }

  // Body
  if (hasBody(request.method) && request.body.mode === "raw" && request.body.raw) {
    const isJson = request.body.contentType === "json";
    if (isJson) {
      parts.push(`  body: JSON.stringify(${request.body.raw}),`);
    } else {
      parts.push(`  body: \`${escapeTemplateLiteral(request.body.raw)}\`,`);
    }
  }

  parts.push("});");
  parts.push("");

  // Response parsing — use json() for JSON content-type, text() otherwise
  const isJsonResponse =
    request.body.contentType === "json" ||
    headers.some(
      (h) =>
        h.key.toLowerCase() === "accept" &&
        h.value.toLowerCase().includes("json")
    );

  if (isJsonResponse || request.method === "GET") {
    parts.push("const data = await response.json();");
  } else {
    parts.push("const data = await response.text();");
  }

  return parts.join("\n");
}

// ---------------------------------------------------------------------------
// Python requests
// ---------------------------------------------------------------------------

/**
 * Generates a Python snippet using the `requests` library.
 *
 * - Uses requests.get/post/put/patch/delete(url, ...) shorthand.
 * - `json=` kwarg for JSON content-type (requests serializes automatically).
 * - `data=` kwarg for other content types.
 * - `params=` dict for query parameters (when not already in URL).
 * - Basic auth uses `auth=('user', 'pass')` tuple instead of headers dict.
 */
export function generatePythonRequests(request: RequestState): string {
  const method = request.method.toLowerCase();
  const authResolved = resolveAuthHeaders(request.auth);
  const url = buildFinalUrl(request, authResolved);
  const userHeaders = filterEnabled(request.headers);

  // For Python, basic auth uses auth= kwarg — no Authorization header
  const isBasicAuth = request.auth.type === "basic";
  const allHeaders = isBasicAuth ? userHeaders : [...authResolved.headers, ...userHeaders];

  const lines: string[] = ["import requests", ""];

  // Headers dict
  if (allHeaders.length > 0) {
    lines.push("headers = {");
    for (const { key, value } of allHeaders) {
      lines.push(`    '${key}': '${value}',`);
    }
    lines.push("}");
    lines.push("");
  }

  // Build the call kwargs
  const kwargs: string[] = [`url='${url}'`];

  if (allHeaders.length > 0) {
    kwargs.push("headers=headers");
  }

  // Basic auth tuple
  if (isBasicAuth && request.auth.type === "basic") {
    const { username, password } = request.auth.basic;
    kwargs.push(`auth=('${username}', '${password}')`);
  }

  // Body
  if (hasBody(request.method) && request.body.mode === "raw" && request.body.raw) {
    if (request.body.contentType === "json") {
      kwargs.push(`json=${request.body.raw}`);
    } else {
      kwargs.push(`data='${request.body.raw}'`);
    }
  }

  const kwargsStr = kwargs.join(", ");
  lines.push(`response = requests.${method}(${kwargsStr})`);
  lines.push("");
  lines.push("print(response.status_code)");
  lines.push("print(response.json())");

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Node.js axios
// ---------------------------------------------------------------------------

/**
 * Generates a Node.js snippet using axios.
 *
 * Format:
 *   const axios = require('axios');
 *
 *   const response = await axios({
 *     method: 'METHOD',
 *     url: 'URL',
 *     headers: { 'Key': 'Value' },
 *     data: body,
 *   });
 *
 *   console.log(response.data);
 */
export function generateNodeAxios(request: RequestState): string {
  const auth = resolveAuthHeaders(request.auth);
  const url = buildFinalUrl(request, auth);
  const headers = buildHeaders(request, auth);

  const lines: string[] = [
    "const axios = require('axios');",
    "",
    "const response = await axios({",
    `  method: '${request.method}',`,
    `  url: '${url}',`,
  ];

  // Headers
  if (headers.length > 0) {
    lines.push("  headers: {");
    for (const { key, value } of headers) {
      lines.push(`    '${key}': '${value}',`);
    }
    lines.push("  },");
  }

  // Body — axios uses `data` field
  if (hasBody(request.method) && request.body.mode === "raw" && request.body.raw) {
    if (request.body.contentType === "json") {
      lines.push(`  data: ${request.body.raw},`);
    } else {
      lines.push(`  data: \`${escapeTemplateLiteral(request.body.raw)}\`,`);
    }
  }

  lines.push("});");
  lines.push("");
  lines.push("console.log(response.data);");

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Dispatcher
// ---------------------------------------------------------------------------

/**
 * Single entry point for snippet generation.
 * Dispatches to the correct generator based on the selected language.
 * The request should already be interpolated (or not) before being passed here.
 */
export function generateSnippet(language: SnippetLanguage, request: RequestState): string {
  switch (language) {
    case "curl":
      return generateCurl(request);
    case "javascript-fetch":
      return generateJavaScriptFetch(request);
    case "python-requests":
      return generatePythonRequests(request);
    case "nodejs-axios":
      return generateNodeAxios(request);
  }
}
