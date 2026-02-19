# HTTP Client MVP - Implementation Plan

**Feature**: Convert queryBox from static UI to functional HTTP client
**Date**: 2026-02-19
**Status**: Draft

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture Decision: Preact Islands Boundary](#architecture-decision)
3. [Component Migration Map](#component-migration-map)
4. [Phase 1: Project Setup - Preact Integration](#phase-1)
5. [Phase 2: Type Definitions and Store Layer](#phase-2)
6. [Phase 3: Request Panel Islands](#phase-3)
7. [Phase 4: HTTP Engine (fetch Service)](#phase-4)
8. [Phase 5: Response Panel Islands](#phase-5)
9. [Phase 6: Wire Up Send Flow and Clean Up Mocks](#phase-6)
10. [Phase 7: Verification and Polish](#phase-7)

---

## Overview <a id="overview"></a>

### Current State

queryBox is a static Postman-like UI built with Astro 5 components. All data is hardcoded in `src/data/mock-*.ts` files. Interactivity is limited to 4 Custom Elements (tabs, dropdown, tree, sidebar) that handle tab switching and dropdown menus. No HTTP requests are sent; the response panel displays mock data.

### Target State (MVP)

A functional HTTP client where:

- The user enters a URL, selects a method, configures params/headers/body
- Clicking "Send" executes a real `fetch()` call
- The response panel displays the real status, headers, body, timing, and size
- All interactive state is managed by Preact signals within Preact islands
- Static shell (header, footer, sidebar, layout) remains as Astro components

### Key Technical Decisions

| Decision | Choice | Justification |
|----------|--------|---------------|
| UI Framework | Preact via `@astrojs/preact` | 3kB, same API as React, native signals support, official Astro integration |
| State Management | `@preact/signals` | Built into Preact, fine-grained reactivity, no extra library needed, works across islands via module-level signals |
| Island boundary | Workbench area only | Request panel + Response panel become one Preact island; shell stays Astro |
| CORS strategy | Document limitation + suggest CORS proxy | Browser `fetch()` is subject to CORS; this is a known MVP limitation |
| Custom Elements | Keep as-is for sidebar/header | They work in static context; no need to migrate for MVP |
| File extension | `.tsx` for Preact components | Required for JSX, consistent with Preact conventions |

---

## Architecture Decision: Island Boundary <a id="architecture-decision"></a>

### The Problem

Preact islands in Astro are isolated hydration boundaries. Two separate islands cannot share state through Preact context -- they need module-level signals or nanostores. The request panel and response panel must share state (the response data flows from a Send action in the request panel to the display in the response panel).

### Options Evaluated

**Option A: Two separate islands (RequestPanel + ResponsePanel) with module-level signals**

- Pros: Smaller island bundles, granular hydration
- Cons: Both islands load immediately anyway (both visible on page load), slightly more wiring complexity

**Option B: One unified island (HttpWorkbench) wrapping both panels**

- Pros: Shared context naturally, simpler state flow, one hydration boundary
- Cons: Larger single island, all-or-nothing hydration

**Option C: Multiple fine-grained islands per sub-component**

- Pros: Maximum code splitting
- Cons: Extreme wiring complexity for a tightly coupled feature, signal coordination overhead

### Decision: Option B - Single HttpWorkbench Island

**Rationale**: The request and response panels are tightly coupled for the MVP. Both are visible on page load (no lazy hydration benefit). A single island with `client:load` gives the simplest state management while keeping the static shell (header, footer, sidebar) as pure Astro. The island boundary is at the Workbench level -- everything inside it is Preact, everything outside is Astro.

### Architecture Diagram

```text
+------------------------------------------------------------------+
|  AppLayout.astro (static)                                        |
|  +------------------------------------------------------------+  |
|  |  HeaderBar.astro (static)                                  |  |
|  +------------------------------------------------------------+  |
|  | Sidebar.astro  |  Workbench.astro (static shell)           |  |
|  | (static +      |  +--------------------------------------+ |  |
|  |  Custom         |  | <HttpWorkbench client:load />        | |  |
|  |  Elements)      |  |  (Preact Island)                     | |  |
|  |                 |  |  +--------------------------------+  | |  |
|  |                 |  |  | RequestBar (method, URL, send) |  | |  |
|  |                 |  |  +--------------------------------+  | |  |
|  |                 |  |  | RequestConfigTabs              |  | |  |
|  |                 |  |  |  - ParamsTable                 |  | |  |
|  |                 |  |  |  - HeadersTable                |  | |  |
|  |                 |  |  |  - BodyEditor                  |  | |  |
|  |                 |  |  +--------------------------------+  | |  |
|  |                 |  |  | ResponsePanel                  |  | |  |
|  |                 |  |  |  - StatusBar                   |  | |  |
|  |                 |  |  |  - ResponseTabs (body,headers) |  | |  |
|  |                 |  |  +--------------------------------+  | |  |
|  |                 |  +--------------------------------------+ |  |
|  +-----------------+------------------------------------------+  |
|  +------------------------------------------------------------+  |
|  |  FooterBar.astro (static)                                  |  |
|  +------------------------------------------------------------+  |
+------------------------------------------------------------------+
```

---

## Component Migration Map <a id="component-migration-map"></a>

### Components to CREATE as Preact (.tsx)

| New Preact Component | Replaces | Location |
|---------------------|----------|----------|
| `HttpWorkbench.tsx` | Workbench internals | `src/components/workbench/` |
| `RequestBar.tsx` | `RequestBar.astro` | `src/components/request/` |
| `MethodSelector.tsx` | `MethodSelector.astro` | `src/components/request/` |
| `RequestConfigTabs.tsx` | `RequestConfigTabs.astro` | `src/components/request/` |
| `ParamsTable.tsx` | `ParamsTable.astro` | `src/components/request/` |
| `HeadersTable.tsx` | `HeadersTable.astro` | `src/components/request/` |
| `BodyEditor.tsx` | `BodyEditor.astro` | `src/components/request/` |
| `KeyValueTable.tsx` | `KeyValueTable.astro` + `KeyValueRow.astro` | `src/components/shared/` |
| `ResponsePanel.tsx` | `ResponsePanel.astro` | `src/components/response/` |
| `ResponseStatusBar.tsx` | `ResponseStatusBar.astro` | `src/components/response/` |
| `ResponseTabs.tsx` | `ResponseTabs.astro` | `src/components/response/` |
| `ResponseBody.tsx` | `ResponseBody.astro` | `src/components/response/` |
| `ResponseHeaders.tsx` | `ResponseHeaders.astro` | `src/components/response/` |
| `CodeViewer.tsx` | `CodeViewer.astro` | `src/components/shared/` |
| `Tabs.tsx` | Replaces `pm-tabs` Custom Element usage | `src/components/shared/` |
| `Dropdown.tsx` | Replaces `pm-dropdown` Custom Element usage | `src/components/shared/` |

### Components that STAY as Astro (.astro) -- No Changes

| Component | Reason |
|-----------|--------|
| `Layout.astro` | Pure layout, no interactivity |
| `AppLayout.astro` | Pure layout, no interactivity |
| `HeaderBar.astro` | Static, no data dependency |
| `SearchInput.astro` | Static for MVP |
| `WorkspaceSelector.astro` | Static for MVP |
| `FooterBar.astro` | Static, no data dependency |
| `Sidebar.astro` | Uses Custom Elements, out of MVP scope |
| `SidebarTabs.astro` | Uses Custom Elements, out of MVP scope |
| `CollectionTree.astro` | Out of scope (collections) |
| All sidebar sub-components | Out of scope |
| `TabBar.astro` | Static tab bar for MVP (single request) |
| `TabItem.astro` | Static for MVP |

### Components that STAY as Astro but get MODIFIED

| Component | Change |
|-----------|--------|
| `Workbench.astro` | Replace `<RequestPanel />` and `<ResponsePanel />` with `<HttpWorkbench client:load />` |

### Files to DELETE

| File | Reason |
|------|--------|
| `src/data/mock-request.ts` | Replace with empty initial state in signals |
| `src/data/mock-response.ts` | Replace with null initial state in signals |
| `src/data/mock-collections.ts` | Out of MVP scope, no longer imported |
| `src/data/mock-environments.ts` | Out of MVP scope, no longer imported |
| `src/data/mock-history.ts` | Out of MVP scope, no longer imported |

### Files to KEEP (Custom Elements)

| File | Reason |
|------|--------|
| `src/scripts/tabs.ts` | Still used by `SidebarTabs.astro`, `RequestConfigTabs.astro` if sidebar stays Astro |
| `src/scripts/dropdown.ts` | Still used by sidebar components and `AuthPanel.astro` |
| `src/scripts/tree.ts` | Still used by `CollectionTree.astro` |
| `src/scripts/sidebar.ts` | Still used by `Sidebar.astro` |

**Note**: The Astro versions of request/response components (e.g., `RequestBar.astro`, `ParamsTable.astro`) will no longer be imported by anything after `Workbench.astro` is updated. They can be deleted or kept for reference. The plan recommends **keeping them temporarily** and removing in a separate cleanup task after the MVP is verified working.

---

## Phase 1: Project Setup - Preact Integration <a id="phase-1"></a>

### Objective

Install and configure `@astrojs/preact` and `@preact/signals` so that `.tsx` Preact components can be used as Astro islands with `client:load`.

### Prerequisites

None. This is the first phase.

### Detailed Tasks

1. **Install dependencies with Bun**:
   - `bun add @astrojs/preact preact`
   - `bun add @preact/signals`

2. **Update `astro.config.mjs`** to register the Preact integration:

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

3. **Update `tsconfig.json`** to support JSX for Preact:

   ```json
   {
     "extends": "astro/tsconfigs/strict",
     "include": [".astro/types.d.ts", "**/*"],
     "exclude": ["dist"],
     "compilerOptions": {
       "jsx": "react-jsx",
       "jsxImportSource": "preact"
     }
   }
   ```

4. **Create a smoke-test Preact component** at `src/components/workbench/HttpWorkbench.tsx`:

   ```tsx
   export default function HttpWorkbench() {
     return <div class="text-pm-text-primary p-4">Preact island is working</div>;
   }
   ```

5. **Temporarily mount the smoke test** in `Workbench.astro` to verify the integration works:
   - Import `HttpWorkbench` and render with `client:load`
   - Run `bun dev` and verify the island renders
   - Run `bun astro check` and `bun build` to verify no TS/build errors

### Affected Files

- `astro.config.mjs` - modify (add preact integration)
- `tsconfig.json` - modify (add jsx/jsxImportSource)
- `package.json` - modify (new dependencies via bun add)
- `src/components/workbench/HttpWorkbench.tsx` - create (smoke test)
- `src/components/workbench/Workbench.astro` - modify temporarily (smoke test mount)

### Applied Best Practices

- **KISS**: Minimal config changes, verify before proceeding
- **Fail Fast**: Smoke test validates the integration immediately

### Completion Criteria

- [ ] `bun dev` starts without errors
- [ ] The smoke-test Preact island renders in the browser
- [ ] `bun astro check` passes with no errors
- [ ] `bun build` completes successfully

### Risks and Mitigations

- Risk: Tailwind CSS v4 classes not available in `.tsx` files -> Mitigation: Tailwind v4 with Vite plugin processes all files in the project; `.tsx` files are automatically included. Verify in smoke test that `text-pm-text-primary` class works.
- Risk: TypeScript JSX config conflicts -> Mitigation: Follow exact `tsconfig.json` from official `@astrojs/preact` docs (verified in research).

### Complexity Estimation

Low - Standard integration setup following official documentation.

---

## Phase 2: Type Definitions and Store Layer <a id="phase-2"></a>

### Objective

Define the TypeScript types for request/response state and create the Preact signals store that will be the single source of truth for the entire HTTP workbench island.

### Prerequisites

Phase 1 completed (Preact integration working).

### Detailed Tasks

1. **Create type definitions** at `src/types/http.ts`:

   Define the following types (derived from existing `mock-request.ts` types but cleaned up for MVP):

   ```ts
   export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

   export interface KeyValuePair {
     id: string;        // unique ID for list rendering keys
     key: string;
     value: string;
     description?: string;
     enabled: boolean;
   }

   export type BodyMode = "none" | "raw";
   export type ContentType = "json" | "text" | "xml" | "html";

   export interface RequestState {
     method: HttpMethod;
     url: string;
     params: KeyValuePair[];
     headers: KeyValuePair[];
     body: {
       mode: BodyMode;
       contentType: ContentType;
       raw: string;
     };
   }

   export interface ResponseState {
     status: number;
     statusText: string;
     headers: Array<{ key: string; value: string }>;
     body: string;
     contentType: string;
     time: number;    // ms
     size: number;    // bytes
   }

   export type RequestStatus = "idle" | "loading" | "success" | "error";

   export interface HttpError {
     message: string;
     type: "network" | "cors" | "timeout" | "abort" | "unknown";
   }
   ```

   **Design notes**:
   - `KeyValuePair.id` added for stable React/Preact list keys (use `crypto.randomUUID()`)
   - `HttpMethod` limited to 5 methods for MVP (HEAD/OPTIONS excluded as they are less common for manual testing)
   - `BodyMode` limited to "none" and "raw" for MVP (form-data, binary, etc. are post-MVP)
   - `ContentType` for the raw body sub-type selector
   - `HttpError.type` to provide user-friendly error messages, especially for CORS

2. **Create the signals store** at `src/stores/http-store.ts`:

   This module exports Preact signals that represent the entire application state for the HTTP workbench. Because signals are module-level singletons, they are shared across all components within the island.

   Define:
   - `requestState`: `signal<RequestState>` with default empty state (method: "GET", url: "", empty params/headers/body)
   - `responseState`: `signal<ResponseState | null>` initialized to `null`
   - `requestStatus`: `signal<RequestStatus>` initialized to `"idle"`
   - `requestError`: `signal<HttpError | null>` initialized to `null`

   Also define computed signals:
   - `enabledParams`: `computed()` that filters `requestState.value.params` to only `enabled: true` entries
   - `enabledHeaders`: `computed()` that filters `requestState.value.headers` to only `enabled: true` entries
   - `fullUrl`: `computed()` that builds the complete URL with query params appended from `enabledParams`
   - `formattedSize`: `computed()` that converts `responseState.value?.size` to human-readable string (B, KB, MB)
   - `statusColorClass`: `computed()` that returns the Tailwind class for the status code color

   Also define action functions (not signals, but plain functions that mutate signals):
   - `updateMethod(method: HttpMethod)`: updates `requestState.value.method`
   - `updateUrl(url: string)`: updates `requestState.value.url`, and also parses query params from URL into `params` array
   - `addParam()`, `updateParam(id, field, value)`, `removeParam(id)`, `toggleParam(id)`
   - `addHeader()`, `updateHeader(id, field, value)`, `removeHeader(id)`, `toggleHeader(id)`
   - `updateBodyMode(mode)`, `updateBodyContentType(contentType)`, `updateBodyRaw(raw)`
   - `resetResponse()`: sets `responseState` to null and `requestStatus` to "idle"

   **Important implementation detail**: Since signals use immutable-style updates, each action that modifies an array (params, headers) must create a new object reference:

   ```ts
   // Example pattern for updating nested state
   function addParam() {
     requestState.value = {
       ...requestState.value,
       params: [
         ...requestState.value.params,
         { id: crypto.randomUUID(), key: "", value: "", enabled: true }
       ]
     };
   }
   ```

3. **Create a helper** at `src/utils/url.ts`:
   - `parseQueryParams(url: string): KeyValuePair[]` -- extracts query params from a URL string
   - `buildUrlWithParams(baseUrl: string, params: KeyValuePair[]): string` -- constructs a URL with enabled params
   - `formatBytes(bytes: number): string` -- formats byte count to human-readable

### Affected Files

- `src/types/http.ts` - create
- `src/stores/http-store.ts` - create
- `src/utils/url.ts` - create

### Applied Best Practices

- **Single Responsibility (SRP)**: Types, store, and utilities each in their own file
- **Separation of Concerns**: Store logic separate from UI components
- **Type Safety**: Full TypeScript strict types for all state shapes
- **DRY**: Utility functions for URL parsing reused across components (URL bar updates params table, params table updates URL)

### Completion Criteria

- [ ] All types compile with `bun astro check`
- [ ] Store signals can be imported and read in the smoke-test component
- [ ] URL utility functions handle edge cases: no params, existing params, empty URL, malformed URL

### Risks and Mitigations

- Risk: URL bidirectional sync (URL bar <-> params table) creates infinite loops -> Mitigation: Use a flag or `batch()` to prevent re-entry. When updating URL from params, skip the "parse params from URL" step and vice versa. Document this clearly in code comments.
- Risk: `crypto.randomUUID()` not available in SSR context -> Mitigation: The store is only used client-side within the Preact island. SSR does not touch signals. If needed, use a simple counter-based ID generator as fallback.

### Complexity Estimation

Medium - Core data architecture that all subsequent phases depend on. URL bidirectional sync requires careful design.

---

## Phase 3: Request Panel Islands <a id="phase-3"></a>

### Objective

Create the Preact components for the request panel: method selector, URL input, Send button, and the tabbed configuration panels (params, headers, body).

### Prerequisites

Phase 2 completed (types and store defined).

### Detailed Tasks

1. **Create `src/components/shared/Dropdown.tsx`** -- Preact replacement for `pm-dropdown` Custom Element:
   - Accept props: `items: Array<{label: string, value: string, colorClass?: string}>`, `selected: string`, `onSelect: (value: string) => void`
   - Implement open/close state with `useSignal<boolean>(false)`
   - Port keyboard navigation from `dropdown.ts` (ArrowUp/Down, Enter, Escape, Home, End)
   - Close on outside click via `useEffect` with document click listener
   - Use same Tailwind classes as the existing `.astro` dropdown for visual consistency
   - ARIA: `role="listbox"`, `role="option"`, `aria-expanded`, `aria-selected`, `aria-haspopup`

2. **Create `src/components/shared/Tabs.tsx`** -- Preact replacement for `pm-tabs` Custom Element:
   - Accept props: `tabs: Array<{id: string, label: string, count?: number}>`, `activeTab: string`, `onTabChange: (id: string) => void`, `children: ComponentChildren`
   - Render tab buttons with active styling matching existing CSS
   - Use `data-panel` attribute pattern on children to show/hide panels (or use conditional rendering based on `activeTab`)
   - Port keyboard navigation from `tabs.ts` (ArrowLeft/Right, Home, End)
   - ARIA: `role="tablist"`, `role="tab"`, `role="tabpanel"`, `aria-selected`, `aria-controls`

3. **Create `src/components/request/MethodSelector.tsx`**:
   - Use the `Dropdown` component
   - Items: GET (blue), POST (green), PUT (orange), PATCH (teal), DELETE (red) -- using existing `pm-method-*` color classes
   - On select: call `updateMethod()` from store
   - Read current method from `requestState` signal

4. **Create `src/components/shared/KeyValueTable.tsx`**:
   - Replaces both `KeyValueTable.astro` and `KeyValueRow.astro`
   - Accept props: `items: Signal<KeyValuePair[]>` (or read directly from store), `showDescription: boolean`, action callbacks for add/update/remove/toggle
   - Each row: checkbox (toggle), key input, value input, optional description input, delete button
   - Last row: always show an empty "placeholder" row that auto-adds a new entry on focus/input
   - All inputs are controlled (value from signal, onChange updates signal)
   - Grid layout matching existing: `grid-cols-[auto_2fr_2fr_3fr]` (with description) or `grid-cols-[auto_1fr_1fr]` (without)

5. **Create `src/components/request/ParamsTable.tsx`**:
   - Thin wrapper around `KeyValueTable` that reads/writes `requestState.value.params`
   - Passes `showDescription={true}`
   - On any param change, trigger URL update (bidirectional sync)

6. **Create `src/components/request/HeadersTable.tsx`**:
   - Thin wrapper around `KeyValueTable` that reads/writes `requestState.value.headers`
   - Passes `showDescription={false}`

7. **Create `src/components/shared/CodeViewer.tsx`**:
   - Port the JSON syntax highlighting logic from `CodeViewer.astro`
   - Accept `code: string`, `language: string`
   - Use `useMemo` to memoize the highlighting computation
   - Render with `dangerouslySetInnerHTML` (Preact equivalent of `set:html`)

8. **Create `src/components/request/BodyEditor.tsx`**:
   - Body mode selector: radio buttons for "none" and "raw" (MVP scope)
   - When mode is "raw": show content type dropdown (JSON, Text, XML, HTML) and a `<textarea>` for editing
   - When mode is "none": show a message "This request does not have a body"
   - The textarea is controlled by `requestState.value.body.raw`
   - Use monospace font class `font-pm-mono`

9. **Create `src/components/request/RequestBar.tsx`**:
   - Compose `MethodSelector` + URL input + Send button horizontally
   - URL input: controlled by `requestState.value.url`, onChange calls `updateUrl()`
   - Send button: calls the `sendRequest()` action (defined in Phase 4)
   - During loading state (`requestStatus.value === "loading"`): disable Send button, show loading indicator (spinner or "Sending..." text), optionally show Cancel button

10. **Create `src/components/request/RequestConfigTabs.tsx`**:
    - Use the `Tabs` component with tabs: Params, Headers, Body
    - Params count from `requestState.value.params.filter(p => p.enabled).length`
    - Headers count from `requestState.value.headers.filter(h => h.enabled).length`
    - Each tab renders its respective panel component

11. **Create `src/components/request/RequestPanel.tsx`**:
    - Compose `RequestBar` + `RequestConfigTabs`
    - Simple container component

### Affected Files

- `src/components/shared/Dropdown.tsx` - create
- `src/components/shared/Tabs.tsx` - create
- `src/components/shared/KeyValueTable.tsx` - create
- `src/components/shared/CodeViewer.tsx` - create
- `src/components/request/MethodSelector.tsx` - create
- `src/components/request/ParamsTable.tsx` - create
- `src/components/request/HeadersTable.tsx` - create
- `src/components/request/BodyEditor.tsx` - create
- `src/components/request/RequestBar.tsx` - create
- `src/components/request/RequestConfigTabs.tsx` - create
- `src/components/request/RequestPanel.tsx` - create

### Applied Best Practices

- **Composition over Inheritance**: Each component is a small, composable function
- **Single Responsibility**: KeyValueTable handles table logic; ParamsTable/HeadersTable handle store binding
- **DRY**: Shared Dropdown, Tabs, KeyValueTable, CodeViewer reused across request and response panels
- **Accessibility**: Full keyboard navigation ported from Custom Elements, ARIA attributes preserved
- **Controlled Components**: All inputs derive value from signals, ensuring single source of truth

### Completion Criteria

- [ ] All request panel components render correctly with empty initial state
- [ ] Method selector changes method in the store
- [ ] URL input updates the store and syncs with params table bidirectionally
- [ ] Adding/editing/removing/toggling params and headers works
- [ ] Body editor switches between "none" and "raw" modes
- [ ] Tabs switch between Params, Headers, Body panels
- [ ] Keyboard navigation works on Dropdown and Tabs
- [ ] `bun astro check` passes
- [ ] Visual appearance matches existing static UI (same Tailwind classes)

### Risks and Mitigations

- Risk: Tailwind class names with `pm-` prefix might not be recognized in `.tsx` -> Mitigation: These are standard Tailwind utility classes generated from `@theme` tokens; they work in any file type. Verify in Phase 1 smoke test.
- Risk: `dangerouslySetInnerHTML` in CodeViewer creates XSS risk -> Mitigation: The highlighted HTML is generated from our own regex-based highlighter applied to the response body. For MVP this is acceptable since the user controls the input. Add a comment noting that a proper sanitizer should be used post-MVP.
- Risk: KeyValueTable performance with many rows -> Mitigation: MVP scope is manual entry (not hundreds of rows). No optimization needed yet.

### Complexity Estimation

High - Largest phase with 11 components. The KeyValueTable with bidirectional sync is the most complex piece.

---

## Phase 4: HTTP Engine (fetch Service) <a id="phase-4"></a>

### Objective

Implement the `sendRequest()` function that uses the browser's `fetch()` API to execute HTTP requests and populate the response signals.

### Prerequisites

Phase 2 completed (store with signals defined). Phase 3 is not strictly required but is recommended for testing.

### Detailed Tasks

1. **Create `src/services/http-client.ts`**:

   This module exports a single `sendRequest()` async function that:

   a. Reads current state from `requestState` signal
   b. Sets `requestStatus.value = "loading"` and `responseState.value = null`
   c. Builds the full URL from `fullUrl` computed signal
   d. Constructs the `fetch()` options:
      - `method`: from `requestState.value.method`
      - `headers`: from enabled headers in `requestState.value.headers`, converted to `Headers` object
      - `body`: only for POST/PUT/PATCH/DELETE -- from `requestState.value.body.raw` when mode is "raw". Set appropriate Content-Type header based on `contentType` setting.
      - Do NOT set `mode: "cors"` or `credentials` -- use browser defaults
   e. Records `performance.now()` before and after the fetch for timing
   f. Awaits the response and extracts:
      - `status` and `statusText`
      - `headers` iterated via `response.headers.forEach()`
      - `body` via `response.text()` (always read as text; JSON pretty-printing handled in display)
      - `size` from `Content-Length` header or fallback to `new Blob([bodyText]).size`
      - `time` from the performance timing delta
   g. Sets `responseState.value` with the extracted data
   h. Sets `requestStatus.value = "success"`
   i. Error handling:
      - `TypeError` from fetch (network errors, CORS) -> set `requestError` with type "network" or "cors" (detect CORS by checking if error message contains "CORS" or if response is opaque)
      - `AbortError` -> set `requestError` with type "abort"
      - General errors -> set `requestError` with type "unknown"
      - Always set `requestStatus.value = "error"` on failure

2. **Add abort support**:
   - Create a module-level `AbortController` signal or variable
   - Before each new request, abort any in-flight request
   - Expose a `cancelRequest()` function
   - Wire into the Send button's Cancel state

3. **Add Content-Type auto-header logic**:
   - When body mode is "raw" and content type is "json", automatically include `Content-Type: application/json` if not already in the user's headers
   - When body mode is "none", do not send a body even for POST/PUT/PATCH
   - This logic lives in `http-client.ts`, not in the components

4. **CORS documentation**:
   - Add a clear comment block at the top of `http-client.ts` explaining CORS limitations
   - When a CORS error is detected, the error message shown to the user should suggest:
     - Ensuring the target API supports CORS
     - Using a CORS proxy (future feature)
     - Testing with APIs that allow CORS (e.g., httpbin.org, jsonplaceholder.typicode.com)

### Affected Files

- `src/services/http-client.ts` - create

### Applied Best Practices

- **Separation of Concerns**: HTTP logic is in a service, not in components
- **Fail Fast**: Validate URL before attempting fetch (basic URL validation)
- **Error Handling**: Comprehensive error categorization for user-friendly messages
- **Single Responsibility**: `sendRequest` handles HTTP; display logic is in components

### Completion Criteria

- [ ] GET request to `https://jsonplaceholder.typicode.com/todos/1` returns real data
- [ ] POST request with JSON body works
- [ ] Response timing is accurate (within ~50ms of actual)
- [ ] Response size is calculated correctly
- [ ] Network errors produce meaningful error state
- [ ] CORS errors are detected and produce a helpful message
- [ ] In-flight request can be cancelled
- [ ] Sending a new request while one is in-flight cancels the previous one

### Risks and Mitigations

- Risk: CORS blocks most real API calls -> Mitigation: This is a known browser limitation. Document it clearly. Suggest test APIs in the UI (placeholder text in URL input). A CORS proxy feature is post-MVP.
- Risk: Large response bodies cause performance issues -> Mitigation: For MVP, read as text. If body exceeds a threshold (e.g., 5MB), truncate and show a message. Streaming is post-MVP.
- Risk: `response.headers.forEach()` may not expose all headers due to CORS -> Mitigation: Document that only CORS-safelisted headers are visible unless the server sends `Access-Control-Expose-Headers`. This is a browser limitation, not a bug.

### Complexity Estimation

Medium - Straightforward fetch wrapper, but error handling and edge cases require care.

---

## Phase 5: Response Panel Islands <a id="phase-5"></a>

### Objective

Create the Preact components for the response panel that display real response data (or empty/loading/error states).

### Prerequisites

Phase 2 completed (store with response signals). Phase 4 recommended for end-to-end testing.

### Detailed Tasks

1. **Create `src/components/response/ResponseStatusBar.tsx`**:
   - Read from `responseState` signal
   - Display: status code + statusText, time (ms), size (formatted)
   - Status color: green for 2xx, orange for 3xx, red for 4xx/5xx (using existing `pm-status-*` classes)
   - When `responseState` is null: don't render (or show empty bar)

2. **Create `src/components/response/ResponseBody.tsx`**:
   - Read body from `responseState.value.body`
   - If content type is JSON: attempt `JSON.parse` + `JSON.stringify(parsed, null, 2)` for pretty-printing, then apply syntax highlighting via `CodeViewer`
   - If not JSON: display as plain text in `CodeViewer` with language "text"
   - View mode toggle: "Pretty" (formatted + highlighted), "Raw" (unformatted text)
   - Copy button: use `navigator.clipboard.writeText()`

3. **Create `src/components/response/ResponseHeaders.tsx`**:
   - Read headers from `responseState.value.headers`
   - Display as key-value table (read-only, no checkboxes or editing)
   - Same grid layout as current: two columns, key and value

4. **Create `src/components/response/ResponseTabs.tsx`**:
   - Use the shared `Tabs` component
   - Tabs: "Body", "Headers" (for MVP; Cookies and Test Results are out of scope)
   - Renders `ResponseBody` and `ResponseHeaders` in respective panels

5. **Create `src/components/response/ResponsePanel.tsx`**:
   - Compose `ResponseStatusBar` + `ResponseTabs`
   - Handle multiple states:
     - **Idle** (`requestStatus === "idle"` and `responseState === null`): Show an empty state with a message like "Enter a URL and click Send to get a response" and optionally a subtle illustration or icon
     - **Loading** (`requestStatus === "loading"`): Show a loading indicator (spinner + "Sending request...")
     - **Success** (`requestStatus === "success"`): Show status bar + tabs with response data
     - **Error** (`requestStatus === "error"`): Show error message with type-specific guidance (especially for CORS errors)

6. **Define empty/loading/error state UI patterns**:
   - Empty state: centered text, muted color (`text-pm-text-tertiary`), use existing icon assets if suitable
   - Loading state: simple CSS spinner (no additional library), centered
   - Error state: red-tinted message with the error type and actionable guidance

### Affected Files

- `src/components/response/ResponseStatusBar.tsx` - create
- `src/components/response/ResponseBody.tsx` - create
- `src/components/response/ResponseHeaders.tsx` - create
- `src/components/response/ResponseTabs.tsx` - create
- `src/components/response/ResponsePanel.tsx` - create

### Applied Best Practices

- **Defensive Programming**: JSON.parse wrapped in try/catch; fallback to raw text display
- **User Experience**: Clear state indicators (idle, loading, success, error) with actionable messages
- **Accessibility**: Loading state announced to screen readers (aria-live or aria-busy)
- **Performance**: Pretty-printing and highlighting memoized to avoid re-computation on tab switches

### Completion Criteria

- [ ] Empty state displays when no request has been sent
- [ ] Loading state displays while request is in flight
- [ ] Success state shows status bar with correct status, time, and size
- [ ] Response body shows pretty-printed JSON with syntax highlighting
- [ ] Response body shows raw text when "Raw" view is selected
- [ ] Response headers display in key-value table
- [ ] Error state shows helpful message for CORS errors
- [ ] Copy button works for response body
- [ ] `bun astro check` passes

### Risks and Mitigations

- Risk: Very large JSON bodies cause slow pretty-printing -> Mitigation: If body exceeds 100KB, skip pretty-printing and show raw text with a message. Virtualized rendering is post-MVP.
- Risk: Non-JSON content types (HTML, XML) have no syntax highlighting -> Mitigation: For MVP, show as plain text. Syntax highlighting for other formats is post-MVP.

### Complexity Estimation

Medium - Mostly display components. JSON pretty-printing and state management are the complex parts.

---

## Phase 6: Wire Up Send Flow and Clean Up Mocks <a id="phase-6"></a>

### Objective

Assemble the full `HttpWorkbench` island, wire the Send button to the HTTP engine, integrate request and response panels, update `Workbench.astro`, and remove all mock data.

### Prerequisites

Phases 1-5 completed.

### Detailed Tasks

1. **Create the final `src/components/workbench/HttpWorkbench.tsx`** (replace smoke test):
   - Import and compose `RequestPanel` + `ResponsePanel`
   - Include a visual resize handle between panels (static for MVP, non-functional)
   - Layout: flex column with both panels taking flex-1
   - This is the single Preact island entry point

2. **Update `src/components/workbench/Workbench.astro`**:
   - Remove imports of `RequestPanel.astro` and `ResponsePanel.astro`
   - Import `HttpWorkbench` from `./HttpWorkbench.tsx`
   - Replace the request/response panel section with:

     ```astro
     <HttpWorkbench client:load />
     ```

   - Keep `TabBar` as Astro (static for MVP)
   - Keep the resize handle in the Astro shell or move it into `HttpWorkbench`

3. **Delete mock data files**:
   - `src/data/mock-request.ts`
   - `src/data/mock-response.ts`
   - `src/data/mock-collections.ts`
   - `src/data/mock-environments.ts`
   - `src/data/mock-history.ts`

4. **Update sidebar components that import mock data**:
   - Components like `CollectionTree.astro`, `HistoryList.astro`, `EnvironmentList.astro` import from `src/data/` files
   - Replace their content with empty-state placeholders (e.g., "No collections yet")
   - This keeps the sidebar rendering without errors while removing mock data

5. **Update remaining Astro components that imported mock data**:
   - `AuthPanel.astro`: Remove hardcoded token value, show empty state (out of MVP scope but must not error)
   - `PreRequestPanel.astro`, `TestsPanel.astro`, `SettingsPanel.astro`: These are no longer rendered in the Preact island. If they are still referenced from old Astro components, remove those references.
   - `TabItem.astro` / `TabBar.astro`: Remove hardcoded tab names. Show a single "New Request" tab or empty state.

6. **Verify the complete flow**:
   - Start dev server
   - Default state: empty request, no response
   - Enter `https://jsonplaceholder.typicode.com/todos/1`, method GET, click Send
   - Response panel shows: status 200 OK, timing, size, JSON body, headers
   - Change to POST, add a JSON body, send to `https://jsonplaceholder.typicode.com/posts`
   - Verify response

7. **Remove the old `.astro` request/response component files** that are no longer imported:
   - `src/components/request/RequestBar.astro`
   - `src/components/request/MethodSelector.astro`
   - `src/components/request/RequestConfigTabs.astro`
   - `src/components/request/RequestPanel.astro`
   - `src/components/request/ParamsTable.astro`
   - `src/components/request/HeadersTable.astro`
   - `src/components/request/BodyEditor.astro`
   - `src/components/response/ResponsePanel.astro`
   - `src/components/response/ResponseStatusBar.astro`
   - `src/components/response/ResponseBody.astro`
   - `src/components/response/ResponseHeaders.astro`
   - `src/components/response/ResponseCookies.astro`
   - `src/components/response/ResponseTabs.astro`
   - `src/components/response/ResponseTestResults.astro`
   - `src/components/shared/KeyValueTable.astro`
   - `src/components/shared/KeyValueRow.astro`
   - `src/components/shared/CodeViewer.astro`

   **Note**: Keep `Badge.astro`, `IconButton.astro`, `Toggle.astro`, `Tooltip.astro` as they may still be used by sidebar or other static components.

### Affected Files

- `src/components/workbench/HttpWorkbench.tsx` - modify (replace smoke test with final)
- `src/components/workbench/Workbench.astro` - modify (mount Preact island)
- `src/data/mock-*.ts` (5 files) - delete
- `src/components/sidebar/CollectionTree.astro` - modify (empty state)
- `src/components/sidebar/HistoryList.astro` - modify (empty state)
- `src/components/sidebar/EnvironmentList.astro` - modify (empty state)
- `src/components/sidebar/CollectionItem.astro` - may be unused after removing mock data
- `src/components/sidebar/FolderItem.astro` - may be unused after removing mock data
- `src/components/sidebar/RequestItem.astro` - may be unused after removing mock data
- `src/components/sidebar/HistoryItem.astro` - may be unused after removing mock data
- `src/components/sidebar/EnvironmentItem.astro` - may be unused after removing mock data
- `src/components/request/AuthPanel.astro` - modify (remove hardcoded data)
- `src/components/workbench/TabBar.astro` - modify (remove hardcoded tabs)
- `src/components/workbench/TabItem.astro` - no change, props-driven
- 17 `.astro` files - delete (replaced by Preact components)

### Applied Best Practices

- **YAGNI**: Only delete files that are confirmed unused; keep sidebar sub-components if referenced
- **Fail Fast**: Verify complete flow immediately after wiring
- **Clean Code**: Remove dead code and unused files to prevent confusion

### Completion Criteria

- [ ] HttpWorkbench island renders inside Workbench.astro
- [ ] Send button triggers real fetch and populates response panel
- [ ] All 5 mock data files deleted
- [ ] Sidebar displays empty states without errors
- [ ] No TypeScript import errors (`bun astro check` clean)
- [ ] `bun build` succeeds
- [ ] No references to deleted mock files remain in the codebase

### Risks and Mitigations

- Risk: Deleting files breaks imports in unexpected places -> Mitigation: Use grep/search for all imports of `mock-` and each deleted `.astro` component before deleting. Fix all references first.
- Risk: Sidebar components depend on types from `mock-collections.ts` (e.g., `HttpMethod` type) -> Mitigation: The `HttpMethod` type is moved to `src/types/http.ts` in Phase 2. Update any remaining Astro component imports to use the new location.

### Complexity Estimation

Medium - Mostly wiring and cleanup, but the number of file changes is large and requires careful verification.

---

## Phase 7: Verification and Polish <a id="phase-7"></a>

### Objective

End-to-end testing, visual QA, accessibility verification, and performance check.

### Prerequisites

Phase 6 completed.

### Detailed Tasks

1. **Functional testing** (manual):
   - GET request to `https://jsonplaceholder.typicode.com/todos/1`
   - POST request to `https://jsonplaceholder.typicode.com/posts` with JSON body
   - PUT request to `https://jsonplaceholder.typicode.com/posts/1` with JSON body
   - PATCH request to `https://jsonplaceholder.typicode.com/posts/1` with partial JSON
   - DELETE request to `https://jsonplaceholder.typicode.com/posts/1`
   - Test with invalid URL (should show network error)
   - Test with CORS-blocking URL (should show CORS error message)
   - Test Cancel while request is in-flight
   - Test rapid Send clicks (should cancel previous and send new)

2. **URL-Params bidirectional sync testing**:
   - Type URL with query params -> params table populates
   - Add params in table -> URL updates
   - Toggle param off -> URL updates (param removed)
   - Edit param key/value -> URL updates

3. **Visual QA**:
   - Compare Preact components against the original Astro components
   - Verify all `pm-*` color tokens render correctly
   - Verify responsive layout works (mobile, tablet, desktop)
   - Verify dark theme consistency

4. **Accessibility testing**:
   - Tab through all interactive elements in order
   - Verify keyboard navigation on Dropdown and Tabs components
   - Verify screen reader announces loading/error states
   - Verify all inputs have labels (aria-label)

5. **Build verification**:
   - `bun astro check` -- zero errors
   - `bun build` -- succeeds
   - `bun preview` -- app works in production build
   - Check bundle size: Preact + signals should add ~7-10KB gzipped

6. **Polish**:
   - URL input placeholder: "Enter a URL (e.g., <https://jsonplaceholder.typicode.com/todos/1>)"
   - Empty response state: friendly message with suggested test URL
   - Loading spinner: simple CSS-only animation
   - Error messages: clear, actionable, non-technical for CORS

### Affected Files

- Various `.tsx` files may need minor tweaks based on QA findings

### Applied Best Practices

- **Quality Assurance**: Systematic testing of all user flows
- **Accessibility**: WCAG 2.1 AA compliance check
- **Performance**: Bundle size awareness for a primarily static site

### Completion Criteria

- [ ] All 5 HTTP methods tested successfully with real APIs
- [ ] Error states tested and display helpful messages
- [ ] URL-params sync works bidirectionally
- [ ] Visual appearance consistent with original static UI
- [ ] Keyboard navigation functional on all interactive elements
- [ ] `bun astro check` passes with zero errors
- [ ] `bun build` succeeds
- [ ] `bun preview` serves a working application
- [ ] No console errors in browser DevTools

### Risks and Mitigations

- Risk: Visual regressions from Astro -> Preact migration -> Mitigation: Use same Tailwind classes and compare screenshots. Most styling is utility-class based, so differences should be minimal.

### Complexity Estimation

Low - Testing and polish phase, no new architecture.

---

## Summary

| Phase | Description | Complexity | Files Created | Files Modified | Files Deleted |
|-------|-------------|------------|---------------|----------------|---------------|
| 1 | Project Setup - Preact Integration | Low | 1 | 3 | 0 |
| 2 | Type Definitions and Store Layer | Medium | 3 | 0 | 0 |
| 3 | Request Panel Islands | High | 11 | 0 | 0 |
| 4 | HTTP Engine (fetch Service) | Medium | 1 | 0 | 0 |
| 5 | Response Panel Islands | Medium | 5 | 0 | 0 |
| 6 | Wire Up and Clean Up | Medium | 0 | ~10 | ~22 |
| 7 | Verification and Polish | Low | 0 | ~5 | 0 |
| **Total** | | | **21** | **~18** | **~22** |

### Dependency Graph

```text
Phase 1 (Setup)
    |
    v
Phase 2 (Types + Store)
    |
    +-------+-------+
    |               |
    v               v
Phase 3          Phase 4
(Request UI)    (HTTP Engine)
    |               |
    v               |
Phase 5          <--+
(Response UI)
    |
    v
Phase 6 (Wire Up + Cleanup)
    |
    v
Phase 7 (Verification)
```

Phases 3 and 4 can be developed in parallel since they share only the store layer (Phase 2). Phase 5 depends conceptually on Phase 4 for end-to-end testing but can be built using mocked signal values.

### CORS Limitation Notice

The MVP HTTP client will face CORS restrictions when making requests from the browser to APIs that do not include `Access-Control-Allow-Origin` headers. This is an inherent browser security limitation, not a bug. Future versions can address this with:

- A local proxy server (Astro SSR API route that forwards requests)
- Integration with a CORS proxy service
- A browser extension that disables CORS for development

For the MVP, the application works correctly with CORS-enabled APIs (jsonplaceholder, httpbin, any API with permissive CORS headers).
