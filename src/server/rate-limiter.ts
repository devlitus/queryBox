/**
 * In-memory sliding window rate limiter.
 * Tracks requests by IP address and enforces a maximum number of requests per time window.
 *
 * KNOWN LIMITATIONS (documented intentionally — no distributed solution required for this project):
 *
 * 1. State is not persisted across server restarts. If the server crashes or restarts,
 *    all rate limit counters are reset, allowing up to MAX_REQUESTS new requests immediately.
 *    This is acceptable for the current single-instance, developer-tool use case.
 *
 * 2. Not suitable for horizontal scaling. Each server instance maintains its own Map,
 *    so N instances would each allow MAX_REQUESTS per window (effective limit: MAX_REQUESTS * N).
 *    For multi-instance deployments, migrate to a distributed store (e.g., Redis + sliding window).
 *
 * TODO (future): Replace with a Redis-based rate limiter if this service is deployed at scale.
 */

// Configuration from environment variables with fallback defaults
export const MAX_REQUESTS =
  parseInt(import.meta.env.AI_RATE_LIMIT_MAX || "10", 10);
export const WINDOW_MS = parseInt(
  import.meta.env.AI_RATE_LIMIT_WINDOW_MS || "60000",
  10
);

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetIn: number; // milliseconds
}

// In-memory storage: IP → array of request timestamps
const requestLog = new Map<string, number[]>();

// Counter for cleanup trigger
let requestCounter = 0;
const CLEANUP_INTERVAL = 100; // Clean up every 100 requests

/**
 * Checks if a request from the given IP should be allowed based on rate limits.
 *
 * @param ip - The IP address of the client making the request
 * @returns RateLimitResult with allowed status, remaining requests, and time until reset
 */
export function checkRateLimit(ip: string): RateLimitResult {
  const now = Date.now();
  const windowStart = now - WINDOW_MS;

  // Get existing timestamps for this IP and filter to current window
  const timestamps = (requestLog.get(ip) ?? []).filter((t) => t > windowStart);

  // Check if limit is exceeded
  if (timestamps.length >= MAX_REQUESTS) {
    const oldestInWindow = timestamps[0];
    return {
      allowed: false,
      remaining: 0,
      resetIn: oldestInWindow + WINDOW_MS - now,
    };
  }

  // Add current request timestamp
  timestamps.push(now);
  requestLog.set(ip, timestamps);

  // Trigger periodic cleanup to prevent memory leaks
  requestCounter++;
  if (requestCounter >= CLEANUP_INTERVAL) {
    cleanupExpiredEntries();
    requestCounter = 0;
  }

  return {
    allowed: true,
    remaining: MAX_REQUESTS - timestamps.length,
    resetIn: 0,
  };
}

/**
 * Removes expired entries from the request log to prevent memory leaks.
 * Only keeps IPs with recent activity within the current window.
 */
function cleanupExpiredEntries(): void {
  const now = Date.now();
  const windowStart = now - WINDOW_MS;

  for (const [ip, timestamps] of requestLog.entries()) {
    // Filter timestamps to current window
    const activeTimestamps = timestamps.filter((t) => t > windowStart);

    if (activeTimestamps.length === 0) {
      // No recent activity — remove this IP
      requestLog.delete(ip);
    } else {
      // Update with cleaned timestamps
      requestLog.set(ip, activeTimestamps);
    }
  }
}

/**
 * Resets the rate limiter state. Useful for testing.
 */
export function resetRateLimiter(): void {
  requestLog.clear();
  requestCounter = 0;
}
