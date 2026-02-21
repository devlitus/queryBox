# Add Requests - Implementation Plan

## Overview

Enable users to create multiple request tabs by clicking the plus (+) button in the TabBar. Each tab represents an independent HTTP request with its own state (method, URL, params, headers, body). Switching tabs restores the full request context. Tabs persist across page reloads via localStorage.

## Current Architecture Analysis

### What exists today

- **TabBar.astro**: Static Astro component rendering one hardcoded `<TabItem name="New Request" isActive={true} />` and a plus button with no event handler.
- **TabItem.astro**: Static Astro component displaying method badge, name, modified indicator, and close button -- no interactivity.
- **http-store.ts**: Single `requestState` signal representing ONE request. All request/response panels read from this single signal.
- **StorageService**: Persists one workbench state under key `qb:workbench`.
- **Workbench.astro**: Renders `<TabBar />` (static Astro) above `<HttpWorkbench client:load />` (Preact island).

### Architectural gap

There is no concept of "multiple requests" in the current state model. The TabBar is server-rendered and cannot react to user actions. To support multiple tabs, we need:

1. A **tab store** managing an array of tab descriptors (id, name, method, request state).
2. The TabBar must become a **Preact island** so it can render dynamically.
3. The http-store must load/save state **per active tab** rather than from a single global signal.
4. Persistence must handle an array of tabs, not a single workbench state.

## Architecture Decision

### Alternative A: Keep TabBar as Astro + Custom Element

- Pros: No new Preact island, lighter JS.
- Cons: Custom Elements cannot easily read Preact signals; requires duplicating state sync logic; DOM manipulation for adding/removing tabs is fragile; breaks the established pattern where interactive state lives in Preact islands.

### Alternative B (CHOSEN): Convert TabBar to a Preact island

- Pros: Consistent with existing architecture (HttpWorkbench, sidebar panels are already Preact islands); tabs can directly read/write signals; straightforward state management; composable with existing stores.
- Cons: Slightly more JS shipped. Negligible given that the workbench island already loads Preact.

**Justification**: The project already uses Preact islands for all interactive UI. Adding another Custom Element for tab management would create a second state management paradigm (DOM + events vs signals). Consistency and maintainability favor Preact.

---

## Phase 1: Tab Store and Types

### Objective

Create the data model and reactive store for managing multiple request tabs.

### Prerequisites

None -- this is the foundation phase.

### Detailed Tasks

1. **Define tab types** in `src/types/http.ts`:
   - Add a `Tab` interface:
     ```
     interface Tab {
       id: string;              // crypto.randomUUID()
       name: string;            // Display name, default "New Request"
       request: RequestState;   // Full request state for this tab
       response: ResponseState | null;
       requestStatus: RequestStatus;
       requestError: HttpError | null;
       isDirty: boolean;        // Whether the tab has unsaved modifications
     }
     ```

2. **Create tab store** at `src/stores/tab-store.ts`:
   - `tabs` signal: `Signal<Tab[]>` -- array of all open tabs.
   - `activeTabId` signal: `Signal<string>` -- ID of the currently active tab.
   - `activeTab` computed: derives the active Tab object from `tabs` and `activeTabId`.
   - **Actions**:
     - `createTab()`: Creates a new tab with default empty RequestState, appends to `tabs`, sets it as active. Returns the new tab's ID.
     - `closeTab(id)`: Removes the tab. If closing the active tab, activates the nearest neighbor. If it's the last tab, creates a fresh default tab first (there must always be at least one tab).
     - `switchTab(id)`: Sets `activeTabId` to the given ID.
     - `updateActiveTabRequest(partial)`: Merges partial RequestState into the active tab's request field. Sets `isDirty = true`.
     - `updateActiveTabResponse(response, status, error)`: Updates the active tab's response/status/error fields.
     - `renameTab(id, name)`: Updates the tab's display name.
   - **Default empty request state** extracted as a constant:
     ```
     const DEFAULT_REQUEST: RequestState = {
       method: "GET", url: "", params: [], headers: [],
       body: { mode: "none", contentType: "json", raw: "" }
     };
     ```
   - **Initialization**: On module load, read persisted tabs from StorageService. If none found, create one default tab.

3. **Helper**: `createDefaultTab()` function that returns a new Tab with a unique ID, name "New Request", and the default empty request state.

### Affected Files

- `src/types/http.ts` -- modify (add `Tab` interface)
- `src/stores/tab-store.ts` -- create

### Applied Best Practices

- **Single Responsibility (SRP)**: Tab management is its own store, separate from HTTP execution logic.
- **DRY**: Default request state is a shared constant, not duplicated.
- **Type Safety**: Full TypeScript interfaces for all tab data.

### Completion Criteria

- [ ] `Tab` interface defined and exported from `src/types/http.ts`
- [ ] `tab-store.ts` exports `tabs`, `activeTabId`, `activeTab`, and all action functions
- [ ] `createTab()` generates unique IDs via `crypto.randomUUID()`
- [ ] `closeTab()` prevents closing the last tab (creates a new default tab first)
- [ ] `switchTab()` updates `activeTabId`
- [ ] Module initializes with one default tab if no persisted data exists

### Risks and Mitigations

- Risk: Module-level signal initialization runs at import time on SSR. Mitigation: This module will only be imported by `client:load` islands, same pattern as http-store.ts.
- Risk: ID collisions with crypto.randomUUID(). Mitigation: UUID v4 collision probability is negligible; this is the same pattern used throughout the codebase.

### Complexity Estimation

Medium -- New store with multiple actions, but follows established patterns from http-store.ts and collection-store.ts.

---

## Phase 2: Persistence for Tabs

### Objective

Persist the tab array and active tab ID to localStorage so tabs survive page reloads.

### Prerequisites

Phase 1 completed.

### Detailed Tasks

1. **Add storage keys** to `src/services/storage.ts`:
   - `qb:tabs` -- stores the serialized Tab array.
   - `qb:active-tab` -- stores the active tab ID string.

2. **Add type guard** `isTab(value)` in `src/services/storage.ts`:
   - Validates essential fields: id (string), name (string), request (passes `isRequestState`).

3. **Add StorageService methods**:
   - `getTabs(): Tab[]` -- reads and validates `qb:tabs`. Returns `[]` if corrupt.
   - `setTabs(tabs: Tab[]): void` -- serializes tabs to `qb:tabs`.
   - `getActiveTabId(): string | null` -- reads `qb:active-tab`.
   - `setActiveTabId(id: string): void` -- writes `qb:active-tab`.

4. **Add persistence effect** in `src/stores/tab-store.ts`:
   - Use `effect()` to auto-persist `tabs` and `activeTabId` on every change (same pattern as the existing workbench state persistence in http-store.ts).

5. **Migrate legacy data**: If `qb:workbench` exists but `qb:tabs` does not, create a single tab from the legacy workbench state, then remove `qb:workbench`. This ensures existing users don't lose their work.

6. **Storage limit**: Cap maximum open tabs at 20. The `createTab()` action should check this limit and no-op (or show a notification) if exceeded. Each tab stores a full RequestState plus response body, so 20 tabs keeps localStorage well under the 5 MB quota.

### Affected Files

- `src/services/storage.ts` -- modify (add keys, type guard, methods)
- `src/stores/tab-store.ts` -- modify (add persistence effects, migration logic)

### Applied Best Practices

- **Backward Compatibility**: Migration from `qb:workbench` to `qb:tabs` preserves existing user data.
- **Fail Fast**: Type guards reject corrupt data and reset to defaults.
- **KISS**: Auto-persist via `effect()` rather than manual persist calls in each action.

### Completion Criteria

- [ ] `StorageService` has `getTabs`, `setTabs`, `getActiveTabId`, `setActiveTabId` methods
- [ ] Type guard `isTab` validates essential fields
- [ ] `tab-store.ts` persists on every signal change via `effect()`
- [ ] Legacy `qb:workbench` data is migrated to a single tab in `qb:tabs`
- [ ] Maximum 20 tabs enforced in `createTab()`

### Risks and Mitigations

- Risk: Large response bodies could push localStorage near quota. Mitigation: Cap at 20 tabs; response bodies can be excluded from persistence (only persist request state, not response). This is the recommended approach -- responses are ephemeral.
- Risk: Migration runs on every page load if not gated. Mitigation: Only run migration when `qb:tabs` key does not exist AND `qb:workbench` does exist; remove `qb:workbench` after migration.

### Complexity Estimation

Medium -- Follows existing StorageService patterns closely. Migration logic adds slight complexity.

---

## Phase 3: Refactor http-store to be Tab-Aware

### Objective

Make http-store read/write the active tab's request and response state instead of its own standalone signals.

### Prerequisites

Phase 1 and Phase 2 completed.

### Detailed Tasks

1. **Remove standalone signals** from `src/stores/http-store.ts`:
   - Remove `requestState`, `responseState`, `requestStatus`, `requestError` signals.
   - Remove the `effect()` that persists `requestState` to `qb:workbench`.

2. **Create computed proxies** that delegate to the active tab:
   - `requestState = computed(() => activeTab.value?.request ?? DEFAULT_REQUEST)`
   - `responseState = computed(() => activeTab.value?.response ?? null)`
   - `requestStatus = computed(() => activeTab.value?.requestStatus ?? "idle")`
   - `requestError = computed(() => activeTab.value?.requestError ?? null)`

   These computed signals preserve the same public API (`requestState.value`, etc.) so all existing consumers (RequestBar, RequestPanel, ResponsePanel, etc.) continue to work without changes.

3. **Update action functions** (`updateMethod`, `updateUrl`, `addParam`, etc.) to write through the tab store:
   - Each action calls `updateActiveTabRequest({ ...changes })` from tab-store instead of directly mutating `requestState.value`.
   - Example: `updateMethod(method)` calls `updateActiveTabRequest({ method })`.

4. **Update response-writing actions** (`resetResponse` and the response-setting logic in `http-client.ts`) to call `updateActiveTabResponse()` from tab-store.

5. **Preserve all computed signals** (`enabledParams`, `enabledHeaders`, `fullUrl`, `formattedSize`, `statusColorClass`) -- these already derive from `requestState` and will work automatically since `requestState` is now a computed that reads from the active tab.

6. **Update `loadRequest(snapshot)`** to call `updateActiveTabRequest(snapshot)` instead of directly setting `requestState.value`.

### Affected Files

- `src/stores/http-store.ts` -- major modify (signals become computed proxies, actions delegate to tab-store)
- `src/services/http-client.ts` -- minor modify (response writing goes through tab-store)

### Applied Best Practices

- **Open/Closed Principle (OCP)**: The public API of http-store does not change; consumers are unaffected.
- **Separation of Concerns**: Tab management stays in tab-store; HTTP logic stays in http-store. http-store simply delegates storage to the active tab.
- **DRY**: No duplication of request state management logic.

### Completion Criteria

- [ ] `requestState`, `responseState`, `requestStatus`, `requestError` are now computed signals deriving from the active tab
- [ ] All action functions in http-store delegate writes to tab-store
- [ ] All existing consumers (RequestBar, RequestPanel, ResponsePanel, etc.) work without any changes
- [ ] `loadRequest()` updates the active tab
- [ ] No standalone persistence effect for `qb:workbench` remains (persistence is handled by tab-store)

### Risks and Mitigations

- Risk: Breaking existing consumers that write to `requestState.value` directly. Mitigation: Grep the codebase for direct `.value =` assignments to ensure all are converted to action function calls. The current codebase already uses action functions exclusively.
- Risk: Computed signals are read-only; code that assigns to them will fail at runtime. Mitigation: TypeScript will catch `computed.value = ...` at compile time since `computed` returns `ReadonlySignal`.

### Complexity Estimation

High -- This is the core refactoring. Every action function must be updated, and the interaction between tab-store and http-store must be carefully designed to avoid circular dependencies.

---

## Phase 4: TabBar Preact Island

### Objective

Replace the static Astro TabBar with a dynamic Preact component that renders tabs from the tab store and handles user interactions (add, close, switch tabs).

### Prerequisites

Phase 1, Phase 2, and Phase 3 completed.

### Detailed Tasks

1. **Create `src/components/workbench/TabBar.tsx`** (Preact component):
   - Import `tabs`, `activeTabId`, `createTab`, `closeTab`, `switchTab` from tab-store.
   - Render the tab list by mapping over `tabs.value`.
   - Each tab item shows:
     - Method badge (using `MethodBadge.tsx` from shared components, or inline logic matching Badge.astro colors).
     - Tab name (truncated with `text-ellipsis` if too long, max-width ~200px).
     - Modified indicator dot (when `isDirty === true`).
     - Close button (calls `closeTab(tab.id)`).
   - Active tab styling: `bg-pm-bg-primary border-b-2 border-b-pm-accent`.
   - Inactive tab styling: `bg-pm-bg-secondary hover:bg-pm-bg-elevated`.
   - Clicking a tab calls `switchTab(tab.id)`.
   - Plus button at the end calls `createTab()`.
   - The tab container should be horizontally scrollable (`overflow-x-auto`) for many tabs.
   - Plus button should remain fixed/visible even when tabs overflow.

2. **Create `src/components/workbench/TabBarItem.tsx`** (Preact sub-component):
   - Receives tab data as props: `id`, `name`, `method`, `isActive`, `isDirty`.
   - Renders the visual tab with badge, name, dot, close button.
   - Close button should use `e.stopPropagation()` to prevent triggering tab switch.

3. **Update `src/components/workbench/Workbench.astro`**:
   - Replace `<TabBar />` (Astro) with the new Preact TabBar: `<TabBar client:load />`.
   - Remove the static import of TabBar.astro.

4. **Retain `TabBar.astro` and `TabItem.astro`** as deprecated/unused files for now, or delete them since they are fully replaced.

5. **Keyboard accessibility**:
   - Tab items should be focusable (`tabindex`).
   - Arrow Left/Right to navigate between tabs.
   - Enter/Space to activate a tab.
   - The plus button should be reachable via Tab key.
   - Close button should have `aria-label="Close tab {name}"`.

6. **Import the plus icon**: Use the same SVG from `src/assets/icons/plus.svg` but import it inline in the TSX (as a raw string via `?raw` or as an inline SVG element).
   - Note: Astro's `?raw` import works in .tsx files through Vite. Alternatively, define the SVG inline in JSX.

### Affected Files

- `src/components/workbench/TabBar.tsx` -- create
- `src/components/workbench/TabBarItem.tsx` -- create
- `src/components/workbench/Workbench.astro` -- modify (swap TabBar import)
- `src/components/workbench/TabBar.astro` -- delete (replaced by .tsx)
- `src/components/workbench/TabItem.astro` -- delete (replaced by TabBarItem.tsx)

### Applied Best Practices

- **Component Composition**: TabBar delegates item rendering to TabBarItem (SRP).
- **Accessibility**: Full keyboard navigation following WAI-ARIA Tabs pattern.
- **Principle of Least Surprise**: Tabs look and behave like existing static tabs but now respond to clicks.
- **Performance**: Tab list re-renders only when `tabs` or `activeTabId` signals change.

### Completion Criteria

- [ ] Clicking the plus (+) button creates a new tab and activates it
- [ ] Clicking a tab switches to it and loads its request state into the workbench
- [ ] Clicking the close (x) button removes the tab
- [ ] Cannot close the last remaining tab (a new default tab is created automatically)
- [ ] Active tab has distinct visual styling (bottom accent border)
- [ ] Tabs are horizontally scrollable when they overflow
- [ ] Keyboard navigation works (Arrow keys, Enter, Space)
- [ ] All interactive elements have appropriate ARIA labels

### Risks and Mitigations

- Risk: Plus icon SVG import may not work with `?raw` in .tsx files. Mitigation: Use inline SVG as JSX, which is the standard pattern in the existing Preact components (see RequestBar.tsx which uses inline SVGs).
- Risk: Many tabs could overflow the container width. Mitigation: `overflow-x-auto` with the plus button positioned outside the scrollable area using flex layout (`flex-shrink-0`).

### Complexity Estimation

Medium -- Straightforward Preact component following existing patterns. The keyboard navigation adds some complexity.

---

## Phase 5: Integration and Tab-Switching UX

### Objective

Ensure smooth UX when switching between tabs, including proper state isolation and visual feedback.

### Prerequisites

All previous phases completed.

### Detailed Tasks

1. **Tab switching behavior**:
   - When the user switches tabs, the workbench (RequestBar, RequestConfigTabs, ResponsePanel) should instantly reflect the new tab's state.
   - Since http-store's signals are now computed from the active tab, switching `activeTabId` automatically updates all downstream components. Verify this works end-to-end.

2. **New tab UX**:
   - When a new tab is created, it should be immediately active.
   - The URL input should be focused (auto-focus) so the user can start typing right away.
   - Tab name defaults to "New Request". Consider updating the tab name to the URL hostname once the user enters a URL (e.g., "jsonplaceholder.typicode.com") -- but ONLY as a display hint, not overwriting a user-renamed tab.

3. **Tab name auto-update**:
   - When a request is sent and a response is received, if the tab name is still "New Request", auto-update it to the URL's hostname or pathname (truncated).
   - If the user has manually renamed the tab, do NOT auto-update.

4. **Close tab confirmation** (optional enhancement, LOW priority):
   - If a tab has `isDirty === true` and the user clicks close, consider showing a confirmation. For MVP, skip this -- just close immediately. Document as a future enhancement.

5. **Middle-click to close** (optional):
   - Listen for `mousedown` event with `button === 1` (middle click) on tab items to close them. This is standard browser tab behavior.

6. **Visual scroll indicator**:
   - When tabs overflow, consider adding a subtle gradient fade on the edges to indicate scrollability.

### Affected Files

- `src/components/workbench/TabBar.tsx` -- modify (middle-click, scroll indicators)
- `src/components/workbench/TabBarItem.tsx` -- modify (middle-click handler)
- `src/stores/tab-store.ts` -- modify (tab name auto-update logic)
- `src/stores/http-store.ts` -- possible minor modify (hook for auto-naming after response)

### Applied Best Practices

- **Principle of Least Surprise**: Tab behavior matches what users expect from browser tabs and tools like Postman.
- **YAGNI**: Close confirmation is deferred to a future iteration.
- **Progressive Enhancement**: Core functionality (add/switch/close) works first; polish (auto-naming, middle-click) is layered on.

### Completion Criteria

- [ ] Switching tabs immediately updates the entire workbench (request bar, config tabs, response panel)
- [ ] New tabs are auto-focused on the URL input
- [ ] Tab names auto-update to URL hostname after first request (unless manually renamed)
- [ ] Middle-click on a tab closes it
- [ ] No state leaks between tabs (each tab's request/response is fully isolated)

### Risks and Mitigations

- Risk: Auto-focus on URL input when creating a new tab might not work if the input is in a different Preact island. Mitigation: Use a signal (e.g., `shouldFocusUrl` in ui-store) that RequestBar reads to trigger focus via `useEffect`.
- Risk: Tab name auto-update could be confusing if it changes unexpectedly. Mitigation: Only auto-update if name is exactly "New Request" (the default); any user edit disables auto-naming.

### Complexity Estimation

Low-Medium -- Most of this is UX polish on top of the core infrastructure from previous phases.

---

## Phase 6: Tests

### Objective

Add unit tests for the new tab store and updated http-store.

### Prerequisites

All previous phases completed. Vitest is already configured in the project.

### Detailed Tasks

1. **Create `src/stores/tab-store.test.ts`**:
   - Test `createTab()`: creates tab with unique ID, default name, empty request state.
   - Test `closeTab()`: removes tab, activates neighbor. Cannot close last tab.
   - Test `switchTab()`: updates `activeTabId`.
   - Test `updateActiveTabRequest()`: modifies only the active tab's request.
   - Test `renameTab()`: updates the tab's name.
   - Test max tab limit (20): `createTab()` is no-op when limit reached.
   - Use `vi.resetModules()` before each test (module-level signal pattern).

2. **Update `src/stores/http-store.test.ts`**:
   - Verify that `requestState` computed signal reflects the active tab's request.
   - Verify that action functions (updateMethod, updateUrl, etc.) modify the active tab.
   - Verify `loadRequest()` updates the active tab.

3. **Test persistence** (mock localStorage):
   - Verify tabs are persisted on change.
   - Verify tabs are restored from localStorage on module init.
   - Verify legacy `qb:workbench` migration.

### Affected Files

- `src/stores/tab-store.test.ts` -- create
- `src/stores/http-store.test.ts` -- modify

### Applied Best Practices

- **Test Isolation**: `vi.resetModules()` ensures each test starts with fresh signal state.
- **Test Coverage**: Focus on business logic (store actions, persistence, migration), not UI rendering.

### Completion Criteria

- [ ] All tab-store actions have at least one test
- [ ] Persistence and migration are tested
- [ ] Updated http-store tests pass with the new computed-signal architecture
- [ ] `bun test` passes with no failures
- [ ] Coverage for `tab-store.ts` >= 70%

### Risks and Mitigations

- Risk: Existing http-store tests may break due to refactoring. Mitigation: Update tests in the same phase as the store refactoring, not after.

### Complexity Estimation

Medium -- Significant number of test cases, but follows established testing patterns.

---

## Phase 7: Cleanup and Verification

### Objective

Remove deprecated files, verify build, and ensure everything works end-to-end.

### Prerequisites

All previous phases completed and tests passing.

### Detailed Tasks

1. **Delete deprecated files**:
   - `src/components/workbench/TabBar.astro`
   - `src/components/workbench/TabItem.astro`

2. **Remove legacy persistence code**:
   - Remove `getWorkbenchState()` and `setWorkbenchState()` from StorageService (if no longer used after migration).
   - Or keep them temporarily for the migration path and mark with a `@deprecated` JSDoc.

3. **Run verification commands**:
   - `bun astro check` -- TypeScript/Astro validation
   - `bun build` -- production build
   - `bun test` -- all tests pass

4. **Manual smoke test checklist**:
   - Open app, verify one default tab exists.
   - Click plus, verify new tab appears and is active.
   - Enter a URL in tab 1, switch to tab 2, verify URL input is empty.
   - Switch back to tab 1, verify URL is restored.
   - Send a request in tab 1, verify response shows.
   - Switch to tab 2, verify response panel is empty.
   - Close a tab, verify it's removed and neighbor is activated.
   - Reload page, verify all tabs are restored.
   - Open app in a fresh browser/incognito, verify one default tab appears.

### Affected Files

- `src/components/workbench/TabBar.astro` -- delete
- `src/components/workbench/TabItem.astro` -- delete
- `src/services/storage.ts` -- possible modify (deprecate old methods)

### Completion Criteria

- [ ] `bun astro check` passes with no errors
- [ ] `bun build` succeeds
- [ ] `bun test` passes with no failures
- [ ] All smoke test scenarios pass manually
- [ ] No orphaned imports or dead code

### Risks and Mitigations

- Risk: Deleting .astro files that are imported elsewhere. Mitigation: Grep for `TabBar.astro` and `TabItem.astro` imports before deleting.

### Complexity Estimation

Low -- Cleanup and verification only.

---

## Dependency Graph

```
Phase 1 (Tab Store + Types)
   |
   v
Phase 2 (Persistence)
   |
   v
Phase 3 (Refactor http-store)
   |
   v
Phase 4 (TabBar Preact Island)
   |
   v
Phase 5 (Integration & UX Polish)
   |
   v
Phase 6 (Tests)
   |
   v
Phase 7 (Cleanup & Verification)
```

All phases are sequential. Each phase depends on the previous one being complete.

## Summary

| Phase | Description | Complexity | Files Changed |
|-------|-------------|-----------|---------------|
| 1 | Tab store and types | Medium | 2 (1 modify, 1 create) |
| 2 | Persistence for tabs | Medium | 2 (both modify) |
| 3 | Refactor http-store | High | 2 (both modify) |
| 4 | TabBar Preact island | Medium | 5 (2 create, 1 modify, 2 delete) |
| 5 | Integration & UX polish | Low-Medium | 4 (all modify) |
| 6 | Tests | Medium | 2 (1 create, 1 modify) |
| 7 | Cleanup & verification | Low | 3 (2 delete, 1 modify) |

**Total estimated scope**: ~10-12 files touched, 2-3 new files created, 2 files deleted.
