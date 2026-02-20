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
