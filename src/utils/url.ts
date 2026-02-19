import type { KeyValuePair } from "../types/http";

/**
 * Extracts query parameters from a URL string.
 * Returns an empty array for invalid or parameterless URLs.
 */
export function parseQueryParams(url: string): KeyValuePair[] {
  if (!url) return [];

  try {
    // Handle URLs without a protocol by adding a dummy base
    const hasProtocol = /^https?:\/\//i.test(url);
    const parsedUrl = new URL(hasProtocol ? url : `https://dummy.host/${url}`);
    const params: KeyValuePair[] = [];

    parsedUrl.searchParams.forEach((value, key) => {
      params.push({
        id: crypto.randomUUID(),
        key,
        value,
        enabled: true,
      });
    });

    return params;
  } catch {
    return [];
  }
}

/**
 * Builds a URL string with enabled query params appended.
 * Preserves the base URL (path, hash) and replaces query string entirely.
 */
export function buildUrlWithParams(baseUrl: string, params: KeyValuePair[]): string {
  if (!baseUrl) return "";

  const enabledParams = params.filter((p) => p.enabled && p.key !== "");

  try {
    const hasProtocol = /^https?:\/\//i.test(baseUrl);
    const urlToParse = hasProtocol ? baseUrl : `https://dummy.host/${baseUrl}`;
    const parsedUrl = new URL(urlToParse);

    // Replace query string with enabled params
    parsedUrl.search = "";
    for (const param of enabledParams) {
      parsedUrl.searchParams.append(param.key, param.value);
    }

    if (hasProtocol) {
      return parsedUrl.toString();
    } else {
      // Return without the dummy base we added
      return parsedUrl.pathname.slice(1) + parsedUrl.search + parsedUrl.hash;
    }
  } catch {
    // If URL is malformed, just append params as-is
    if (enabledParams.length === 0) return baseUrl;
    const queryString = enabledParams
      .map((p) => `${encodeURIComponent(p.key)}=${encodeURIComponent(p.value)}`)
      .join("&");
    const separator = baseUrl.includes("?") ? "&" : "?";
    return `${baseUrl}${separator}${queryString}`;
  }
}

/**
 * Formats a byte count to a human-readable string (B, KB, MB).
 */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
