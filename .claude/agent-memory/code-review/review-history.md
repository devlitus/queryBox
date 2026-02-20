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
