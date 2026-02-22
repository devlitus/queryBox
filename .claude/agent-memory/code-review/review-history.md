# Review History — Detailed Learnings

## Postman Clone Review

### First Review — Issues Found
1. Responsiveness: CSS defined but JSX without responsive changes
2. Keyboard nav: No Custom Element implemented it initially
3. ARIA: Missing 4 specific patterns (controls, level, listbox, hidden)
4. Mobile UI: No hamburger, no RequestBar stack, no header simplification

### Second Review — All Issues Resolved
- Complete responsiveness: hamburger, backdrop, responsive RequestBar, header simplified
- Keyboard navigation: all Custom Elements have complete keyboard handlers
- Complete ARIA: `aria-controls`, `aria-level`, `role="listbox"`, `aria-hidden` implemented
- Estimated correction time: ~4-6 hours for 12 issues

### Approved Work Quality
- Structure: 56/53 files (106% of plan), TypeScript: 0 errors, Build: 957ms, WCAG 2.1 AA complete

---

## HTTP Client MVP Review (Preact Islands)

### Error Pattern: Framework Integration in astro.config.mjs
- `bun astro check` does NOT verify framework renderers are registered
- Package `@astrojs/preact` in `package.json` BUT if not in `integrations: [preact()]`, build fails
- Production error: `[NoMatchingRenderer] Unable to render ComponentName`
- `bun run build` is the ONLY command that detects this

### Error Pattern: XSS in dangerouslySetInnerHTML
- `dangerouslySetInnerHTML` with HTTP response data is XSS if HTML not escaped
- Fix: `escapeHtml()` before inserting content in `__html`

### Error Pattern: Duplicate IDs in Multiple Component Instances
- Multiple instances of tab components generate duplicate IDs (e.g. `tabpanel-body` in both request + response tabs)
- Fix: `idPrefix` prop in reusable `Tabs` component, or unique hardcoded IDs per context

### Quality Observations
- Global signals with `.value` is idiomatic `@preact/signals` pattern
- Bidirectional URL-params sync with `isUpdatingFromParams` flag to prevent re-entry
- `batch()` correctly used for multiple atomic signal updates

---

## Local Persistence Review (Preact Islands)

### Error Pattern: Keyboard Handler with Focus Model Mismatch (Tree Navigation)
- Keyboard handler present but non-functional
- `querySelectorAll('[role="treeitem"]')` returns `<li>` without `tabIndex` → not focusable
- `document.activeElement` always a child `<button>` → `items.indexOf(focused) = -1` always
- Correct fix: select `'[role="treeitem"] button:first-of-type'`, use `closest('[role="treeitem"]')` to read aria-level and data-collection-id

### Error Pattern: Nested `<button>` inside `<button>` (Invalid HTML)
- HTML spec: `<button>` cannot contain interactive content
- Fix: Container `<div>` with two `<button>` siblings

### Recurring Error: Missing `aria-level` on Trees
- Second review with `aria-level` missing on `role="treeitem"`
- Fix: `aria-level={1}` on collections, `aria-level={2}` on requests

### Final Outcome: 3 review cycles
- Cycle 1: 1 ALTA + 2 MEDIA. Cycle 2: ALTA + MEDIA #1 resolved, MEDIA #2 broken. Cycle 3: APPROVED.

---

## Test Runner Review (Vitest + Happy-DOM)

### Error Pattern: `bun test` vs `bun run test` Command Conflict
- In Bun's CLI, `bun test` is a built-in alias for Bun's native test runner — IGNORES package.json scripts
- Running `bun test` directly fails 100% when project uses Vitest: `localStorage is not defined`, `vi.resetModules is not a function`
- Correct invocation: `bun run test` (goes through package.json script)
- **When reviewing test runner features**: always run BOTH `bun test` and `bun run test` to expose this conflict

### Error Pattern: Test That Does Not Actually Exercise the Catch Block
- Test intends to cover `buildUrlWithParams` catch branch for malformed URL + params
- Used `"not a url at all!!!"` — but `new URL("https://dummy.host/not a url at all!!!")` succeeds (spaces encoded)
- The test assertion passed because it went through the non-protocol path, not the catch fallback
- Coverage showed lines 59-64 (`url.ts`) uncovered despite test appearing correct
- Fix: Use a URL that genuinely throws `TypeError` in `new URL()`, e.g. `"http://[invalid"`

### Vitest-Specific Patterns Verified Correct
- `vi.resetModules()` + dynamic `import()` in `beforeEach` correctly resets module-level signal state
- `vi.mock()` at top-level is hoisted and remains effective after `vi.resetModules()`
- `vi.mock()` inside `beforeEach` is NOT hoisted — redundant but harmless (top-level mock takes effect)
- Global `describe`/`it`/`expect` available without imports when `globals: true` in vitest.config.ts
- `vi.spyOn(Storage.prototype, "setItem")` correctly intercepts localStorage for quota tests

### Coverage Thresholds in Vitest
- Per-file thresholds not set in this project — only global 70% thresholds
- Global threshold can pass even if individual files are below (averages can be misleading)
- `http-store.ts`: 75.75% statements / 25% branches — computed signals entirely untested
- `statusColorClass` branches (2xx, 3xx, 4xx+) are all 0% covered
- Plan said "80%+ statements for http-store.ts" — missed at 75.75%

### Test Runner Setup — What Was Done Well
- `src/test/factories.ts` with typed factory functions (extra: `makeKeyValuePair`, `makeSavedRequest`)
- Tests verify both signal state AND localStorage persistence in same test case
- Phase 4 stores correctly use `vi.resetModules()` + dynamic import (plan recommendation followed)
- All 118 tests pass, 0 TypeScript errors, build successful

---

## Server-Side HTTP Proxy Review

### Date: 2025-01-21
### Status: ✅ APPROVED ON FIRST REVIEW (ZERO ITERATIONS)
### Tests: 508 total (62 new: 56 unit + 6 integration)
### Issues: 0 ALTA, 0 MEDIA, 3 BAJA (cosmetic only)

### Exemplary Implementation Quality — Gold Standard

This is a **reference implementation** — zero iterations required, approved immediately. **Use this as the template for what "perfect" looks like.**

### What Made It Perfect

1. **Plan adherence**: 100% — all 6 phases implemented exactly as specified
2. **Security**: Comprehensive — SSRF, header injection, DoS, open relay all mitigated
3. **Testing**: 62 tests covering all critical paths + edge cases (IPv6 brackets, timeouts, AbortSignal)
4. **Documentation**: JSDoc on all public APIs, inline comments explain "why" not "what"
5. **Backward compatibility**: Zero breaking changes — `sendRequest()` signature unchanged
6. **Type safety**: TypeScript strict — no `any` types, proper type guards
7. **Error handling**: Error codes match plan D4 exactly (400/403/413/429/502/504/500)
8. **Resource management**: `clearTimeout()` in finally blocks — no leaks

### Key Patterns to Replicate

#### Pattern 1: SSRF Prevention with DEV Mode Exception
```typescript
// Production: block localhost/private IPs
// Development: allow localhost for testing local APIs
if (isDev) {
  // Only validate protocol (still block file://, ftp://)
  return protocol === "http:" || protocol === "https:";
}
// Production: full SSRF checks
```
**Why**: Pragmatic security — queryBox is a dev tool, blocking localhost in dev makes it unusable.

#### Pattern 2: IPv6 Bracket Stripping
```typescript
const ipv6Hostname = hostname.startsWith("[") && hostname.endsWith("]")
  ? hostname.slice(1, -1)
  : hostname;
```
**Why**: `URL.hostname` includes brackets for IPv6 (e.g., `[::1]`), must strip for validation.

#### Pattern 3: AbortController Timeout with Cleanup
```typescript
const timeoutId = setTimeout(() => controller.abort(), timeout);
try {
  const response = await fetch(url, { signal: controller.signal });
  // ...
} finally {
  clearTimeout(timeoutId);  // CRITICAL: prevents memory leak
}
```
**Why**: Always cleanup timers even if fetch succeeds early or throws.

#### Pattern 4: Rate Limiter Factory Pattern
```typescript
const createRateLimiter = (config) => ({ checkRateLimit, reset });
const aiRateLimiter = createRateLimiter({ maxRequests: 10, windowMs: 60000 });
const proxyRateLimiter = createRateLimiter({ maxRequests: 100, windowMs: 60000 });
```
**Why**: Separate instances/limits for different endpoints, no shared state.

#### Pattern 5: Proxy Status Code Strategy
- Proxy returns **200** when external API responds (even if API returns 4xx/5xx)
- Proxy reserves error codes for **proxy-level** failures (429 rate limit, 504 timeout, 502 network)
- **Principle**: Client distinguishes "proxy failed" vs "API returned error"

#### Pattern 6: Header Sanitization Blocklist
```typescript
const blocklist = new Set(["host", "connection", "keep-alive", "transfer-encoding", "upgrade", "te", "trailer"]);
for (const [key, value] of Object.entries(headers)) {
  if (blocklist.has(key.toLowerCase())) continue;
  if (key.toLowerCase().startsWith("proxy-")) continue;
  sanitized[key] = value;
}
```
**Why**: Never forward connection management headers or internal proxy headers.

#### Pattern 7: Content-Length Validation Before Stream Read
```typescript
const contentLength = request.headers.get("content-length");
if (contentLength && parseInt(contentLength, 10) > PROXY_MAX_BODY_SIZE) {
  return jsonError(413, "payload-too-large", "...");
}
// NOW read body stream
```
**Why**: Fail fast — don't start reading a 100 MB body if the limit is 5 MB.

#### Pattern 8: History URL Template Preservation
```typescript
// Store ORIGINAL unresolved URL (with {{variables}})
addHistoryEntry({
  url: state.url,  // NOT resolvedUrl
  // ...
});
// But auto-rename uses RESOLVED hostname
const hostname = new URL(resolvedUrl).hostname;
renameTab(currentTab.id, hostname);
```
**Why**: History entries are reusable templates; tab names are user-facing.

#### Pattern 9: Test Mocking Patterns
```typescript
// Mock fetch globally
vi.stubGlobal('fetch', vi.fn());
// Mock AbortSignal correctly
signal.addEventListener('abort', () => {
  reject(new DOMException('Aborted', 'AbortError'));
});
```
**Why**: `AbortSignal` uses event pattern, direct assignment doesn't work.

#### Pattern 10: HttpError Type Extension
```typescript
// BEFORE: "network" | "cors" | "timeout" | "abort" | "unknown"
// AFTER:  "network" | "cors" | "timeout" | "abort" | "unknown" | "rate-limit" | "forbidden"
```
**Why**: New proxy error types cleanly integrated without breaking existing error handling.

### Only 3 BAJA Issues (Cosmetic)

1. **Plan vs code naming**: Plan says `ProxyResponse`, code uses `ProxySuccessResponse` (code is better)
2. **Magic number in error message**: Hardcoded "5 MB" instead of calculating from `PROXY_MAX_BODY_SIZE`
3. **Comment in isAllowedUrl**: Could be more explicit about DEV mode security tradeoff

### Security Audit — All Mitigated

✅ **SSRF**: localhost/private IPs blocked in production, DEV exception documented  
✅ **Header Injection**: Comprehensive sanitization blocklist  
✅ **DoS**: Rate limiting (100/60s), timeout (max 120s), body size (5 MB)  
✅ **Information Disclosure**: Proxy errors 200 vs 4xx/5xx, internal headers not forwarded  
✅ **Open Relay**: SSRF prevention + rate limiting  

### Why This Review Required Zero Iterations

1. **Plan was comprehensive**: D1-D8 design decisions covered all edge cases
2. **Security designed upfront**: SSRF, DEV mode exception, header sanitization all in plan
3. **Tests written alongside code**: 62 tests (not afterthought)
4. **Resource management**: `clearTimeout()` in finally blocks from the start
5. **Error codes followed plan D4**: No ad-hoc error code decisions
6. **Documentation included**: JSDoc, inline comments, file headers all present
7. **Backward compat considered**: Zero breaking changes to existing code

### Learnings for Future Reviews

- **Server-proxy is the reference implementation** — link reviewees to this code when they ask "what does good look like?"
- When security features have DEV exceptions, verify `import.meta.env.DEV` is used (not hardcoded booleans)
- IPv6 bracket stripping is required for validation (watch for this in URL validation)
- AbortController cleanup in finally blocks is mandatory pattern
- Test mocking: AbortSignal requires `addEventListener('abort')`, not direct property assignment
- Factory pattern for rate limiters allows separate instances without code duplication
- Proxy status code strategy (200 for API responses, 4xx/5xx for proxy errors) is non-obvious but correct

