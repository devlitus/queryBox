# Planner Agent Memory - queryBox

## Project Stack (verified 2026-02-19)
- Astro 5.17.1, Tailwind CSS 4.1.18 (v4), Bun, TypeScript strict
- Tailwind v4 uses `@import "tailwindcss"` + `@theme` directive in CSS (NO tailwind.config.js)
- `@theme { --color-name: value; }` generates utility classes like `bg-name`, `text-name`
- Preact + @preact/signals installed and configured (added in http-client feature)

## Project Structure (verified 2026-02-19)
- Components: header/, request/, response/, shared/, sidebar/, workbench/
- 5 Custom Elements: tabs.ts, dropdown.ts, tree.ts, sidebar.ts, sidebar-resize.ts in src/scripts/
- 5 mock data files: src/data/mock-{collections,environments,history,request,response}.ts
- Layouts: Layout.astro (base HTML) + AppLayout.astro (grid shell)
- Design tokens: pm-* namespace (pm-bg-*, pm-text-*, pm-method-*, pm-status-*, pm-syntax-*)
- 19 .astro components reference mock data files

## Key Technical Decisions

### Postman Clone (Phase 1 - Static UI) - COMPLETED
- Custom Elements for interactivity (tabs, dropdown, tree, sidebar)
- Design tokens via @theme, Google Fonts CDN, manual JSON regex highlighting
- Plan: `docs/postman-clone/postman-clone-plan.md`

### HTTP Client MVP (Phase 2 - Functional) - COMPLETED
- Preact + @preact/signals for interactive islands
- Single island boundary: HttpWorkbench wraps request + response panels
- Static shell (header, footer, sidebar) stays Astro
- Custom Elements coexist with Preact islands
- CORS limitation documented; suggest test APIs + future proxy
- Plan: `docs/http-client/http-client-plan.md`

### Local Persistence (Phase 3) - COMPLETED
- localStorage for history (50 max FIFO), collections (flat, no folders), workbench state
- StorageService abstraction in src/services/storage.ts with qb: key prefix
- Sidebar panels (History, Collections) converted from .astro placeholders to Preact islands
- Workbench state: effect() auto-persist; history/collections: explicit persist-on-mutate
- New stores: history-store.ts, collection-store.ts, ui-store.ts
- SaveToCollectionModal.tsx in workbench island
- MethodBadge.tsx shared Preact component (replicates Badge.astro for .tsx context)
- client:idle recommended for sidebar islands (non-critical, defer hydration)
- Plan: `docs/local-persistence/local-persistence-plan.md`

## Codebase State (verified 2026-02-21)
- Mock data files removed (src/data/ emptied in http-client feature)
- Sidebar: CollectionPanel.tsx (client:idle), HistoryPanel.tsx (client:idle), EnvironmentList.astro (placeholder)
- sidebar.ts Custom Element already uses localStorage for collapse state (key: "sidebar-collapsed")
- Sidebar.astro aside uses w-80 (320px) class, overflow-hidden, relative positioning needed for resize handle
- AppLayout.astro grid-cols-[auto_1fr] -- auto adapts to aside explicit width
- global.css: aside transition width 200ms, aside.collapsed width 0 !important
- Badge.astro has method color mapping (pm-method-*) - needs .tsx equivalent for islands
- pm-tabs Custom Element in tabs.ts handles tab switching via hidden class toggle on [data-panel] divs
- RequestBar.tsx calls sendRequest() from http-client.ts; success path is the hook point for history
- TabBar.tsx + TabBarItem.tsx are Preact islands (converted from .astro in add-requests feature)
- http-store.ts uses computed proxies delegating to activeTab in tab-store
- StorageService keys: qb:history, qb:collections, qb:tabs, qb:active-tab, qb:sidebar-width (qb:workbench deprecated)
- environment.svg icon already exists in src/assets/icons/

## Astro + Preact Integration (from official docs 2026-02-19)
- Install: `bun add @astrojs/preact preact @preact/signals`
- Config: `integrations: [preact()]` in astro.config.mjs
- tsconfig: `"jsx": "react-jsx"`, `"jsxImportSource": "preact"`
- Client directives: `client:load` (immediate), `client:idle` (after idle)
- Props to hydrated islands must be serializable (no functions)
- Cannot use .astro components inside .tsx; use slots from .astro parent
- Shared state between islands: module-level signals or nanostores

## @preact/signals Patterns
- `signal(val)` reactive state, `computed(() => derived)`, `effect(() => side)`
- `batch(() => {})` to group signal writes into single update
- `useSignal()`, `useComputed()`, `useSignalEffect()` for component-local
- Pass signal directly to JSX (not .value) for optimized Preact DOM updates
- Immutable update pattern: `sig.value = { ...sig.value, field: newVal }`

## Tailwind CSS v4 Notes
- `@theme` block = design tokens generating utilities
- Works in .tsx files automatically via Vite plugin
- Namespaces: --color-*, --font-*, --text-*, --spacing-*, --radius-*

### Add Requests / Multi-Tab (Phase 5) - COMPLETED
- TabBar.tsx + TabBarItem.tsx are Preact islands (converted from .astro)
- tab-store.ts has Tab[] signal + activeTabId signal + computed activeTab
- http-store refactored to computed proxies reading from active tab
- Persistence: qb:tabs + qb:active-tab keys, migrated from qb:workbench
- Max 20 tabs, response bodies excluded from persistence
- Plan: `docs/add-requests/add-requests-plan.md`

### Test Runner (Phase 4) - COMPLETED
- Vitest chosen over Bun test and Jest (official Astro recommendation)
- `getViteConfig()` from `astro/config` reuses Vite pipeline in tests
- happy-dom for DOM simulation (localStorage, crypto, URL)
- Co-located test files: `*.test.ts` next to source
- Shared factories in `src/test/factories.ts`
- Store tests need `vi.resetModules()` due to module-level signal init
- Coverage: v8 provider, 70% threshold, only utils/services/stores
- Plan: `docs/test-runner/test-runner-plan.md`

### Environment Variables (Phase 6) - COMPLETED
- Types: Environment, EnvironmentVariable in src/types/environment.ts
- Interpolation: pure utility in src/utils/interpolation.ts ({{var}} syntax, single-pass)
- Store: environment-store.ts following collection-store pattern (signal + explicit persist)
- StorageService: qb:environments, qb:active-environment keys
- Header: EnvironmentSelector.tsx (client:load) with existing Dropdown component
- Sidebar: EnvironmentPanel.tsx (client:idle) replaces EnvironmentList.astro placeholder
- KeyValueTable reused for variable editing (same shape as KeyValuePair)
- http-client.ts: interpolate at send time, history stores unresolved templates
- Plan: `docs/environment-variables/environment-variables-plan.md`

## Store Pattern (verified 2026-02-21)
- All stores: module-level signal initialized from StorageService.getX()
- Action functions: mutate signal, then explicit StorageService.setX() call
- Exception: tab-store uses effect() for auto-persist (many mutation points)
- Tests: vi.resetModules() + dynamic import in beforeEach for fresh module state
- Tests: vi.mock() for StorageService and ui-store at module level + inside beforeEach

## Shared Components (verified 2026-02-21)
- Dropdown.tsx: generic listbox with keyboard nav, used by MethodSelector + BodyEditor
- Tabs.tsx: reusable tab component with ARIA, used by RequestConfigTabs + ResponseTabs
- KeyValueTable.tsx: checkbox + key + value + description(opt) + delete, used by params/headers
- MethodBadge.tsx: colored method label for sidebar items
- CodeViewer.tsx: JSON syntax highlighting for response body

### Authentication System (Phase 7) - COMPLETED
- Auth as field of RequestState (not separate store) -- same pattern as body
- Discriminated union AuthConfig: none | basic | bearer | apikey
- Types: src/types/auth.ts, utils: src/utils/auth.ts (resolveAuthHeaders pure fn)
- UI: AuthEditor.tsx as new tab in RequestConfigTabs (alongside Params/Headers/Body)
- Auth headers injected at send-time in http-client.ts (not visible in headers list)
- User headers override auth headers (auth applied first, then user headers)
- API Key supports header or query param injection
- Bearer Token prefix configurable (default "Bearer")
- interpolateRequest() extended to interpolate auth fields
- Migration guard: tabs without auth field get DEFAULT_AUTH on restore
- Plan: `docs/auth-system/auth-system-plan.md`

### Collections Import/Export (Phase 10) - PLANNED
- Export: downloadJson() with Blob + Object URL + temp <a> click pattern
- Import: ImportModal.tsx (shared for collections & environments) with file input + parse + strategy
- Format: ExportEnvelope with format="querybox", version=1, type, data fields
- Strategies: merge (skip by name case-insensitive) | replace (regenerate all IDs)
- Type guards isCollection/isEnvironment exported from storage.ts for validation
- UI: Import/Export icon buttons in CollectionPanel + EnvironmentPanel headers
- Signal: showImportModal in ui-store.ts with { target: "collections"|"environments" }
- No external dependencies, no toast system (relies on signal reactivity for feedback)
- Postman v2.1 compatibility deferred to future phase (YAGNI)
- Plan: `docs/collections-import-export/collections-import-export-plan.md`

### Code Snippet Generator (Phase 9) - COMPLETED
- Pure generator functions in src/utils/snippet-generators.ts (curl, fetch, python-requests, axios)
- Types in src/types/snippet.ts (SnippetLanguage union, SNIPPET_OPTIONS registry)
- Modal pattern (CodeSnippetModal.tsx) following SaveToCollectionModal pattern
- Button "</> Code" in RequestBar between Save and Send
- Signal showCodeSnippetModal in ui-store.ts
- Reuses: Dropdown for language selector, CodeViewer pattern for preview
- Reuses: resolveAuthHeaders(), buildUrlWithParams(), interpolateRequest()
- Toggle to resolve/preserve env variable placeholders in snippets
- navigator.clipboard.writeText() + "Copied!" feedback (2s timeout)
- No external dependencies needed
- Plan: `docs/code-snippet-generator/code-snippet-generator-plan.md`

### Vercel Deploy (Phase 8) - PLANNED
- 100% static site, NO @astrojs/vercel adapter needed
- No SSR, no middleware, no API routes, no env vars used
- Single page: src/pages/index.astro -> dist/index.html
- vercel.json: explicit framework/buildCommand/installCommand + security headers
- Cache-Control immutable for _astro/ assets (content-hashed filenames)
- Bun detected via bun.lockb automatically by Vercel
- site property in astro.config.mjs to be added post-deploy
- Future CORS proxy would require adapter + output:'hybrid'
- Plan: `docs/vercel-deploy/vercel-deploy-plan.md`

## Skills Available
- `ui-design-system`: TailwindCSS + Radix + shadcn/ui patterns
- `astro`: Astro 5 best practices
- `architecture-patterns`: Software architecture, Clean Architecture, DDD
