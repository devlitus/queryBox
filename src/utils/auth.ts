import type { AuthConfig } from "../types/auth";

export interface ResolvedAuth {
  headers: Array<{ key: string; value: string }>;
  params: Array<{ key: string; value: string }>;
}

/**
 * Encodes a string to base64 with full Unicode support.
 *
 * btoa() fails on characters outside the Latin1 range (e.g. emoji, CJK).
 * Using TextEncoder + manual base64 encoding handles the full Unicode range safely.
 * Decision documented here per plan risk mitigation §Phase1.
 */
function toBase64(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

/**
 * Pure function that resolves an AuthConfig into concrete HTTP headers and/or query params.
 * Called by http-client.ts just before building the fetch request.
 *
 * Returns:
 *  - headers: array of { key, value } to inject into request headers
 *  - params:  array of { key, value } to inject into the URL query string (API Key only)
 *
 * Does NOT filter empty values — empty fields still produce headers (plan requirement).
 */
export function resolveAuthHeaders(auth: AuthConfig): ResolvedAuth {
  switch (auth.type) {
    case "none":
      return { headers: [], params: [] };

    case "basic": {
      const { username, password } = auth.basic;
      // Format: "username:password" — password may contain colons, which is valid per RFC 7617
      const credentials = toBase64(`${username}:${password}`);
      return {
        headers: [{ key: "Authorization", value: `Basic ${credentials}` }],
        params: [],
      };
    }

    case "bearer": {
      const { token, prefix } = auth.bearer;
      // prefix defaults to "Bearer" but is configurable (e.g. "Token" for Django REST, "Bot" for Discord)
      return {
        headers: [{ key: "Authorization", value: `${prefix} ${token}` }],
        params: [],
      };
    }

    case "apikey": {
      const { key, value, addTo } = auth.apikey;
      if (addTo === "header") {
        return {
          headers: [{ key, value }],
          params: [],
        };
      } else {
        // addTo === "query"
        return {
          headers: [],
          params: [{ key, value }],
        };
      }
    }
  }
}
