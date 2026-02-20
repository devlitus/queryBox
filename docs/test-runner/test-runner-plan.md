# Test Runner Integration Plan

## Feature: Unit Testing Infrastructure for queryBox

**Branch**: `feature/test-runner`
**Created**: 2026-02-20
**Status**: Draft

---

## Executive Summary

This plan integrates a unit test runner into the queryBox project (Astro 5 + Bun + TypeScript strict + Preact). After evaluating three candidates (Vitest, Bun test, Jest), **Vitest** is the recommended choice based on official Astro documentation, Vite ecosystem alignment, and TypeScript/Preact compatibility.

---

## Test Runner Evaluation

### Option A: Vitest

| Criterion | Assessment |
|---|---|
| **Astro compatibility** | Officially recommended by Astro docs. `getViteConfig()` helper provided. |
| **Vite integration** | Native. Shares Vite config, plugins, and transforms with the project. |
| **TypeScript support** | Native via esbuild. No extra config needed. |
| **Preact/JSX support** | Works with Vite's JSX transform. Same `jsxImportSource: "preact"` config. |
| **DOM simulation** | Built-in support for `happy-dom` and `jsdom` environments. |
| **Speed** | Fast. Uses Vite's module graph for smart re-runs. HMR-like watch mode. |
| **Ecosystem** | Large: compatible with Jest API, Testing Library, extensive plugin ecosystem. |
| **Signals compatibility** | `@preact/signals` works in Vitest since signals are plain JS objects. |

### Option B: Bun Test (native)

| Criterion | Assessment |
|---|---|
| **Astro compatibility** | No official Astro integration. No `getViteConfig()` equivalent. |
| **Vite integration** | None. Cannot reuse Vite plugins or transforms. |
| **TypeScript support** | Native via Bun's built-in transpiler. |
| **Preact/JSX support** | Requires manual JSX config. No Vite transform pipeline. |
| **DOM simulation** | No built-in DOM. Must manually integrate `happy-dom` or `jsdom`. |
| **Speed** | Fastest raw execution (0.08s vs 0.9s in benchmarks). |
| **Ecosystem** | Growing but smaller. Fewer integrations and community resources. |
| **Signals compatibility** | Works for pure logic tests; DOM tests require manual setup. |

### Option C: Jest

| Criterion | Assessment |
|---|---|
| **Astro compatibility** | Mentioned in Astro docs but no dedicated helper. |
| **Vite integration** | None. Requires separate Babel/ts-jest transforms. |
| **TypeScript support** | Via `ts-jest` or `@swc/jest`. Additional config overhead. |
| **Preact/JSX support** | Requires Babel presets or manual transform config. |
| **DOM simulation** | Built-in jsdom support. |
| **Speed** | Slowest of the three. Heavy startup, serial by default. |
| **Ecosystem** | Largest and most mature. Declining for new projects. |
| **Signals compatibility** | Works but requires more boilerplate. |

### Decision: Vitest

**Justification**:

1. **Official Astro recommendation**: Astro provides `getViteConfig()` specifically for Vitest, ensuring the test environment mirrors the build environment exactly. This eliminates configuration drift.
2. **Vite pipeline reuse**: The project already uses Vite (via Astro) with `@tailwindcss/vite` and `@astrojs/preact`. Vitest inherits these plugins automatically, so JSX transforms, path aliases, and module resolution work identically in tests.
3. **TypeScript strict compatibility**: Vitest uses esbuild for transpilation, which respects the project's `tsconfig.json` settings without additional configuration.
4. **Preact signals**: Signals are plain JavaScript objects that work in any environment. Vitest's `happy-dom` environment provides the minimal DOM needed for component-adjacent tests.
5. **Developer experience**: Jest-compatible API (describe/it/expect), watch mode with Vite HMR, VS Code extension, and inline snapshot support.
6. **Community momentum**: Vitest has overtaken Jest as the default for Vite-based projects. Most Astro community guides and templates use Vitest.

**Trade-off acknowledged**: Bun test is faster in raw execution, but the lack of Vite integration and DOM environment support creates significant configuration burden for an Astro+Preact project. The speed difference is negligible for a project of this size.

---

## Testable Modules Inventory

The following modules contain pure logic or service-layer code suitable for unit testing:

| Module | File | Test Priority | Notes |
|---|---|---|---|
| URL utilities | `src/utils/url.ts` | HIGH | Pure functions: `parseQueryParams`, `buildUrlWithParams`, `formatBytes` |
| Storage service | `src/services/storage.ts` | HIGH | Needs `localStorage` mock (happy-dom provides it) |
| History store | `src/stores/history-store.ts` | HIGH | Signal-based state + `StorageService` interaction |
| Collection store | `src/stores/collection-store.ts` | HIGH | Signal-based CRUD + `StorageService` interaction |
| HTTP store actions | `src/stores/http-store.ts` | MEDIUM | Signal mutations; depends on `crypto.randomUUID` |
| Type guards | `src/services/storage.ts` (internal) | MEDIUM | `isRequestState`, `isHistoryEntry`, `isCollection` |
| HTTP client | `src/services/http-client.ts` | LOW | Tightly coupled to signals and `fetch`; needs mocking |
| UI store | `src/stores/ui-store.ts` | LOW | Trivial (single boolean signal) |

---

## Phase 1: Install and Configure Vitest

### Objective
Install Vitest and its dependencies. Create the configuration file that integrates with Astro's Vite config.

### Prerequisites
- Branch `feature/test-runner` checked out from `main`

### Detailed Tasks

1. **Install Vitest and happy-dom as dev dependencies**:
   ```
   bun add -d vitest happy-dom
   ```
   - `vitest`: Test runner
   - `happy-dom`: Lightweight DOM simulation (faster than jsdom, sufficient for this project)

2. **Create `vitest.config.ts`** at project root:
   ```typescript
   /// <reference types="vitest/config" />
   import { getViteConfig } from "astro/config";

   export default getViteConfig({
     test: {
       environment: "happy-dom",
       globals: true,
       include: ["src/**/*.{test,spec}.{ts,tsx}"],
       exclude: ["node_modules", "dist", ".astro"],
       coverage: {
         provider: "v8",
         include: ["src/utils/**", "src/services/**", "src/stores/**"],
         exclude: ["src/**/*.astro", "src/pages/**", "src/layouts/**"],
         thresholds: {
           statements: 70,
           branches: 70,
           functions: 70,
           lines: 70,
         },
       },
       setupFiles: ["./src/test/setup.ts"],
     },
   });
   ```

   **Key configuration decisions**:
   - `environment: "happy-dom"`: Provides `localStorage`, `URL`, `crypto` APIs needed by storage service and stores. Faster than jsdom.
   - `globals: true`: Enables `describe`, `it`, `expect` without imports (matches community convention).
   - `include` pattern: Co-locates tests next to source files (`*.test.ts` / `*.spec.ts`).
   - `coverage.provider: "v8"`: Built-in, no extra dependency. Covers only business logic directories.
   - `setupFiles`: Global test setup for mocks and environment preparation.

3. **Create `src/test/setup.ts`** (global test setup file):
   ```typescript
   import { afterEach } from "vitest";

   // Clear localStorage between tests to prevent state leakage
   afterEach(() => {
     localStorage.clear();
   });
   ```

4. **Add `test` scripts to `package.json`**:
   ```json
   {
     "scripts": {
       "test": "vitest run",
       "test:watch": "vitest",
       "test:coverage": "vitest run --coverage"
     }
   }
   ```

5. **Update `tsconfig.json`** to include Vitest types:
   - Add `"types": ["vitest/globals"]` to `compilerOptions` so TypeScript recognizes global `describe`, `it`, `expect` without import errors.

### Affected Files
- `package.json` - modify (add devDependencies and scripts)
- `vitest.config.ts` - create
- `src/test/setup.ts` - create
- `tsconfig.json` - modify (add vitest/globals type)

### Applied Best Practices
- **Separation of Concerns**: Test config is in its own file (`vitest.config.ts`), not mixed into `astro.config.mjs`.
- **KISS**: Using `getViteConfig()` instead of manually duplicating Vite config.
- **Fail Fast**: Coverage thresholds will catch regressions in CI.

### Completion Criteria
- [ ] `bun test` runs successfully (even with 0 tests)
- [ ] `bun test:watch` starts in watch mode
- [ ] `bun test:coverage` generates a coverage report
- [ ] TypeScript reports no errors with `bun astro check`
- [ ] `bun build` succeeds without regressions

### Risks and Mitigations
- **Risk**: `getViteConfig()` might conflict with Tailwind CSS v4 Vite plugin in test environment. -> **Mitigation**: The Tailwind plugin only processes CSS; it is inert during test execution. If issues arise, add `css: false` to the test config.
- **Risk**: `happy-dom` may not implement `crypto.randomUUID()`. -> **Mitigation**: Modern happy-dom (v15+) includes `crypto.randomUUID()`. If missing, the setup file can polyfill it: `globalThis.crypto.randomUUID = () => ...`.

### Complexity Estimation
**Low** - Standard Vitest setup with official Astro helper. No custom transforms needed.

---

## Phase 2: Tests for URL Utilities (`src/utils/url.ts`)

### Objective
Write comprehensive unit tests for the three pure utility functions. These are the easiest to test (no side effects, no dependencies) and establish the testing patterns for the project.

### Prerequisites
- Phase 1 completed (Vitest configured and running)

### Detailed Tasks

1. **Create `src/utils/url.test.ts`** with the following test suites:

   **`parseQueryParams` tests**:
   - Returns empty array for empty string
   - Returns empty array for URL without query params
   - Parses single query param from full URL (`https://api.example.com?key=value`)
   - Parses multiple query params
   - Handles URL without protocol (adds dummy base internally)
   - Returns empty array for completely invalid/malformed input
   - Each returned item has `id` (string), `key`, `value`, and `enabled: true`
   - Handles URL-encoded characters in params

   **`buildUrlWithParams` tests**:
   - Returns empty string for empty baseUrl
   - Returns baseUrl unchanged when params array is empty
   - Returns baseUrl unchanged when all params are disabled
   - Appends single enabled param to URL
   - Appends multiple enabled params
   - Skips params with empty key
   - Skips disabled params
   - Handles URL without protocol
   - Handles malformed URLs (fallback path: direct string concatenation)
   - Preserves existing path and hash in URL

   **`formatBytes` tests**:
   - Formats bytes (< 1024) as "X B"
   - Formats kilobytes (1024-1048575) as "X.XX KB"
   - Formats megabytes (>= 1048576) as "X.XX MB"
   - Edge cases: 0 bytes, exactly 1024 bytes, exactly 1048576 bytes

2. **Testing pattern to establish**:
   ```typescript
   import { describe, it, expect } from "vitest";
   import { parseQueryParams, buildUrlWithParams, formatBytes } from "./url";

   describe("parseQueryParams", () => {
     it("returns empty array for empty string", () => {
       expect(parseQueryParams("")).toEqual([]);
     });
     // ... more tests
   });
   ```

   **Note**: Since `parseQueryParams` generates random UUIDs for `id` fields, tests should use `expect.objectContaining()` or check individual properties rather than exact equality on the full object.

### Affected Files
- `src/utils/url.test.ts` - create

### Applied Best Practices
- **AAA Pattern**: Each test follows Arrange-Act-Assert structure.
- **Boundary testing**: Include edge cases (empty, null-ish, overflow).
- **Descriptive names**: Test names describe the expected behavior, not the implementation.
- **DRY**: Share fixtures where appropriate, but keep each test self-contained and readable.

### Completion Criteria
- [ ] All tests pass with `bun test`
- [ ] Coverage for `src/utils/url.ts` reaches 100% statements and branches
- [ ] No TypeScript errors in the test file

### Risks and Mitigations
- **Risk**: `crypto.randomUUID()` inside `parseQueryParams` might not be available. -> **Mitigation**: happy-dom provides Web Crypto. If not, Phase 1 setup file includes polyfill.

### Complexity Estimation
**Low** - Pure functions, no mocking required.

---

## Phase 3: Tests for Storage Service (`src/services/storage.ts`)

### Objective
Test the `StorageService` facade including type guards, read/write primitives, and domain-specific helpers. These tests validate data integrity and corruption recovery logic.

### Prerequisites
- Phase 1 completed
- Phase 2 completed (testing patterns established)

### Detailed Tasks

1. **Create `src/services/storage.test.ts`** with the following test suites:

   **Generic primitives (`getItem` / `setItem` / `removeItem`)**:
   - `getItem` returns fallback when key does not exist
   - `getItem` returns parsed JSON when key exists
   - `getItem` returns fallback when stored value is invalid JSON
   - `setItem` stores JSON-serialized value
   - `removeItem` removes the key from localStorage
   - `setItem` silently handles quota exceeded (mock `localStorage.setItem` to throw)

   **Type guards (tested indirectly through domain helpers)**:
   - `getHistory` returns empty array when localStorage is empty
   - `getHistory` returns valid entries, filtering out corrupted ones
   - `getHistory` clears key when stored data is not an array
   - `getHistory` re-saves filtered data when some entries are invalid
   - `getCollections` follows same patterns as history
   - `getWorkbenchState` returns null when empty
   - `getWorkbenchState` returns null and clears key when data fails validation
   - `getWorkbenchState` returns valid `RequestState` when data is correct

   **Domain helpers**:
   - `setHistory` persists array to localStorage
   - `setCollections` persists array to localStorage
   - `setWorkbenchState` persists state to localStorage

2. **Test data factories**: Create helper functions to generate valid test data:
   ```typescript
   function makeRequestState(overrides?: Partial<RequestState>): RequestState {
     return {
       method: "GET",
       url: "https://api.example.com",
       params: [],
       headers: [],
       body: { mode: "none", contentType: "json", raw: "" },
       ...overrides,
     };
   }

   function makeHistoryEntry(overrides?: Partial<HistoryEntry>): HistoryEntry {
     return {
       id: "test-id-1",
       method: "GET",
       url: "https://api.example.com",
       status: 200,
       statusText: "OK",
       timestamp: Date.now(),
       requestSnapshot: makeRequestState(),
       ...overrides,
     };
   }

   function makeCollection(overrides?: Partial<Collection>): Collection {
     return {
       id: "col-1",
       name: "Test Collection",
       createdAt: Date.now(),
       requests: [],
       ...overrides,
     };
   }
   ```

   These factories should be placed in `src/test/factories.ts` for reuse in later phases.

3. **Note on the `StorageService` API**: The current implementation exports `getItem`, `setItem`, and `removeItem` as public API alongside the domain helpers. Tests should access them through `StorageService.getItem(...)` etc.

### Affected Files
- `src/services/storage.test.ts` - create
- `src/test/factories.ts` - create (shared test data factories)

### Applied Best Practices
- **Factory Pattern**: Reusable test data builders reduce duplication and improve maintainability.
- **Isolation**: Each test starts with a clean `localStorage` (guaranteed by setup.ts `afterEach`).
- **Defensive testing**: Validates corruption recovery paths (data integrity is critical for persistence layer).

### Completion Criteria
- [ ] All tests pass with `bun test`
- [ ] Coverage for `src/services/storage.ts` reaches 90%+ on statements and branches
- [ ] Factories are reusable and correctly typed
- [ ] No TypeScript errors

### Risks and Mitigations
- **Risk**: `localStorage` in happy-dom might behave differently from browser (e.g., `QuotaExceededError`). -> **Mitigation**: For quota tests, mock `localStorage.setItem` using `vi.spyOn()` to throw.

### Complexity Estimation
**Medium** - Requires careful test data construction and corruption scenario testing.

---

## Phase 4: Tests for Stores (`history-store.ts` and `collection-store.ts`)

### Objective
Test the signal-based store modules that manage state and persist through `StorageService`. These tests validate state mutations and their side effects on localStorage.

### Prerequisites
- Phase 3 completed (StorageService tests and factories available)

### Detailed Tasks

1. **Create `src/stores/history-store.test.ts`**:

   **`addHistoryEntry`**:
   - Adds entry to the beginning of the list
   - Generates a unique `id` and `timestamp`
   - Persists updated list to localStorage via `StorageService`
   - Enforces MAX_HISTORY (50) limit by dropping oldest entries (FIFO)
   - Works correctly when adding to an empty history

   **`clearHistory`**:
   - Sets signal value to empty array
   - Persists empty array to localStorage

   **`removeHistoryEntry`**:
   - Removes entry by id
   - Persists updated list
   - Is a no-op when id does not exist

   **Signal initialization**:
   - `historyEntries` signal initializes from localStorage on module load

2. **Create `src/stores/collection-store.test.ts`**:

   **`createCollection`**:
   - Creates collection with generated `id` and `createdAt`
   - Appends to the collections signal
   - Persists to localStorage
   - Returns the created collection object

   **`deleteCollection`**:
   - Removes collection by id
   - Persists updated list
   - Is a no-op when id does not exist

   **`renameCollection`**:
   - Updates the name of the matching collection
   - Persists updated list
   - Is a no-op when id does not exist

   **`saveRequestToCollection`**:
   - Appends saved request to the correct collection
   - Generates unique `id` and `savedAt` timestamp
   - Persists to localStorage
   - Returns the created `SavedRequest` object

   **`removeRequestFromCollection`**:
   - Removes request by id from the correct collection
   - Persists updated list

3. **Important testing consideration**: Store modules import and execute `StorageService.getHistory()` / `StorageService.getCollections()` at module level (to initialize signal values). This means:
   - Tests must seed `localStorage` BEFORE importing the store module, OR
   - Use `vi.resetModules()` + dynamic `import()` to re-initialize the store with fresh state.

   **Recommended approach**: Use `vi.resetModules()` in a `beforeEach` and dynamically import the store:
   ```typescript
   let historyStore: typeof import("./history-store");

   beforeEach(async () => {
     vi.resetModules();
     localStorage.clear();
     historyStore = await import("./history-store");
   });
   ```

### Affected Files
- `src/stores/history-store.test.ts` - create
- `src/stores/collection-store.test.ts` - create

### Applied Best Practices
- **Module isolation**: `vi.resetModules()` ensures each test gets a fresh module instance with clean signal state.
- **Side effect verification**: Tests verify both the signal value change AND the localStorage persistence.
- **FIFO boundary testing**: Explicitly tests the 50-entry limit.

### Completion Criteria
- [ ] All tests pass with `bun test`
- [ ] Coverage for both store files reaches 90%+ on statements
- [ ] Signal state and localStorage stay in sync after every operation
- [ ] No TypeScript errors

### Risks and Mitigations
- **Risk**: `@preact/signals` `effect()` in `http-store.ts` might fire during import chain, causing unexpected localStorage writes. -> **Mitigation**: Store tests import only their own store module. If cross-import issues arise, mock `../services/storage` at the module level.
- **Risk**: `crypto.randomUUID()` calls inside store functions. -> **Mitigation**: happy-dom provides `crypto.randomUUID()`. Tests assert that `id` is a non-empty string rather than checking exact UUID values.

### Complexity Estimation
**Medium** - Module-level signal initialization requires `vi.resetModules()` pattern. Multiple side effects to verify per operation.

---

## Phase 5: Tests for HTTP Store Actions (`src/stores/http-store.ts`)

### Objective
Test the action functions in `http-store.ts` that mutate `requestState` and related signals. These are the business logic functions for the workbench.

### Prerequisites
- Phase 4 completed

### Detailed Tasks

1. **Create `src/stores/http-store.test.ts`**:

   **`updateMethod`**:
   - Updates the method field of requestState signal
   - Preserves other fields

   **`updateUrl`**:
   - Updates url and parses query params from the new URL
   - Replaces params signal with parsed params

   **`addParam` / `updateParam` / `removeParam` / `toggleParam`**:
   - `addParam`: Appends a new empty KeyValuePair
   - `updateParam`: Updates the specified field of the matching param; syncs URL
   - `removeParam`: Removes param by id; syncs URL
   - `toggleParam`: Flips the enabled state of the matching param

   **`addHeader` / `updateHeader` / `removeHeader` / `toggleHeader`**:
   - Mirror the param tests but for headers array
   - Headers do NOT sync with URL (unlike params)

   **`updateBodyMode` / `updateBodyContentType` / `updateBodyRaw`**:
   - Each updates the corresponding field in requestState.body
   - Preserves other body fields

   **`resetResponse`**:
   - Sets responseState to null
   - Sets requestStatus to "idle"
   - Sets requestError to null

   **`loadRequest`**:
   - Loads a snapshot into requestState
   - Regenerates all param and header IDs (to avoid key collisions)
   - Calls resetResponse

2. **Testing approach**: Use `vi.resetModules()` + dynamic import (same pattern as Phase 4) to get fresh signal state per test. Mock `StorageService` to avoid real localStorage interaction in the auto-persist `effect()`:
   ```typescript
   vi.mock("../services/storage", () => ({
     StorageService: {
       getWorkbenchState: () => null,
       setWorkbenchState: vi.fn(),
       getHistory: () => [],
       setHistory: vi.fn(),
       getCollections: () => [],
       setCollections: vi.fn(),
     },
   }));
   ```

### Affected Files
- `src/stores/http-store.test.ts` - create

### Applied Best Practices
- **Isolation via mocking**: Mock StorageService to test store logic independently of persistence.
- **Immutability verification**: Confirm that state updates create new object references (not mutations).
- **URL-param sync verification**: Test the bidirectional sync between URL and params.

### Completion Criteria
- [ ] All tests pass with `bun test`
- [ ] Coverage for `src/stores/http-store.ts` reaches 80%+ on statements
- [ ] URL-param sync is thoroughly tested (add, update, remove, toggle)
- [ ] No TypeScript errors

### Risks and Mitigations
- **Risk**: The `effect()` for auto-persisting workbench state runs on every `requestState` change, which could interfere with tests. -> **Mitigation**: Mock `StorageService.setWorkbenchState` as a no-op `vi.fn()`.
- **Risk**: `isUpdatingFromParams` flag (module-level mutable state) could leak between tests. -> **Mitigation**: `vi.resetModules()` creates a fresh module instance per test, resetting the flag.

### Complexity Estimation
**Medium** - Many action functions to test. URL-param sync logic has subtle bidirectional behavior.

---

## Phase 6: Package Scripts, CI Readiness, and Documentation

### Objective
Finalize the testing setup with proper scripts, verify the full test suite runs cleanly, and ensure the setup is ready for CI integration.

### Prerequisites
- Phases 1-5 completed

### Detailed Tasks

1. **Verify all scripts work end-to-end**:
   - `bun test` - runs all tests, exits with 0
   - `bun test:watch` - starts watch mode
   - `bun test:coverage` - generates coverage report, thresholds pass

2. **Run project verification commands**:
   - `bun astro check` - no TypeScript errors
   - `bun build` - production build succeeds

3. **Verify test file count and coverage summary**:
   - Expected test files: 5
     - `src/utils/url.test.ts`
     - `src/services/storage.test.ts`
     - `src/stores/history-store.test.ts`
     - `src/stores/collection-store.test.ts`
     - `src/stores/http-store.test.ts`
   - Expected total tests: approximately 60-80 individual test cases
   - Coverage thresholds: 70% minimum for statements, branches, functions, lines

4. **Add `.gitignore` entry** for coverage output directory if not already covered:
   - Vitest coverage outputs to `./coverage/` by default
   - Verify `coverage/` is in `.gitignore`

### Affected Files
- `package.json` - verify scripts (already added in Phase 1)
- `.gitignore` - modify (add `coverage/` if missing)

### Applied Best Practices
- **Fail Fast in CI**: Coverage thresholds ensure minimum quality gate.
- **Clean artifacts**: Coverage directory excluded from version control.

### Completion Criteria
- [ ] `bun test` exits with code 0
- [ ] `bun test:coverage` exits with code 0 and meets thresholds
- [ ] `bun astro check` passes
- [ ] `bun build` passes
- [ ] `coverage/` is in `.gitignore`
- [ ] No regressions in existing functionality

### Risks and Mitigations
- **Risk**: Coverage thresholds too aggressive for initial setup. -> **Mitigation**: Set initial thresholds at 70%. Can be increased incrementally as coverage grows.

### Complexity Estimation
**Low** - Verification and cleanup only.

---

## Test File Structure Summary

After all phases are complete, the project will have this test structure:

```
src/
  test/
    setup.ts              # Global test setup (localStorage cleanup)
    factories.ts          # Shared test data builders
  utils/
    url.ts
    url.test.ts           # ~20 tests
  services/
    storage.ts
    storage.test.ts       # ~15 tests
  stores/
    history-store.ts
    history-store.test.ts   # ~10 tests
    collection-store.ts
    collection-store.test.ts # ~15 tests
    http-store.ts
    http-store.test.ts      # ~15 tests
```

**Convention**: Test files are co-located next to their source files (`*.test.ts`). Shared test utilities live in `src/test/`.

---

## Dependencies to Install

| Package | Version | Type | Purpose |
|---|---|---|---|
| `vitest` | latest | devDependency | Test runner |
| `happy-dom` | latest | devDependency | DOM simulation for localStorage, URL, crypto |

**Total new dependencies**: 2 dev-only packages. No production dependency changes.

---

## Phase Dependency Graph

```
Phase 1 (Config)
    |
    v
Phase 2 (URL utils tests)
    |
    v
Phase 3 (Storage tests + factories)
    |
    v
Phase 4 (Store tests: history + collection)
    |
    v
Phase 5 (HTTP store tests)
    |
    v
Phase 6 (Verification + cleanup)
```

All phases are sequential. Each phase builds on patterns and utilities from the previous one.

---

## Sources and References

- [Astro Official Testing Documentation](https://docs.astro.build/en/guides/testing/)
- [Vitest Configuration Reference](https://vitest.dev/config/)
- [Vitest Comparisons with Other Test Runners](https://vitest.dev/guide/comparisons)
- [Astro + Vitest Starter Template](https://github.com/withastro/astro/tree/latest/examples/with-vitest)
- [Happy-DOM Setup as Test Environment](https://github.com/capricorn86/happy-dom/wiki/Setup-as-Test-Environment)
- [Evan You on Vite/Vitest vs Bun](https://x.com/youyuxi/status/1934895819930644778)
- [Jest vs Vitest Comparison 2025](https://medium.com/@ruverd/jest-vs-vitest-which-test-runner-should-you-use-in-2025-5c85e4f2bda9)
