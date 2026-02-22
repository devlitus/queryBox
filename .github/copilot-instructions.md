# Project Guidelines — queryBox

> Responder siempre en **español** al discutir el proyecto. Código y términos técnicos en inglés.
> Archivo complementario a [CLAUDE.md](../CLAUDE.md) — consultar ambos.

## Code Style

- **TypeScript strict** — extends `astro/tsconfigs/strict`. Cero `any`, cero `TODO` comments, cero código sin usar.
- **Preact** (no React) — `class` en JSX (no `className`). Imports: `useEffect`/`useRef` de `preact/hooks`, `useSignal` de `@preact/signals`.
- **Tailwind CSS v4** — tokens via `@theme` en [src/styles/global.css](../src/styles/global.css), NO hay `tailwind.config.js`. Namespace `pm-*` (`bg-pm-bg-primary`, `text-pm-accent`, `font-pm-mono`).
- **IDs**: `crypto.randomUUID()`. Deep clone: `structuredClone()`.
- **SVG icons**: en `.astro` usar `<Fragment set:html={svgRaw} />`; en `.tsx` usar `dangerouslySetInnerHTML={{ __html: svgString }}` solo para assets estáticos (nunca datos HTTP).

## Project Structure

```
src/
├── assets/icons/       # SVG icons (importados con ?raw)
├── components/         # Componentes UI organizados por área
│   ├── header/         #   Header bar + EnvironmentSelector
│   ├── footer/         #   Footer bar
│   ├── sidebar/        #   CollectionPanel, HistoryPanel, EnvironmentPanel
│   ├── request/        #   RequestBar, RequestConfigTabs, AuthEditor, BodyEditor
│   ├── response/       #   ResponsePanel, ResponseTabs, CodeViewer
│   ├── workbench/      #   HttpWorkbench (island principal), TabBar, CodeSnippetModal
│   └── shared/         #   Dropdown, Tabs, KeyValueTable, MethodBadge, ImportModal
├── layouts/            # Layout.astro (base HTML) + AppLayout.astro (grid shell)
├── pages/              # File-based routing
│   ├── index.astro     #   Single page app entry
│   └── api/            #   Server-side API routes (prerender = false)
├── scripts/            # Custom Elements (vanilla TS)
│   ├── tabs.ts         #   pm-tabs
│   ├── dropdown.ts     #   pm-dropdown
│   ├── tree.ts         #   pm-tree
│   ├── sidebar.ts      #   pm-sidebar-toggle
│   └── sidebar-resize.ts  # pm-sidebar-resize
├── server/             # Server-only (groq-service, rate-limiter)
├── services/           # Client services (storage, http-client, ai-client)
├── stores/             # Preact signals stores (tab, http, history, collection, environment, ui, ai-diagnosis)
├── styles/             # global.css con Tailwind v4 @theme tokens
├── test/               # Test infrastructure (setup.ts, factories.ts)
├── types/              # TypeScript types (http, auth, environment, persistence, export, snippet, ai)
└── utils/              # Pure utility functions (url, auth, interpolation, snippet-generators, export-import)
```

## Architecture

- **Astro 5** — output `static` por defecto. `@astrojs/node` standalone para API routes (`prerender = false`).
- **Islands pattern**: shell estático (header, footer, sidebar) en `.astro`; interactividad compleja en Preact islands.
  - `client:load` → hidratación inmediata (componentes críticos: `EnvironmentSelector`, `HttpWorkbench`).
  - `client:idle` → hidratación diferida (sidebar panels: `CollectionPanel`, `HistoryPanel`, `EnvironmentPanel`).
  - `client:only="preact"` → solo cliente, sin SSR (panels con DOM APIs).
- **State**: `@preact/signals` a nivel de módulo (no Redux/Zustand). `signal()` → átomos, `computed()` → derivados, `effect()` → side effects.
- **Stores clave**: [tab-store.ts](../src/stores/tab-store.ts) (tabs + activeTab), [http-store.ts](../src/stores/http-store.ts) (computed proxies sobre activeTab), [history-store.ts](../src/stores/history-store.ts), [collection-store.ts](../src/stores/collection-store.ts), [environment-store.ts](../src/stores/environment-store.ts).
- **Storage**: `localStorage` con prefix `qb:` via [StorageService](../src/services/storage.ts). Type guards en deserialización. Keys: `qb:tabs`, `qb:active-tab`, `qb:history`, `qb:collections`, `qb:environments`, `qb:active-environment`, `qb:sidebar-width`.
- **Custom Elements**: `src/scripts/` — tabs, dropdown, tree, sidebar, sidebar-resize. Coexisten con Preact islands.
- **AI integration**: `groq-sdk` + server-side API en `src/pages/api/` + `src/server/groq-service.ts`.

## Build and Test

```bash
bun install               # Instalar dependencias
bun dev                   # Dev server en localhost:4321
bun run build             # Build producción (NO 'bun build' — eso es el bundler nativo de Bun)
bun astro check           # TypeScript check (0 errores requerido)
bun run test              # Tests con Vitest (NUNCA 'bun test' — ejecuta runner nativo de Bun)
bun run test:watch        # Tests en modo watch
bun run test:coverage     # Cobertura (thresholds: 70% en statements/branches/functions/lines)
```

**CRITICO**: `bun test` ≠ `bun run test`. El primero usa el runner nativo de Bun (falla con `localStorage is not defined`), el segundo ejecuta Vitest vía package.json scripts.

## Project Conventions

### Store Pattern
Todos los stores siguen el mismo patrón (ver [collection-store.ts](../src/stores/collection-store.ts)):
1. Signal module-level inicializado desde `StorageService.getX()`
2. Funciones de acción: mutar signal → persistir explícito con `StorageService.setX()`
3. Excepción: `tab-store` usa `effect()` para auto-persist (muchos puntos de mutación)
4. Mutations siempre crean nuevas referencias: `sig.value = { ...sig.value, field: newVal }`

### Test Pattern
- Vitest + happy-dom, globals habilitados (no importar `describe`/`it`/`expect`)
- **Ubicación de tests**: co-located `*.test.ts` junto al source por defecto. Usar `__tests__/` subdirectorio **solo** cuando un módulo necesita **múltiples** archivos de test (ej: `collection-store.test.ts` + `__tests__/collection-store-import.test.ts`)
- Factories tipadas en [src/test/factories.ts](../src/test/factories.ts): `makeRequestState()`, `makeHistoryEntry()`, `makeCollection()`, etc.
- Store tests: `vi.resetModules()` + `import()` dinámico en `beforeEach` para resetear signals module-level
- `afterEach(() => localStorage.clear())` en setup global ([src/test/setup.ts](../src/test/setup.ts))
- Cobertura excluye: `http-client.ts` (acoplado a fetch), `ui-store.ts` (trivial)

### Auth Pattern
- Discriminated union `AuthConfig` en [src/types/auth.ts](../src/types/auth.ts) (none | basic | bearer | apikey)
- `resolveAuthHeaders()` en [src/utils/auth.ts](../src/utils/auth.ts) — función pura
- Unicode-safe base64: `TextEncoder` + `btoa(String.fromCharCode(...bytes))`
- Auth headers se inyectan en send-time en `http-client.ts`, user headers tienen precedencia

### Interpolation
- `{{variable}}` syntax, single-pass, regex: `/\{\{([^}]+)\}\}/g`
- `interpolateRequest()` en [src/utils/interpolation.ts](../src/utils/interpolation.ts) — interpola URL, params, headers, body, auth
- History almacena URLs sin resolver (template)

## Agent Workflow

Este proyecto usa agentes especializados en `.claude/agents/`. Workflow obligatorio para features:

```
planner → senior-developer → code-review → [fix cycle si hay issues ALTA/MEDIA]
```

### Agents y sus roles
| Agent | Model | Rol | Output |
|-------|-------|-----|--------|
| `planner` | opus | Arquitecto — diseña planes, NUNCA escribe código | `docs/[feature]/[feature]-plan.md` |
| `senior-developer` | sonnet | Implementador — sigue el plan al pie de la letra, sin scope creep | Código + verificación build/check |
| `code-review` | sonnet | Quality gate — valida contra el plan | `docs/[feature]/review/[feature]-review.md` (append) |
| `accessibility-auditor` | sonnet | Auditor WCAG 2.2 AA — solo lee, nunca modifica | `docs/[feature]/audit/[feature]-a11y-audit.md` |

### Agent Memory System
Cada agente persiste conocimiento aprendido en `.claude/agent-memory/[agent-name]/MEMORY.md`:
- **planner**: stack, estructura, decisiones técnicas, estado del codebase, patrones Preact/Astro/Tailwind
- **senior-developer**: rutas de archivos clave, patrones de codificación, convenciones, gotchas
- **code-review**: issues recurrentes por severidad, checklist optimizado, historial de revisiones, patrones positivos
- **accessibility-auditor**: hallazgos a11y acumulados

**Reglas de memory**:
- Actualizar MEMORY.md al descubrir patrones reutilizables o gotchas
- No duplicar — verificar que no existe antes de agregar
- Incluir fecha de verificación para datos que pueden cambiar
- El code-review también mantiene `review-history.md` con learnings detallados por feature

### Git Convention
- Branches: `feature/[feature-name]` desde `main` (el planner crea la branch)
- Feature name = slug del directorio en `docs/` (lowercase, hyphens)
- Plans: `docs/[feature]/[feature]-plan.md`
- Reviews: `docs/[feature]/review/[feature]-review.md`

### Cuándo NO usar agents
- Cambios triviales (typos, tweaks de una línea)
- Modificaciones de un solo archivo con requisitos claros
- Instrucciones directas ya muy específicas

## Security

- `dangerouslySetInnerHTML` SOLO para SVG assets estáticos (importados con `?raw`). NUNCA para datos HTTP — riesgo XSS.
- `escapeHtml()` obligatorio antes de insertar contenido HTTP en `__html`.
- Auth credentials nunca se persisten en localStorage (solo config de auth, no tokens resueltos).
- API routes en `src/pages/api/` usan rate limiting ([src/server/rate-limiter.ts](../src/server/rate-limiter.ts)).

## Skills Instalados

En `.agents/skills/` — disponibles para todos los agents:
- `architecture-patterns`: Clean Architecture, DDD, patrones modulares
- `ui-design-system`: TailwindCSS + Radix + shadcn/ui, accesibilidad WCAG
- `astro`: Best practices Astro 5.x, islands, client directives
