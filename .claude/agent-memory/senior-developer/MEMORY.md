# Senior Developer Agent Memory - queryBox

## Project Architecture

- **Stack**: Astro 5 + Preact islands + Tailwind CSS v4 (with `@tailwindcss/vite`) + TypeScript strict
- **Package manager**: Bun only (`bun run build`, `bun astro check`)
- **Build command**: `bun run build` (NOT `bun build` — that's Bun's native bundler, wrong tool)
- **Type check**: `bun astro check`

## Key File Locations

- Types: `src/types/http.ts`
- Signals store: `src/stores/http-store.ts`
- URL utilities: `src/utils/url.ts`
- HTTP service: `src/services/http-client.ts`
- Preact island entry: `src/components/workbench/HttpWorkbench.tsx`
- Theme tokens: `src/styles/global.css` (pm-* CSS custom properties via `@theme`)
- Static shell: `src/layouts/`, `src/components/header/`, `src/components/footer/`, `src/components/sidebar/`

## Preact Integration Patterns

- `useSignal` is from `@preact/signals`, NOT `preact/hooks`
- `useEffect`, `useRef`, `useMemo` are from `preact/hooks`
- Module-level signals (from `@preact/signals`) are shared across the island
- `client:load` directive for immediate hydration
- `tsconfig.json` requires `"jsx": "react-jsx"` and `"jsxImportSource": "preact"`

## Tailwind CSS v4 Patterns

- Theme tokens defined via `@theme` block in `src/styles/global.css`
- Custom tokens: `pm-bg-*`, `pm-border*`, `pm-text-*`, `pm-accent`, `pm-method-*`, `pm-status-*`, `pm-syntax-*`, `font-pm-sans`, `font-pm-mono`
- v4 processes all file types automatically via Vite plugin — no special config needed for `.tsx`
- CSS warning `[file:line]` during build is a pre-existing toolchain issue, not our code

## Coding Conventions

- Preact components use `class` (not `className`) for JSX attributes
- Signal mutations always create new object references (spread pattern)
- `batch()` from `@preact/signals` used when updating multiple signals at once
- Inline SVG icons used throughout (not icon library)
- All inputs are controlled components reading from signals

## Local Persistence Pattern (added feature/local-persistence)

- Storage layer: `src/services/storage.ts` — thin wrapper around localStorage with type guards and graceful degradation
- Keys: `qb:history`, `qb:collections`, `qb:workbench`
- New stores: `src/stores/history-store.ts`, `src/stores/collection-store.ts`, `src/stores/ui-store.ts`
- `effect()` from `@preact/signals` used ONLY for workbench auto-persist (many mutation paths); history/collections use explicit persist calls per mutation
- Sidebar islands use `client:idle` (not `client:load`) — sidebar content is non-critical, defer hydration
- `structuredClone(state)` used to snapshot RequestState before saving to history/collections
- `loadRequest()` in http-store regenerates all KeyValuePair IDs to prevent key collisions
- SaveToCollectionModal: uses `useState` for local form state, reads `collections` signal for select options
- MethodBadge.tsx: shared Preact component at `src/components/shared/MethodBadge.tsx` — replicates Badge.astro styling for use inside .tsx islands

## Tab Store Architecture (added feature/add-requests)

- Tab store: `src/stores/tab-store.ts` — `tabs` signal (Tab[]), `activeTabId` signal, `activeTab` computed
- Tab type: `src/types/http.ts` — `Tab` interface (id, name, request, response, requestStatus, requestError, isDirty)
- http-store signals are now `computed` proxies from `activeTab` (ReadonlySignal) — cannot assign to `.value`
- All http-store action functions delegate writes to `updateActiveTabRequest`/`updateActiveTabResponse` in tab-store
- http-client.ts uses `updateActiveTabResponse` (not direct signal assignment) for all response state writes
- Tab persistence keys: `qb:tabs`, `qb:active-tab` (legacy `qb:workbench` migrated on first load then removed)
- Responses are NOT persisted — ephemeral. Tabs are restored with `response: null`, `requestStatus: "idle"` on load
- `shouldFocusUrl` signal in ui-store triggers RequestBar to focus URL input when new tab is created
- Tab name auto-updates to URL hostname after first successful request if name is still "New Request"
- TabBar.tsx and TabBarItem.tsx are Preact islands at `src/components/workbench/`
- Middle-click (button===1) on TabBarItem closes the tab
- `vi.doMock()` (NOT `vi.mock`) must be used inside tests that reference local variables in their factory — `vi.mock` is hoisted and cannot access variables defined later in the test body

## Environment Variables Feature (added feature/environment-variables)

- Types: `src/types/environment.ts` — `EnvironmentVariable` and `Environment` interfaces
- Interpolation utilities: `src/utils/interpolation.ts` — `interpolateVariables`, `extractVariableNames`, `hasVariables`, `interpolateRequest`
- Store: `src/stores/environment-store.ts` — signals `environments`, `activeEnvironmentId`; computed `activeEnvironment`, `activeVariablesMap` (Map<string,string>)
- Storage keys: `qb:environments`, `qb:active-environment` (null stored by removing the key)
- http-client.ts reads `activeVariablesMap.value` — fast path when `variables.size > 0`; history stores UNRESOLVED (template) URL and state
- UI: `EnvironmentSelector.tsx` (header, `client:load`), `EnvironmentPanel.tsx` (sidebar, `client:idle`), `VariableIndicator.tsx` (shared)
- `setActiveEnvironmentId(null)` calls `removeItem()` — not `setItem(null)` — to clear the key
- Regex `/\{\{([^}]+)\}\}/g` requires at least one non-`}` character between braces; `{{}}` does NOT match
- VariableIndicator tooltip uses CSS `group-hover/indicator` named group variant for Tailwind
- `Dropdown.tsx` accepts optional `icon?: string` prop (raw SVG string); rendered via `dangerouslySetInnerHTML` before the label `<span>`
- SVG `?raw` imports in `.tsx` files: pass raw string to `dangerouslySetInnerHTML={{ __html: svgString }}` on a container `<span>`; `.astro` files use `<Fragment set:html={svgRaw} />`
- VariableIndicator must check `activeEnvironmentId.value !== null` AND `hasVariables(url)` — indicator must be hidden when no env is active

## Sidebar Resize Handle (added feature/environment-variables Phase 8)

- Custom Element: `src/scripts/sidebar-resize.ts` — `PmSidebarResize` class, same pattern as `PmSidebarToggle`
- Storage key: `qb:sidebar-width` — raw localStorage (NOT via StorageService, consistent with `sidebar-collapsed` key)
- Constants: `MIN_WIDTH=180`, `MAX_WIDTH=600`, `DEFAULT_WIDTH=320` (px)
- Pointer Events API: `setPointerCapture` / `releasePointerCapture` for unified mouse+touch drag
- `pointerdown`/`pointermove`/`pointerup` registered on the element itself (not document)
- `data-resizing` attribute on `<aside>` disables CSS transition during drag (prevents lag)
- `document.body.classList.add("select-none")` prevents text selection during drag
- `w-80` class REMOVED from `<aside>` in Sidebar.astro — width controlled by inline style from Custom Element
- `relative` class ADDED to `<aside>` to contain the absolute-positioned handle
- CSS rules in `global.css`: `pm-sidebar-resize` transition, hover highlight, `aside[data-resizing]` transition:none + user-select:none
- `aside.collapsed { width: 0 !important }` already overrides inline style — collapse/expand works without changes to sidebar.ts
- Script import: `<script>import "../../scripts/sidebar-resize.ts";</script>` inside Sidebar.astro

## Testing Infrastructure (added feature/test-runner)

- Test runner: Vitest v4 + happy-dom, configured via `vitest.config.ts` using `getViteConfig()` from `astro/config`
- Coverage provider: `@vitest/coverage-v8` (must install separately: `bun add -d @vitest/coverage-v8`)
- Test scripts: `bun run test`, `bun run test:watch`, `bun run test:coverage`
- CRITICAL: `bun test` invokes Bun's native runner, NOT Vitest — always use `bun run test`
- `bunfig.toml` has NO mechanism to redirect `bun test` to a package.json script; only documentation workaround exists
- Global setup: `src/test/setup.ts` — `afterEach(() => localStorage.clear())`
- Shared factories: `src/test/factories.ts` — `makeRequestState`, `makeHistoryEntry`, `makeCollection`, `makeSavedRequest`, `makeKeyValuePair`
- Store test pattern: `vi.resetModules()` + dynamic `import()` in `beforeEach` to reset module-level signals
- http-store mock pattern: `vi.mock("../services/storage", ...)` to suppress `effect()` auto-persist side effects
- Coverage exclusions in `vitest.config.ts`: `http-client.ts` and `ui-store.ts` excluded (LOW priority files)
- `tsconfig.json` has `"types": ["vitest/globals"]` for global `describe/it/expect` without imports

## Authentication System (added feature/auth-system)

- Types: `src/types/auth.ts` — `AuthType`, `BasicAuthConfig`, `BearerTokenConfig`, `ApiKeyConfig`, `AuthConfig` (discriminated union), `DEFAULT_AUTH`
- Utilities: `src/utils/auth.ts` — `resolveAuthHeaders(auth): ResolvedAuth` (pure function, returns `{ headers, params }`)
- Unicode-safe base64: `TextEncoder` + `btoa(String.fromCharCode(...bytes))` — NOT plain `btoa()` which fails on non-Latin1
- `RequestState` now includes `auth: AuthConfig` field (added to `src/types/http.ts`)
- Store actions in `src/stores/http-store.ts`: `updateAuthType`, `updateBasicAuth`, `updateBearerToken`, `updateApiKey`
- `updateAuthType` reinitializes the full config for the new type (prevents state residue between types)
- Migration guard in `tab-store.ts` `initializeTabs()`: `auth: t.request.auth ?? DEFAULT_AUTH`
- `loadRequest()` in `http-store.ts` also applies `auth: snapshot.auth ?? DEFAULT_AUTH` fallback
- `interpolateRequest()` now calls `interpolateAuth()` — interpolates basic.username/password, bearer.token, apikey.key/value; does NOT interpolate bearer.prefix
- UI: `src/components/request/AuthEditor.tsx` — inline sub-components (NoAuthPanel, BasicAuthPanel, BearerTokenPanel, ApiKeyPanel); uses `Dropdown` + `VariableIndicator`
- VariableIndicator in AuthEditor requires `activeEnvironmentId.value !== null` guard (pattern from EnvironmentPanel)
- `RequestConfigTabs.tsx` updated: TAB_IDS now includes "auth"; AuthEditor rendered as 4th tabpanel
- `http-client.ts`: `resolveAuthHeaders()` called after interpolation; auth headers added BEFORE user headers (user headers take precedence); API Key query params injected into URL via `searchParams.set()`
- `makeRequestState()` factory now includes `auth: DEFAULT_AUTH`; new `makeAuthConfig()` factory in `src/test/factories.ts`
- Cast pattern for testing legacy snapshots without auth field: `legacyObj as unknown as RequestState`

## Code Snippet Generator (added feature/code-snippet-generator)

- Types: `src/types/snippet.ts` — `SnippetLanguage` union, `SnippetOption` interface, `SNIPPET_OPTIONS` readonly array
- Generators: `src/utils/snippet-generators.ts` — `generateCurl`, `generateJavaScriptFetch`, `generatePythonRequests`, `generateNodeAxios`, `generateSnippet` (dispatcher)
- UI signal: `showCodeSnippetModal` in `src/stores/ui-store.ts` (same pattern as `showSaveModal`)
- Modal: `src/components/workbench/CodeSnippetModal.tsx` — follows SaveToCollectionModal pattern (overlay, focus restore, Escape to close)
- Button: in `RequestBar.tsx` between Save and Send/Cancel group; disabled when URL is empty
- Python basic auth uses `auth=('user', 'pass')` tuple (NOT Authorization header) — unique Python pattern
- URL normalization: `buildUrlWithParams` adds trailing slash to root-level URLs (`https://api.example.com` → `https://api.example.com/`) — test with `toContain` not exact match
- Test pattern: `toContain()` for partial string assertions, avoid `toBe()` for full snippet strings (fragile)
- `interpolateVars` toggle only shown when `activeEnvironmentId.value !== null` (same guard as VariableIndicator)
- `buildFinalUrl` and `buildHeaders` accept `ResolvedAuth` as second param — each generator calls `resolveAuthHeaders` once and passes result to both helpers (avoids double call)
- `escapeTemplateLiteral(str)` helper in snippet-generators.ts: escapes `\`, backticks, and `${` for safe embedding in JS template literals
- `snippet` and `processedRequest` in CodeSnippetModal are declared BEFORE `handleCopy` (not after the early return) to avoid TDZ reference errors

## Collections Import/Export (added feature/collections-import-export)

- Types: `src/types/export.ts` — `ExportEnvelope<T>`, `CollectionExport`, `EnvironmentExport`, `ExportFile`, `ImportStrategy`
- Utilities: `src/utils/export-import.ts` — `exportCollections`, `exportEnvironments`, `downloadJson`, `parseImportFile`, `readFileAsText`
- `isCollection` and `isEnvironment` exported from `src/services/storage.ts` as named exports (previously private)
- Store functions: `importCollections(imported, strategy)` in collection-store, `importEnvironments(imported, strategy)` in environment-store
- Both import functions regenerate ALL IDs (collection/env + nested requests/variables) via `crypto.randomUUID()` — prevents conflicts regardless of strategy
- `importEnvironments` replace strategy resets `activeEnvironmentId` to null if the active env is removed
- Merge strategy uses case-insensitive name comparison — deduplicates across existing AND within the imported array itself (Set tracks names as we iterate)
- UI signal: `showImportModal: Signal<ImportModalState | null>` and `ImportModalState = { target: "collections" | "environments" }` in ui-store.ts
- `ImportModal.tsx` at `src/components/shared/ImportModal.tsx` — single reusable modal parametrized by `target`
- Cross-type validation: if file.type !== target, shows error "This file contains X, but you are importing Y"
- Modal state resets on open (useEffect watching `isOpen`) — selectedFile, parseResult, parseError, strategy all reset
- File parsing runs immediately on file selection (async `readFileAsText` + `parseImportFile`)
- Tests for import utilities: `src/utils/__tests__/export-import.test.ts` (28 tests — includes DOM-based tests for `downloadJson` and `readFileAsText`)
- Tests for store imports: `src/stores/__tests__/collection-store-import.test.ts` (15 tests), `src/stores/__tests__/environment-store-import.test.ts` (18 tests)
- DOM API mocking in Vitest (happy-dom): `URL.createObjectURL`/`revokeObjectURL` → `vi.spyOn(URL, ...)`. `FileReader` error simulation → must use `class` syntax (NOT `vi.fn()`) so it can be called with `new`
- `vi.fn().mockImplementation(arrow)` cannot be used with `new` — Vitest warns and it fails. Use `class MockName { ... }` for constructors
- Test files in `__tests__/` subdirectories work fine — vitest config uses `src/**/*.{test,spec}.{ts,tsx}`
- Buttons in panel headers use `gap-0.5` between them; Export button has `disabled` + `opacity-50` when no data
- ImportModal mounted inside each panel with conditional: `{showImportModal.value?.target === "collections" && <ImportModal />}`
