# Planner Agent Memory - queryBox

## Project Stack (verified 2026-02-19)
- Astro 5.17.1, Tailwind CSS 4.1.18 (v4), Bun, TypeScript strict
- Tailwind v4 uses `@import "tailwindcss"` + `@theme` directive in CSS (NO tailwind.config.js)
- `@theme { --color-name: value; }` generates utility classes like `bg-name`, `text-name`
- Preact + @preact/signals installed and configured (added in http-client feature)

## Project Structure (verified 2026-02-19)
- Components: header/, request/, response/, shared/, sidebar/, workbench/
- 4 Custom Elements: tabs.ts, dropdown.ts, tree.ts, sidebar.ts in src/scripts/
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

## Codebase State (verified 2026-02-20)
- Mock data files removed (src/data/ emptied in http-client feature)
- Sidebar panels show static placeholders: CollectionTree.astro, HistoryList.astro, EnvironmentList.astro
- sidebar.ts Custom Element already uses localStorage for collapse state (key: "sidebar-collapsed")
- Badge.astro has method color mapping (pm-method-*) - needs .tsx equivalent for islands
- pm-tabs Custom Element in tabs.ts handles tab switching via hidden class toggle on [data-panel] divs
- RequestBar.tsx calls sendRequest() from http-client.ts; success path is the hook point for history

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

### Test Runner (Phase 4) - PLANNED
- Vitest chosen over Bun test and Jest (official Astro recommendation)
- `getViteConfig()` from `astro/config` reuses Vite pipeline in tests
- happy-dom for DOM simulation (localStorage, crypto, URL)
- Co-located test files: `*.test.ts` next to source
- Shared factories in `src/test/factories.ts`
- Store tests need `vi.resetModules()` due to module-level signal init
- Coverage: v8 provider, 70% threshold, only utils/services/stores
- Plan: `docs/test-runner/test-runner-plan.md`

## Skills Available
- `ui-design-system`: TailwindCSS + Radix + shadcn/ui patterns
- `astro`: Astro 5 best practices
- `architecture-patterns`: Software architecture, Clean Architecture, DDD
