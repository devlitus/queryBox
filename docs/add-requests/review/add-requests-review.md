# Code Review Report

## Feature: add-requests
## Plan: docs/add-requests/add-requests-plan.md
## Date: 2026-02-20
## Status: APROBADO (con observaciones BAJA)

---

### Summary

Reviewed all 7 phases of the `add-requests` feature. The implementation is comprehensive
and of high quality. All plan requirements are fulfilled. The build passes, all 159 tests
pass, coverage thresholds are met (tab-store.ts: 97.1% statements, 85.71% branches,
100% functions), and `bun astro check` reports 0 errors.

Files reviewed:
- `src/types/http.ts` (modified)
- `src/stores/tab-store.ts` (new)
- `src/services/storage.ts` (modified)
- `src/stores/http-store.ts` (major refactor)
- `src/services/http-client.ts` (modified)
- `src/stores/ui-store.ts` (modified)
- `src/components/request/RequestBar.tsx` (modified)
- `src/components/workbench/TabBar.tsx` (new)
- `src/components/workbench/TabBarItem.tsx` (new)
- `src/components/workbench/Workbench.astro` (modified)
- `src/components/workbench/TabBar.astro` (deleted)
- `src/components/workbench/TabItem.astro` (deleted)
- `src/stores/tab-store.test.ts` (new)
- `src/stores/http-store.test.ts` (modified)

---

### Plan Compliance Checklist

#### Phase 1: Tab Store and Types
- [x] `Tab` interface defined and exported from `src/types/http.ts`
- [x] `tab-store.ts` exports `tabs`, `activeTabId`, `activeTab`, and all action functions
- [x] `createTab()` generates unique IDs via `crypto.randomUUID()`
- [x] `closeTab()` prevents closing the last tab (creates a new default tab first)
- [x] `switchTab()` updates `activeTabId`
- [x] Module initializes with one default tab if no persisted data exists
- [x] `DEFAULT_REQUEST` constant exported and used in `createDefaultTab()`

#### Phase 2: Persistence for Tabs
- [x] `StorageService` has `getTabs`, `setTabs`, `getActiveTabId`, `setActiveTabId` methods
- [x] Type guard `isTab` validates essential fields (id string, name string, isRequestState)
- [x] `tab-store.ts` persists on every signal change via `effect()`
- [x] Legacy `qb:workbench` data is migrated to a single tab in `qb:tabs`
- [x] Maximum 20 tabs enforced in `createTab()`
- [x] Response bodies NOT persisted (stripped on restore — responses are ephemeral)
- [x] `@deprecated` JSDoc on `getWorkbenchState`/`setWorkbenchState`

#### Phase 3: Refactor http-store
- [x] `requestState`, `responseState`, `requestStatus`, `requestError` are computed proxies
- [x] All action functions delegate writes to tab-store via `updateActiveTabRequest`
- [x] All existing consumers work without changes (zero-consumer-change guarantee upheld)
- [x] `loadRequest()` calls `updateActiveTabRequest` and `resetResponse`
- [x] Old `qb:workbench` persistence effect removed from http-store
- [x] `isUpdatingFromParams` flag preserved correctly

#### Phase 4: TabBar Preact Island
- [x] `TabBar.tsx` renders tab list from signals, maps over `tabs.value`
- [x] `TabBarItem.tsx` sub-component with method badge, name, dirty dot, close button
- [x] Active tab styling: `bg-pm-bg-primary border-b-2 border-b-pm-accent`
- [x] Inactive tab styling: `bg-pm-bg-secondary hover:bg-pm-bg-elevated`
- [x] Horizontally scrollable container with `overflow-x-auto`
- [x] Plus button `flex-shrink-0` outside scroll area — always visible
- [x] `Workbench.astro` uses `<TabBar client:load />` (Preact island)
- [x] Old `TabBar.astro` and `TabItem.astro` deleted
- [x] Close button has `aria-label="Close tab {name}"`
- [x] `e.stopPropagation()` on close button click
- [x] Keyboard: ArrowLeft/ArrowRight in TabBar container, Enter/Space in TabBarItem
- [x] Inline SVG used (no `?raw` import issues)
- [x] `MethodBadge` reused from shared components

#### Phase 5: Integration and UX Polish
- [x] Tab switching updates workbench automatically via computed signal chain
- [x] New tab auto-focuses URL input via `shouldFocusUrl` signal + `useEffect` in RequestBar
- [x] Tab name auto-updates to hostname after first request (if name is still "New Request")
- [x] Middle-click to close implemented via `mousedown` with `button === 1`
- [x] State isolation: each tab has its own `RequestState`; responses not shared

#### Phase 6: Tests
- [x] `tab-store.test.ts` created with 28 tests covering all actions
- [x] `http-store.test.ts` updated to use tab-store architecture (50 tests)
- [x] Persistence tests: init persist, restore from localStorage, legacy migration
- [x] Responses ephemeral test included
- [x] `vi.resetModules()` pattern applied correctly
- [x] All 159 tests pass (`bun run test`)
- [x] Coverage for `tab-store.ts`: 97.1% statements, 85.71% branches, 100% functions (exceeds 70% threshold)

#### Phase 7: Cleanup and Verification
- [x] `TabBar.astro` deleted
- [x] `TabItem.astro` deleted
- [x] `bun astro check` passes with 0 errors
- [x] `bun run build` succeeds
- [x] `bun run test` passes with 159 tests
- [x] No orphaned imports

---

### Issues Found

#### ALTA (0 issues)

None.

#### MEDIA (0 issues)

None.

#### BAJA (4 issues)

1. **tabIndex should be -1 for inactive tabs** - `src/components/workbench/TabBarItem.tsx:45`
   - Description: The WAI-ARIA Tabs pattern specifies that only the active tab should have `tabIndex={0}`; all other tabs should have `tabIndex={-1}` so that keyboard navigation uses Arrow keys (not Tab key) to move between tabs. Currently all tabs always have `tabIndex={0}`, which means pressing Tab will cycle through every tab item individually before reaching the URL input, creating a lengthy tab order.
   - The existing shared `Tabs.tsx` component correctly uses `tabIndex={isActive ? 0 : -1}` as the established pattern in this codebase.
   - Suggestion: Change line 45 to `tabIndex={isActive ? 0 : -1}`.

2. **Keyboard handler focuses active tab after Arrow key navigation but does not call `.focus()`** - `src/components/workbench/TabBar.tsx:8-21`
   - Description: The `handleKeyDown` in `TabBar.tsx` calls `switchTab()` on ArrowRight/ArrowLeft, which updates the signal and triggers a re-render. However, it does not programmatically move DOM focus to the newly active tab element. The existing `Tabs.tsx` does `buttons?.[nextIndex]?.focus()` after changing the active tab. Without this, a keyboard user pressing ArrowRight will see the active tab change visually but focus will remain on the previous item (or on the container div).
   - Suggestion: Use a ref on the scroll container and call `.focus()` on the newly active tab `div[role="tab"]` after calling `switchTab`. This is the established pattern from `Tabs.tsx` line 51-52.

3. **Missing tests for new `StorageService` tab methods in `storage.test.ts`** - `src/services/storage.test.ts`
   - Description: `storage.test.ts` contains tests for `getHistory`/`setHistory`, `getCollections`/`setCollections`, `getWorkbenchState`/`setWorkbenchState` but does NOT include tests for the new `getTabs`, `setTabs`, `getActiveTabId`, `setActiveTabId` methods. The coverage report shows lines 148–172 uncovered in `storage.ts`. The plan (Phase 6) specifies "Test persistence (mock localStorage)" and the storage service is a critical component. Although global coverage thresholds pass (70.83% for the services directory), the new tab-related methods are completely untested at the unit level in storage.test.ts.
   - Suggestion: Add a `describe("StorageService.getTabs / setTabs / getActiveTabId / setActiveTabId")` block to `storage.test.ts` covering: empty state returns `[]`, corrupt data returns `[]` and clears key, valid tabs are filtered correctly by `isTab`, `setTabs` persists correctly, `getActiveTabId` returns null for non-string, and `setActiveTabId` persists the ID.

4. **Scroll indicator mentioned in plan but not implemented** - `src/components/workbench/TabBar.tsx`
   - Description: Phase 5, task 6 mentions "consider adding a subtle gradient fade on the edges to indicate scrollability." This was not implemented. The plan marks it as optional ("consider"), so it is low priority, but documenting it here for awareness.
   - Suggestion: Optionally add a CSS fade overlay using `::after` pseudo-element or a `div` with a gradient at the right edge of the scrollable tab container. This is cosmetic only.

---

### Verdict

The implementation fully satisfies all ALTA and MEDIA requirements. The code is clean,
follows established patterns, and introduces no regressions. All 7 phases are complete:

- Phase 1 (Tab Store): Tab type defined, all signals and actions correctly implemented.
- Phase 2 (Persistence): Storage methods added, type guard correct, legacy migration works, 20-tab cap enforced.
- Phase 3 (http-store refactor): Computed proxies preserve the public API perfectly; zero consumer changes required.
- Phase 4 (TabBar Preact island): Both components built correctly, static files deleted, Workbench.astro updated.
- Phase 5 (UX polish): Auto-focus, auto-rename, middle-click, state isolation all implemented.
- Phase 6 (Tests): 159 tests pass, coverage thresholds met, all critical paths exercised.
- Phase 7 (Cleanup): Deprecated files deleted, build clean, no orphaned imports.

Four BAJA issues are noted. Issue #1 (tabIndex) and Issue #2 (focus after Arrow navigation)
are deviations from the WAI-ARIA Tabs pattern and from the established codebase convention
in `Tabs.tsx`, but they do not prevent functional use by keyboard users (keyboard focus still
works, just with a non-standard Tab key order). Issue #3 (missing storage.test.ts coverage
for new methods) is a test gap that does not affect runtime behavior. Issue #4 is a known
optional enhancement.

**The implementation is APPROVED. BAJA issues are recommended for a future cleanup commit.**
