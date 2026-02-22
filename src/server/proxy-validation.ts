/**
 * Validation and security utilities for the server-side proxy endpoint.
 * Enforces request validation, URL security restrictions (SSRF prevention),
 * and sanitization of forwarded headers.
 */

import type { ProxyRequest } from "../types/proxy";

// Maximum body size: 5 MB (aligned with MAX_BODY_SIZE in http-client.ts)
export const PROXY_MAX_BODY_SIZE = 5 * 1024 * 1024;

// Timeout configuration
export const PROXY_DEFAULT_TIMEOUT = 30000; // 30 seconds
export const PROXY_MAX_TIMEOUT = 120000; // 120 seconds (2 minutes)

// Valid HTTP methods supported by the proxy
export const VALID_PROXY_METHODS = [
  "GET",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
  "HEAD",
  "OPTIONS",
] as const;

/**
 * Type guard: validates that a request body conforms to ProxyRequest interface.
 *
 * @param body - The request body to validate
 * @returns True if the body is a valid ProxyRequest
 */
export function validateProxyRequest(body: unknown): body is ProxyRequest {
  if (!body || typeof body !== "object") return false;

  const req = body as Partial<ProxyRequest>;

  // Required fields: url, method, headers
  if (typeof req.url !== "string" || req.url.length === 0) return false;
  if (typeof req.method !== "string" || req.method.length === 0) return false;
  if (!req.headers || typeof req.headers !== "object") return false;

  // Validate method is in the allowed list
  if (!VALID_PROXY_METHODS.includes(req.method as typeof VALID_PROXY_METHODS[number])) {
    return false;
  }

  // Optional fields: body (string), timeout (number)
  if (req.body !== undefined && typeof req.body !== "string") return false;
  if (req.timeout !== undefined) {
    if (typeof req.timeout !== "number") return false;
    if (req.timeout < 0 || req.timeout > PROXY_MAX_TIMEOUT) return false;
  }

  // Validate headers is a plain object with string values
  for (const [key, value] of Object.entries(req.headers)) {
    if (typeof key !== "string" || typeof value !== "string") return false;
  }

  return true;
}

/**
 * Validates whether a URL is allowed to be proxied.
 * Prevents SSRF (Server-Side Request Forgery) by blocking private IPs and localhost.
 *
 * In development mode (isDev=true), private networks are allowed to enable
 * testing against local APIs.
 *
 * @param url - The URL to validate
 * @param isDev - Whether the app is running in development mode
 * @returns Object with allowed status and optional reason for rejection
 */
export function isAllowedUrl(
  url: string,
  isDev = false
): { allowed: boolean; reason?: string } {
  // In development mode, allow all URLs (except non-HTTP protocols)
  // This enables testing against localhost and private network APIs during development.
  // In production, SSRF restrictions are always enforced to prevent attacks.
  if (isDev) {
    try {
      const urlObj = new URL(url);
      const protocol = urlObj.protocol.toLowerCase();
      if (protocol !== "http:" && protocol !== "https:") {
        return {
          allowed: false,
          reason: `Protocol "${protocol}" is not allowed. Only HTTP and HTTPS are supported.`,
        };
      }
      return { allowed: true };
    } catch {
      return { allowed: false, reason: "Invalid URL format" };
    }
  }

  // Production mode: enforce SSRF restrictions
  let urlObj: URL;
  try {
    urlObj = new URL(url);
  } catch {
    return { allowed: false, reason: "Invalid URL format" };
  }

  // Only HTTP and HTTPS protocols are allowed
  const protocol = urlObj.protocol.toLowerCase();
  if (protocol !== "http:" && protocol !== "https:") {
    return {
      allowed: false,
      reason: `Protocol "${protocol}" is not allowed. Only HTTP and HTTPS are supported.`,
    };
  }

  const hostname = urlObj.hostname.toLowerCase();

  // Block localhost by hostname
  if (hostname === "localhost" || hostname.endsWith(".local")) {
    return {
      allowed: false,
      reason: "Requests to localhost and .local domains are blocked for security.",
    };
  }

  // Block private IP ranges (IPv4)
  // 127.0.0.0/8 (loopback), 10.0.0.0/8 (private), 172.16.0.0/12 (private), 192.168.0.0/16 (private)
  const ipv4Pattern =
    /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
  const ipv4Match = hostname.match(ipv4Pattern);

  if (ipv4Match) {
    const [, a, b, c, d] = ipv4Match.map(Number);

    // Validate octets are in valid range
    if (a > 255 || b > 255 || c > 255 || d > 255) {
      return { allowed: false, reason: "Invalid IP address" };
    }

    // 127.0.0.0/8 — loopback
    if (a === 127) {
      return {
        allowed: false,
        reason: "Requests to loopback addresses (127.x.x.x) are blocked for security.",
      };
    }

    // 10.0.0.0/8 — private network
    if (a === 10) {
      return {
        allowed: false,
        reason: "Requests to private networks (10.x.x.x) are blocked for security.",
      };
    }

    // 172.16.0.0/12 — private network (172.16.0.0 to 172.31.255.255)
    if (a === 172 && b >= 16 && b <= 31) {
      return {
        allowed: false,
        reason: "Requests to private networks (172.16-31.x.x) are blocked for security.",
      };
    }

    // 192.168.0.0/16 — private network
    if (a === 192 && b === 168) {
      return {
        allowed: false,
        reason: "Requests to private networks (192.168.x.x) are blocked for security.",
      };
    }

    // 0.0.0.0/8 — "this network"
    if (a === 0) {
      return {
        allowed: false,
        reason: "Invalid IP address (0.x.x.x)",
      };
    }
  }

  // Block private IPv6 addresses
  // ::1 (loopback), fe80::/10 (link-local), fc00::/7 (unique local)
  // IPv6 hostnames in URLs use bracket notation: [::1], so we need to strip brackets
  const ipv6Hostname = hostname.startsWith("[") && hostname.endsWith("]")
    ? hostname.slice(1, -1)
    : hostname;

  if (ipv6Hostname.includes(":")) {
    // Simple heuristic: block IPv6 loopback and common private prefixes
    if (
      ipv6Hostname === "::1" ||
      ipv6Hostname.startsWith("fe80:") ||
      ipv6Hostname.startsWith("fc")
    ) {
      return {
        allowed: false,
        reason: "Requests to private IPv6 addresses are blocked for security.",
      };
    }
  }

  return { allowed: true };
}

/**
 * Sanitizes request headers by removing headers that should not be forwarded
 * to the external API (internal proxy headers, connection management, etc.).
 *
 * @param headers - The headers object to sanitize
 * @returns A new headers object with dangerous headers removed
 */
export function sanitizeRequestHeaders(
  headers: Record<string, string>
): Record<string, string> {
  const sanitized: Record<string, string> = {};

  // Blocklist of headers that should never be forwarded
  const blocklist = new Set([
    "host", // The Host header should be set by fetch() based on the target URL
    "connection",
    "keep-alive",
    "transfer-encoding",
    "upgrade",
    "te",
    "trailer",
  ]);

  for (const [key, value] of Object.entries(headers)) {
    const lowerKey = key.toLowerCase();

    // Remove blocklisted headers
    if (blocklist.has(lowerKey)) continue;

    // Remove Proxy-* headers (e.g., Proxy-Authorization, Proxy-Connection)
    if (lowerKey.startsWith("proxy-")) continue;

    sanitized[key] = value;
  }

  return sanitized;
}
