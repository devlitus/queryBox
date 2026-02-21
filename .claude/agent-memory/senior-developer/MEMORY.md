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
