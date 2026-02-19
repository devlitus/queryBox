# Code Review Report

## Feature: HTTP Client MVP
## Plan: docs/http-client/http-client-plan.md
## Date: 2026-02-19
## Status: NO APROBADO

---

### Summary

Reviewed the full HTTP Client MVP implementation: 17 new `.tsx` files, 3 new TypeScript modules (types, store, utils, services), updated Astro components, and deleted mock data files. The architecture is sound — the single HttpWorkbench island with Preact signals is correctly designed, TypeScript passes with 0 errors, and the component composition is clean and DRY.

However, two critical blockers prevent approval:

1. **Build failure**: The `@astrojs/preact` integration is installed as a package but was never registered in `astro.config.mjs`. The production build fails with `[NoMatchingRenderer] Unable to render HttpWorkbench`. The application cannot be deployed.

2. **XSS vulnerability in CodeViewer**: The `dangerouslySetInnerHTML` rendering path does not escape HTML entities before insertion. Any API response containing `<script>` tags or HTML event handlers (e.g., `<img onerror="...">`) will execute in the user's browser.

Additionally, one medium issue exists around duplicate DOM `id` attributes for tab panels.

---

### Plan Compliance Checklist

#### Phase 1: Project Setup - Preact Integration
- [x] `bun add @astrojs/preact preact @preact/signals` - packages installed
- [ ] `astro.config.mjs` updated to register Preact integration - **NOT DONE** (see Issue #1)
- [x] `tsconfig.json` updated with `jsx: "react-jsx"` and `jsxImportSource: "preact"`
- [x] `HttpWorkbench.tsx` smoke test created
- [ ] `bun build` completes successfully - **FAILS** due to missing integration

#### Phase 2: Type Definitions and Store Layer
- [x] `src/types/http.ts` created with all required types (HttpMethod, KeyValuePair, RequestState, ResponseState, RequestStatus, HttpError)
- [x] `src/stores/http-store.ts` created with all required signals
- [x] All 4 base signals defined (requestState, responseState, requestStatus, requestError)
- [x] All 5 computed signals defined (enabledParams, enabledHeaders, fullUrl, formattedSize, statusColorClass)
- [x] All action functions implemented (updateMethod, updateUrl, addParam, updateParam, removeParam, toggleParam, addHeader, updateHeader, removeHeader, toggleHeader, updateBodyMode, updateBodyContentType, updateBodyRaw, resetResponse)
- [x] Bidirectional URL-params sync implemented with `isUpdatingFromParams` flag to prevent re-entry
- [x] `src/utils/url.ts` created (parseQueryParams, buildUrlWithParams, formatBytes)
- [x] Edge cases handled: empty URL, no protocol, malformed URL

#### Phase 3: Request Panel Islands
- [x] `src/components/shared/Dropdown.tsx` created with full keyboard navigation (ArrowUp/Down, Enter, Space, Escape, Home, End, Tab)
- [x] `src/components/shared/Dropdown.tsx` has ARIA: role="listbox", role="option", aria-expanded, aria-selected, aria-haspopup
- [x] `src/components/shared/Tabs.tsx` created with keyboard navigation (ArrowLeft/Right, Home, End)
- [x] `src/components/shared/Tabs.tsx` has ARIA: role="tablist", role="tab", role="tabpanel", aria-selected, aria-controls
- [x] `src/components/request/MethodSelector.tsx` created using Dropdown with pm-method-* classes
- [x] `src/components/shared/KeyValueTable.tsx` created with checkbox, key/value inputs, description, delete button
- [x] Placeholder row auto-adds on focus (onFocus={onAdd})
- [x] `src/components/request/ParamsTable.tsx` created (thin wrapper, showDescription=true)
- [x] `src/components/request/HeadersTable.tsx` created (thin wrapper, showDescription=false)
- [x] `src/components/shared/CodeViewer.tsx` created with useMemo for highlighting
- [ ] CodeViewer uses dangerouslySetInnerHTML WITHOUT HTML escaping - **XSS risk** (see Issue #2)
- [x] `src/components/request/BodyEditor.tsx` created with none/raw modes, content type dropdown, textarea
- [x] `src/components/request/RequestBar.tsx` created with URL input, Send button, Cancel button, loading state
- [x] Responsive layout: `flex-col md:flex-row` on RequestBar
- [x] `src/components/request/RequestConfigTabs.tsx` created with Params, Headers, Body tabs and counts
- [x] `src/components/request/RequestPanel.tsx` created composing RequestBar + RequestConfigTabs

#### Phase 4: HTTP Engine
- [x] `src/services/http-client.ts` created with CORS documentation comment
- [x] `sendRequest()` function implemented
- [x] Request state read from signals, loading state set before fetch
- [x] Headers built from enabled headers only
- [x] Auto Content-Type header for raw body mode
- [x] Body sent only for POST/PUT/PATCH/DELETE with raw mode and non-empty body
- [x] Performance timing via `performance.now()`
- [x] Response body read as text, truncated at 5MB
- [x] Response size from Content-Length or Blob size
- [x] Response headers extracted via `response.headers.forEach()`
- [x] AbortController for cancel support (`cancelRequest()` exported)
- [x] Previous in-flight request cancelled when new request starts
- [x] Error categorization: TypeError -> network/cors, AbortError -> abort, other -> unknown
- [x] CORS detection via error message text inspection
- [x] Helpful CORS error message with alternative API suggestions

#### Phase 5: Response Panel Islands
- [x] `src/components/response/ResponseStatusBar.tsx` with status, time, size using pm-status-* colors
- [x] `src/components/response/ResponseBody.tsx` with pretty/raw toggle, JSON detection, copy button
- [x] JSON body: parse + stringify for pretty-printing, fallback to raw on parse error
- [x] 100KB limit for pretty-printing to avoid slow parsing
- [x] Copy button uses navigator.clipboard.writeText
- [x] `src/components/response/ResponseHeaders.tsx` as read-only key-value table
- [x] `src/components/response/ResponseTabs.tsx` with Body and Headers tabs
- [x] `src/components/response/ResponsePanel.tsx` with idle/loading/success/error states
- [x] Idle state: message + suggested test URL
- [x] Loading state: CSS spinner + aria-live="polite" + role="status"
- [x] Error state: role="alert" + aria-live="assertive" + type-specific error title
- [x] Success state: StatusBar + ResponseTabs

#### Phase 6: Wire Up and Clean Up
- [x] `HttpWorkbench.tsx` final version composes RequestPanel + ResponsePanel
- [x] Visual resize handle (static for MVP) included
- [x] `Workbench.astro` updated to `<HttpWorkbench client:load />`
- [x] All 5 mock data files deleted (mock-request, mock-response, mock-collections, mock-environments, mock-history)
- [x] Sidebar empty states: CollectionTree, HistoryList, EnvironmentList show placeholder messages
- [x] No remaining imports of mock-* files in codebase
- [x] All replaced .astro files deleted from request/response/shared directories
- [x] AuthPanel.astro retained with empty auth state (no hardcoded tokens)
- [x] TabBar.astro updated to show single "New Request" tab

#### Phase 7: Verification and Polish
- [x] URL input placeholder text included
- [x] Empty response state with suggested test URL
- [x] CSS-only loading spinner (animate-spin)
- [x] Error messages: clear, actionable, CORS-specific guidance
- [ ] `bun build` succeeds - **FAILS** (see Issue #1)

---

### Issues Found

#### ALTA (2 issues)

**Issue #1: Missing Preact integration in astro.config.mjs - Build fails**
File: `astro.config.mjs`

- Description: The `@astrojs/preact` package is installed in `package.json` (`"@astrojs/preact": "^4.1.3"`) but was never registered in `astro.config.mjs` using the `integrations` array. During `bun astro check`, Astro only validates TypeScript and Astro file syntax — it does NOT verify that framework components have a valid renderer registered. The build fails at the static route generation step with: `[NoMatchingRenderer] Unable to render HttpWorkbench. No valid renderer was found for the .tsx file extension.`
- Expected: `astro.config.mjs` must import `preact` from `@astrojs/preact` and add it to the `integrations` array as specified in the plan (Phase 1, Task 2).
- Suggestion: Update `astro.config.mjs` as follows:
  ```js
  import { defineConfig } from 'astro/config';
  import tailwindcss from '@tailwindcss/vite';
  import preact from '@astrojs/preact';

  export default defineConfig({
    integrations: [preact()],
    vite: {
      plugins: [tailwindcss()]
    }
  });
  ```

**Issue #2: XSS vulnerability in CodeViewer.tsx - dangerouslySetInnerHTML without HTML escaping**
File: `src/components/shared/CodeViewer.tsx` (lines 13-39)

- Description: The `highlightJson` function and the non-JSON code path both insert user-controlled data (the HTTP response body from an external API) directly into the DOM via `dangerouslySetInnerHTML` without first escaping HTML special characters (`<`, `>`, `&`, `"`, `'`). This is an XSS vulnerability. For example:
  - If an API returns a JSON body containing a string value like `"<img src=x onerror=alert(1)>"`, the `highlightJson` regex wraps it in a `<span>` but does not escape the inner HTML. The `<img onerror>` payload executes.
  - If `language === "text"` (non-JSON response), `highlighted = code` and the raw response body is passed directly to `dangerouslySetInnerHTML`. An API returning `<script>alert(document.cookie)</script>` would execute.
  - The plan acknowledged this risk and noted it was acceptable for MVP "since the user controls the input." However, HTTP responses come from external third-party servers, not solely from the user. A malicious API or a compromised API can inject arbitrary HTML/JS.
- Expected: HTML entities must be escaped before inserting into the DOM. The minimum fix is to escape `<`, `>`, `&`, `"`, `'` before applying syntax highlighting regex patterns.
- Suggestion: Add an escape function and apply it before highlighting:
  ```ts
  function escapeHtml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function highlightJson(jsonString: string): string {
    // Escape HTML first, then apply highlighting on escaped content
    const escaped = escapeHtml(jsonString);
    try {
      return escaped
        .replace(/"([^"]+)"(\s*:)/g, '<span class="text-pm-syntax-key">"$1"</span>$2')
        .replace(/:\s*"([^"]*)"/g, ': <span class="text-pm-syntax-string">"$1"</span>')
        // ... rest of replacements
    } catch {
      return escaped;
    }
  }

  export default function CodeViewer({ code, language }: Props) {
    const highlighted = useMemo(() => {
      if (language === "json") return highlightJson(code);
      return escapeHtml(code); // Always escape non-JSON content too
    }, [code, language]);
    // ...
  }
  ```

---

#### MEDIA (1 issue)

**Issue #3: Duplicate DOM element IDs across RequestConfigTabs and ResponseTabs**
Files: `src/components/request/RequestConfigTabs.tsx` (lines 32-39) and `src/components/response/ResponseTabs.tsx` (lines 23-27)

- Description: Both `RequestConfigTabs` and `ResponseTabs` are rendered simultaneously in the DOM (both are part of the single `HttpWorkbench` island). They generate tab panel `div` elements with identical `id` attributes:
  - `RequestConfigTabs` renders `id="tabpanel-body"` and `id="tabpanel-headers"`
  - `ResponseTabs` also renders `id="tabpanel-body"` and `id="tabpanel-headers"`

  Duplicate IDs violate HTML specification (IDs must be unique per document). They also break the ARIA `aria-controls` linkage — `aria-controls="tabpanel-body"` on both the request and response tab buttons would point to the same first element found in the DOM, making the association incorrect for screen readers.
- Expected: All IDs on the page must be unique. The plan specified `aria-controls` linking tab buttons to their panels (Phase 3, Tabs.tsx spec), which requires unique panel IDs.
- Suggestion: Add a unique prefix to disambiguate the two tab groups. For example:
  - `RequestConfigTabs`: use IDs `id="req-tabpanel-params"`, `id="req-tabpanel-headers"`, `id="req-tabpanel-body"`
  - `ResponseTabs`: use IDs `id="res-tabpanel-body"`, `id="res-tabpanel-headers"`

  The `Tabs` component generates `aria-controls={`tabpanel-${tab.id}`}`. A prop like `idPrefix?: string` can be added to `Tabs` so callers can set distinct prefixes:
  ```tsx
  // In Tabs.tsx
  interface Props {
    tabs: TabItem[];
    activeTab: string;
    onTabChange: (id: string) => void;
    children?: ComponentChildren;
    idPrefix?: string; // e.g., "req" or "res"
  }
  // aria-controls={`${idPrefix ?? ""}tabpanel-${tab.id}`}
  ```

---

#### BAJA (4 issues)

**Issue #4: SVG icon in Dropdown button has no aria-hidden**
File: `src/components/shared/Dropdown.tsx` (line 115)

- Description: The chevron-down SVG inside the trigger button (`<svg class="w-4 h-4 text-pm-text-secondary" ...>`) has no `aria-hidden="true"`. Screen readers will attempt to announce this decorative icon. This was a consistently required pattern in the Postman Clone review.
- Suggestion: Add `aria-hidden="true"` to the SVG element.

**Issue #5: Dropdown button and listbox have no accessible name**
File: `src/components/shared/Dropdown.tsx` (line 106-118)

- Description: The trigger `<button>` and the `role="listbox"` container have no `aria-label` or `aria-labelledby`. Screen readers will have difficulty identifying the purpose of the dropdown.
- Suggestion: Accept an optional `aria-label` prop on `Dropdown` and pass it to both the button and the listbox. At the usage site, `MethodSelector` should pass `aria-label="HTTP Method"` and `BodyEditor` should pass `aria-label="Content Type"`.

**Issue #6: `RequestBar.tsx` directly reads signal values at component render time without using `useSignal`/computed**
File: `src/components/request/RequestBar.tsx` (lines 7-9)

- Description: Lines 7-9 read `requestStatus.value` and `requestState.value.url` directly at the top of the function. In Preact signals, this is valid — the component will re-render automatically when a tracked signal value changes because the signal is accessed during render. This pattern works correctly with `@preact/signals` autotracking. This is not a bug, but it is worth noting that consistent use of `useSignal` for local component state vs. direct `.value` access for global store signals is a pattern difference. The current approach is idiomatic for `@preact/signals`.
- Suggestion: No change needed. Document the pattern in a comment for clarity.

**Issue #7: TabBar.astro retains hardcoded "GET" method in the static tab**
File: `src/components/workbench/TabBar.astro` (line 8)

- Description: The plan specified to replace hardcoded tabs with a single "New Request" tab or empty state. The implementation does show "New Request" as the tab name (correct), but still passes `method="GET"` as a hardcoded prop. Since the method in the actual request can be changed, this static label may appear stale (always showing "GET" even if the user selected "DELETE"). For MVP this is acceptable since the plan describes TabBar as "static for MVP."
- Suggestion: Either remove the `method` prop display from the tab or document it as a known MVP limitation. No action required before approval.

---

### Verdict

**NOT APPROVED - 2 ALTA issues and 1 MEDIA issue must be resolved.**

**Issue #1 (ALTA)** is the most critical: the production build is completely broken. The `@astrojs/preact` integration registration step was specified in the plan (Phase 1, Task 2) and must be added to `astro.config.mjs`. This is a one-line fix that unblocks the entire deployment.

**Issue #2 (ALTA)** is a security vulnerability: the CodeViewer renders arbitrary HTTP response content via `dangerouslySetInnerHTML` without HTML entity escaping. The plan explicitly acknowledged this risk but framed it as acceptable because "the user controls the input." However, HTTP response bodies come from third-party servers, not solely from the user. This must be fixed with an `escapeHtml()` call before any highlighting is applied.

**Issue #3 (MEDIA)** is an accessibility and HTML validity violation: duplicate `id="tabpanel-body"` and `id="tabpanel-headers"` exist in the DOM simultaneously (one from request tabs, one from response tabs), breaking `aria-controls` linkage for screen readers and violating the HTML specification.

The BAJA issues (#4-#7) do not block approval and can be addressed in a follow-up task.

After fixing the 3 blocking issues, please re-run `bun astro check` and `bun run build` to verify both pass before requesting re-review.

---

## Fix Pass - 2026-02-19

All issues (ALTA, MEDIA, and BAJA) corrected by senior-developer agent.

### Fixes Applied

**Issue #1 (ALTA) - Fixed**: Added `import preact from '@astrojs/preact'` and `integrations: [preact()]` to `astro.config.mjs`.

**Issue #2 (ALTA) - Fixed**: Added `escapeHtml()` function to `src/components/shared/CodeViewer.tsx`. It escapes `&`, `<`, `>`, `"`, `'` before any regex highlighting is applied. The non-JSON (`text`/`javascript`) path now also calls `escapeHtml()` instead of returning raw content.

**Issue #3 (MEDIA) - Fixed**: Added `idPrefix?: string` prop to `src/components/shared/Tabs.tsx`. `aria-controls` now uses `${idPrefix}tabpanel-${tab.id}`. `RequestConfigTabs.tsx` passes `idPrefix="req-"` (panel IDs: `req-tabpanel-params`, `req-tabpanel-headers`, `req-tabpanel-body`). `ResponseTabs.tsx` passes `idPrefix="res-"` (panel IDs: `res-tabpanel-body`, `res-tabpanel-headers`).

**Issue #4 (BAJA) - Fixed**: Added `aria-hidden="true"` to the chevron SVG in `src/components/shared/Dropdown.tsx`.

**Issue #5 (BAJA) - Fixed**: Added `label?: string` prop to `Dropdown`. Button receives `aria-label={label}` and the listbox div receives `aria-label={label}`. `MethodSelector` passes `label="HTTP Method"`. `BodyEditor` passes `label="Content Type"`.

**Issue #7 (BAJA) - Fixed**: Made `method` prop optional in `src/components/workbench/TabItem.astro` (type: `HttpMethod | undefined`). Badge only renders when `method` is defined. `TabBar.astro` now passes no `method` prop, so the tab shows "New Request" without a method badge.

### Verification

- `bun astro check`: 0 errors, 0 warnings, 1 pre-existing hint (unrelated `ts(6133)` in `src/scripts/dropdown.ts`)
- `bun run build`: Success — 1 page built, all 4 client JS chunks generated including `HttpWorkbench.CcRpjAow.js`

---

## Review #2 - 2026-02-19

### Status: APROBADO

### Summary

All 2 ALTA issues and 1 MEDIA issue from Review #1 have been correctly resolved. All 3 BAJA issues were also addressed (not required for approval, but completed regardless). No new issues were introduced by the fixes. The build passes cleanly and TypeScript checks out with 0 errors.

---

### Issue Verification

#### Issue #1 (ALTA) - RESOLVED

**File**: `astro.config.mjs`

Verified. The file now contains:

```js
import preact from '@astrojs/preact';

export default defineConfig({
  integrations: [preact()],
  vite: { plugins: [tailwindcss()] }
});
```

The Preact integration is correctly registered. `bun run build` confirms the island is bundled as `HttpWorkbench.CcRpjAow.js` (22.86 kB, gzip: 6.59 kB).

#### Issue #2 (ALTA) - RESOLVED

**File**: `src/components/shared/CodeViewer.tsx`

Verified. The `escapeHtml()` function is correctly implemented and is called in both code paths before any DOM insertion:

- JSON path: `highlightJson()` calls `escapeHtml(jsonString)` as the first operation, then applies regex highlighting on the already-escaped string.
- Non-JSON path: `return escapeHtml(code)` directly.

The regex patterns in `highlightJson()` operate on already-escaped content, so the span tags injected by the highlighter are safe (they are injected by our own code, not from external input). The `&`, `<`, `>`, `"`, `'` characters from API response bodies cannot escape into raw HTML. XSS vulnerability is fully remediated.

#### Issue #3 (MEDIA) - RESOLVED

**Files**: `src/components/shared/Tabs.tsx`, `src/components/request/RequestConfigTabs.tsx`, `src/components/response/ResponseTabs.tsx`

Verified. The `idPrefix?: string` prop was added to `Tabs.tsx` with a default value of `""`. The `aria-controls` attribute now reads `${idPrefix}tabpanel-${tab.id}`.

Confirmed unique ID assignments:

- `RequestConfigTabs` passes `idPrefix="req-"`, producing panel IDs: `req-tabpanel-params`, `req-tabpanel-headers`, `req-tabpanel-body`
- `ResponseTabs` passes `idPrefix="res-"`, producing panel IDs: `res-tabpanel-body`, `res-tabpanel-headers`
- Sidebar static tabs use unprefixed IDs (`tabpanel-collections`, `tabpanel-environments`, `tabpanel-history`) — no conflict

All IDs are unique in the document. ARIA `aria-controls` correctly links each tab button to its corresponding panel.

#### Issue #4 (BAJA) - RESOLVED

**File**: `src/components/shared/Dropdown.tsx` (line 117)

Verified. The chevron SVG now has `aria-hidden="true"`:

```tsx
<svg class="w-4 h-4 text-pm-text-secondary" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
```

#### Issue #5 (BAJA) - RESOLVED

**Files**: `src/components/shared/Dropdown.tsx`, `src/components/request/MethodSelector.tsx`, `src/components/request/BodyEditor.tsx`

Verified. The `label?: string` prop was added to `Dropdown`. Both the trigger button and the `role="listbox"` container receive `aria-label={label}`. Usage sites pass the correct labels:

- `MethodSelector`: `label="HTTP Method"`
- `BodyEditor`: `label="Content Type"`

#### Issue #7 (BAJA) - RESOLVED

**Files**: `src/components/workbench/TabItem.astro`, `src/components/workbench/TabBar.astro`

Verified. `TabItem.astro` now declares `method?: HttpMethod` (optional). The `<Badge>` for the method only renders when `method` is defined (`{method && <Badge ... />}`). `TabBar.astro` passes no `method` prop, so the "New Request" tab renders without a hardcoded "GET" badge.

---

### New Issues Introduced by Fixes

None found. The fixes are clean and targeted. Specifically confirmed:

- The `idPrefix` defaulting to `""` (empty string) in `Tabs.tsx` means any existing consumer that does not pass `idPrefix` will generate panel IDs identical to the old behavior (`tabpanel-${tab.id}`). The sidebar uses its own Custom Element (`pm-tabs`) with hardcoded IDs and does not use the Preact `Tabs.tsx` component at all — no regression.
- The `escapeHtml()` approach does not affect the visual appearance of the highlighted JSON because span class tags are injected after escaping (they are safe markup from our code, not from external input).
- The optional `label` prop on `Dropdown` is backward-compatible; existing call sites without a label prop remain valid TypeScript.

---

### Build Verification

- `bun astro check`: 0 errors, 0 warnings, 1 pre-existing hint (`ts(6133)` in `src/scripts/dropdown.ts` — pre-existing, not introduced by these fixes)
- `bun run build`: SUCCESS — 1 page built in 1.37s, 4 client JS chunks generated:
  - `client.Dp13kgEr.js` — 2.27 kB (gzip: 1.23 kB)
  - `signals.module.yoHtZIWe.js` — 9.54 kB (gzip: 3.64 kB)
  - `preact.module.EGlgVV74.js` — 10.32 kB (gzip: 4.39 kB)
  - `HttpWorkbench.CcRpjAow.js` — 22.86 kB (gzip: 6.59 kB)

Total island payload: ~16 kB gzipped (within the 7-10 kB Preact + signals estimate from the plan, plus the application code).

---

### Final Verdict

APPROVED. All ALTA and MEDIA issues from Review #1 are resolved. All BAJA issues were also fixed as a bonus. No regressions were introduced. The HTTP Client MVP implementation is complete and correct.
