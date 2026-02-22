# Security Auditor - Agent Memory

## First Audit Completed: 2026-02-22
## Branch: feature/ai-error-diagnosis
## Report: docs/ai-error-diagnosis/audit/ai-error-diagnosis-security-audit.md
## Overall Risk Rating: CRITICAL (due to exposed API key in .env)

---

## Project Security Surface

### API Endpoints (1)
- `POST /api/diagnose` — Rate limited (10 req/min), validates DiagnosisContext schema.
  Missing: body size limit, method enum validation, URL format validation.

### Server Services
- `src/server/groq-service.ts` — Groq client from GROQ_API_KEY (server-only, correct).
- `src/server/rate-limiter.ts` — In-memory sliding window by IP. Falls back to "unknown"
  bucket when clientAddress missing (vulnerability). Not distributed.

### Client Services
- `src/services/ai-sanitizer.ts` — ROBUST. Redacts Authorization/Cookie/X-API-Key headers,
  sensitive query params, sensitive JSON fields recursively. Truncates bodies.
- `src/services/http-client.ts` — Client-side fetch only. 5MB body limit.
- `src/services/ai-client.ts` — Streams /api/diagnose response via ReadableStream.

### Storage
- localStorage: 7 keys. Stores auth credentials (Basic, Bearer, API keys) in cleartext.
  Schema validated on read with type guards.

### Dangerous DOM Patterns
- Dropdown.tsx line 118: dangerouslySetInnerHTML with unvalidated `icon` prop. Currently
  only static SVG assets passed, but type contract not enforced. RISKY pattern.
- AiDiagnosisPanel.tsx lines 128, 172: dangerouslySetInnerHTML — SAFE (uses renderMarkdownLite
  which HTML-escapes correctly).
- CodeViewer.tsx line 55: dangerouslySetInnerHTML — SAFE (escapeHtml before highlighting).
- set:html in Astro components — SAFE (static SVG assets only via ?raw imports).

### Environment Variables
- GROQ_API_KEY, AI_RATE_LIMIT_MAX, AI_RATE_LIMIT_WINDOW_MS — all server-only (no PUBLIC_ prefix).
- No PUBLIC_ env vars exist. Correct pattern throughout.

---

## Known Vulnerabilities (by severity)

### CRITICAL
- Real Groq API key in .env (gsk_c9XF78F...). Key in .gitignore, NOT in git history.
  Must be revoked immediately at https://console.groq.com

### HIGH (3)
- No HTTP security headers (CSP, HSTS, X-Frame-Options, X-Content-Type-Options, etc.)
- dangerouslySetInnerHTML in Dropdown.tsx with unvalidated icon string prop
- No body size limit in POST /api/diagnose (DoS via large JSON)

### MEDIUM (4)
- Rate limiter: fallback to "unknown" bucket when clientAddress missing
- Rate limiter: in-memory only, resets on restart, not distributed
- 4 dependency CVEs (ajv ReDoS dev-only, lodash prototype pollution dev-only, devalue low x2)
- No server-side enum validation for method field or URL format in DiagnosisContext

### LOW (2)
- Auth credentials in localStorage (cleartext, same-origin accessible)
- console.error may leak internal details in production

---

## Security Measures in Place (DO NOT flag as issues)
- ai-sanitizer.ts: comprehensive redaction before sending to Groq
- markdown-lite.ts: correct HTML-escaping (escape-first pattern)
- CodeViewer.tsx: escapeHtml before syntax highlighting
- GROQ_API_KEY server-only (no PUBLIC_ prefix)
- validateDiagnosisContext: schema validation on all API inputs
- AbortController used correctly for request cancellation
- 5MB response body limit in http-client.ts
- set:html only used with static SVG assets
- .env in .gitignore, not in git history

---

## Dependency CVE Status (2026-02-22)
- devalue (via astro): 2 low CVEs — GHSA-33hq-fvwr-56pm, GHSA-8qm3-746x-r74r (prod)
- ajv (via @astrojs/check): moderate ReDoS — dev tool only
- lodash (via @astrojs/check): moderate prototype pollution — dev tool only
- Run: bun update to fix
