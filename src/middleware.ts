import type { MiddlewareHandler } from "astro";

/**
 * Security headers middleware.
 * Injects HTTP security headers into all responses to protect against
 * common web vulnerabilities (XSS, clickjacking, MIME sniffing, etc.).
 */
export const onRequest: MiddlewareHandler = async (_context, next) => {
  const response = await next();

  // Prevent MIME type sniffing attacks (CWE-430)
  response.headers.set("X-Content-Type-Options", "nosniff");

  // Prevent clickjacking by disallowing embedding in frames (CWE-1021)
  response.headers.set("X-Frame-Options", "DENY");

  // Limit Referer header to origin only for cross-origin requests
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");

  // Restrict access to sensitive browser APIs not used by this app
  response.headers.set(
    "Permissions-Policy",
    "geolocation=(), microphone=(), camera=()"
  );

  // Content Security Policy — restricts which resources the browser can load.
  // Notes:
  //   - 'unsafe-inline' in style-src is required because Tailwind v4 injects styles inline.
  //   - connect-src includes api.groq.com for the AI diagnosis endpoint.
  //   - script-src uses 'self' only — no inline scripts, no eval.
  response.headers.set(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      "script-src 'self'",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "connect-src 'self' https://api.groq.com",
      "img-src 'self' data:",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; ")
  );

  // HTTP Strict Transport Security — only set in production where HTTPS is guaranteed.
  // In development (HTTP), HSTS would break the dev server.
  if (import.meta.env.PROD) {
    response.headers.set(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains"
    );
  }

  return response;
};
