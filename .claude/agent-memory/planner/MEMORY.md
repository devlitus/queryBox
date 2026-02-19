# Planner Agent Memory - queryBox

## Project Stack (verified 2026-02-19)
- Astro 5.17.1, Tailwind CSS 4.1.18 (v4), Bun, TypeScript strict
- Tailwind v4 uses `@import "tailwindcss"` + `@theme` directive in CSS (NO tailwind.config.js)
- `@theme { --color-name: value; }` generates utility classes like `bg-name`, `text-name`
- No UI framework installed yet. Only .astro components + Custom Elements.

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

### HTTP Client MVP (Phase 2 - Functional) - PLANNED
- Preact + @preact/signals for interactive islands
- Single island boundary: HttpWorkbench wraps request + response panels
- Static shell (header, footer, sidebar) stays Astro
- Custom Elements coexist with Preact islands
- CORS limitation documented; suggest test APIs + future proxy
- Plan: `docs/http-client/http-client-plan.md`

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

## Skills Available
- `ui-design-system`: TailwindCSS + Radix + shadcn/ui patterns
- `astro`: Astro 5 best practices
- `architecture-patterns`: Software architecture, Clean Architecture, DDD
