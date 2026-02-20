# Local Persistence - Implementation Plan

**Feature**: Persist history, collections, and workbench state to localStorage
**Date**: 2026-02-20
**Branch**: `feature/local-persistence`
**Status**: Draft

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture Decision: Sidebar Reactivity Strategy](#architecture-decision-sidebar)
3. [Architecture Decision: Storage Layer Design](#architecture-decision-storage)
4. [Type Definitions Map](#type-definitions)
5. [Phase 1: Type Definitions and Storage Layer](#phase-1)
6. [Phase 2: Persistence Stores (Signals)](#phase-2)
7. [Phase 3: History Auto-Save Integration](#phase-3)
8. [Phase 4: Collections CRUD](#phase-4)
9. [Phase 5: Workbench State Persistence](#phase-5)
10. [Phase 6: Sidebar Islands (History + Collections)](#phase-6)
11. [Phase 7: Wire Up Load-to-Workbench Flow](#phase-7)
12. [Phase 8: Verification and Polish](#phase-8)

---

## Overview <a id="overview"></a>

### Current State

queryBox has a functional HTTP client (Preact island `HttpWorkbench.tsx` with `client:load`) that sends real requests via `fetch()`. State is managed by module-level Preact signals in `src/stores/http-store.ts`. All state is lost on page reload. The sidebar panels (Collections, History, Environments) are static Astro components showing empty-state placeholders ("No collections yet", "No history yet").

### Target State

- **History**: Every successful request is automatically saved to localStorage. The History sidebar panel displays the last 50 entries, grouped by day. Clicking an entry loads that request into the workbench.
- **Collections**: The user can save the current request with a name into a collection. Collections and their requests are displayed in the Collections sidebar panel as a tree. Clicking a saved request loads it into the workbench.
- **Workbench persistence**: The current request state (URL, method, headers, params, body) is saved to localStorage on every change and restored on page load.
- **Environments**: Out of scope for this feature. Remains as placeholder.

### Key Technical Decisions Summary

| Decision | Choice | Justification |
|----------|--------|---------------|
| Storage API | Native `localStorage` with JSON serialization | No dependencies, sufficient for single-user local app, synchronous read on load |
| Storage abstraction | Thin `StorageService` module | Centralizes serialization, error handling, key management; easy to swap to IndexedDB later |
| Sidebar reactivity | Replace sidebar content panels with Preact islands | Signals-based reactivity needed; panels are self-contained; keeps SidebarTabs.astro as static shell |
| State sharing | Module-level signals (same pattern as http-store) | Already proven in codebase; sidebar islands import same signals as workbench |
| History limit | 50 entries (FIFO) | Reasonable size for localStorage (~100KB max), good UX balance |
| Collection structure | Flat list of collections, each with flat list of requests (no folders) | KISS for MVP; CollectionItem.astro already supports this pattern |

---

## Architecture Decision: Sidebar Reactivity Strategy <a id="architecture-decision-sidebar"></a>

### The Problem

The sidebar panels (`CollectionTree.astro`, `HistoryList.astro`) are static Astro components rendered at build/SSR time. They need to display data from localStorage (client-side only) and react to changes (new history entries, new saved requests). Astro components cannot re-render after hydration.

### Options Evaluated

**Option A: Custom Elements that read localStorage directly**

- Pros: No new islands, consistent with existing sidebar Custom Elements (pm-tabs, pm-sidebar-toggle)
- Cons: Manual DOM manipulation for list rendering, no signal integration, duplicates rendering logic, hard to maintain as lists grow complex

**Option B: Replace sidebar content panels with Preact islands**

- Pros: Signal-based reactivity, same pattern as workbench, can import store signals directly, declarative rendering of lists
- Cons: Adds more JS to the client, sidebar is no longer fully static

**Option C: CustomEvent bridge from Preact to Astro (DOM-based)**

- Pros: Sidebar stays static, events trigger DOM updates
- Cons: Complex to maintain, brittle DOM selectors, no declarative rendering, essentially reimplements a rendering framework in vanilla JS

### Decision: Option B - Preact Islands for Sidebar Content

**Rationale**: The sidebar content panels (history list, collection tree) are inherently dynamic -- they must render client-side data that changes over time. Preact islands are the established pattern in this codebase for dynamic UI. The static sidebar shell (`Sidebar.astro`, `SidebarTabs.astro`) remains Astro and continues to use the `pm-tabs` Custom Element for tab switching. Only the _content_ of each tab panel becomes a Preact island.

### Architecture Diagram

```
+------------------------------------------------------------------+
|  Sidebar.astro (static shell)                                     |
|  +------------------------------------------------------------+  |
|  | SidebarTabs.astro (static, pm-tabs Custom Element)          |  |
|  | [Collections] [Environments] [History]                      |  |
|  +------------------------------------------------------------+  |
|  |                                                              |  |
|  | tabpanel-collections:                                        |  |
|  |   <CollectionPanel client:load />  <-- NEW Preact island     |  |
|  |                                                              |  |
|  | tabpanel-environments:                                       |  |
|  |   <EnvironmentList />              <-- stays .astro (static) |  |
|  |                                                              |  |
|  | tabpanel-history:                                            |  |
|  |   <HistoryPanel client:load />     <-- NEW Preact island     |  |
|  |                                                              |  |
|  +------------------------------------------------------------+  |
+------------------------------------------------------------------+

Shared state (module-level signals):
  history-store.ts  ---signals---> HistoryPanel.tsx
  collection-store.ts ---signals---> CollectionPanel.tsx
  http-store.ts <---load request--- HistoryPanel.tsx / CollectionPanel.tsx
```

### Impact on Bundle Size

Each sidebar island is small (list rendering + click handlers). They share the Preact runtime already loaded by `HttpWorkbench.tsx`. Estimated additional JS: ~3-5KB gzipped total for both islands.

---

## Architecture Decision: Storage Layer Design <a id="architecture-decision-storage"></a>

### Design

A single `StorageService` module (`src/services/storage.ts`) provides typed read/write access to localStorage. It handles:

1. **Key namespacing**: All keys prefixed with `qb:` to avoid collisions
2. **JSON serialization/deserialization**: Centralized `JSON.parse`/`JSON.stringify` with error handling
3. **Schema validation**: Type guards for runtime validation of deserialized data (localStorage can be manually edited or corrupted)
4. **Graceful degradation**: Returns defaults if localStorage is unavailable or data is corrupt

### Storage Keys

| Key | Type | Description |
|-----|------|-------------|
| `qb:history` | `HistoryEntry[]` | Array of history entries, newest first, max 50 |
| `qb:collections` | `Collection[]` | Array of collections with nested requests |
| `qb:workbench` | `RequestState` | Last workbench state (from http-store) |

### Data Size Estimates

- History (50 entries): ~50KB worst case (URL + method + status + timestamp per entry, no response body stored)
- Collections (20 collections, 10 requests each): ~40KB worst case
- Workbench state: ~5KB worst case
- Total: well under localStorage's 5-10MB limit

---

## Type Definitions Map <a id="type-definitions"></a>

New types to add in `src/types/persistence.ts`:

```
HistoryEntry {
  id: string                    // crypto.randomUUID()
  method: HttpMethod
  url: string
  status: number
  statusText: string
  timestamp: number             // Date.now() epoch ms
  requestSnapshot: RequestState // full request state for reload
}

Collection {
  id: string
  name: string
  createdAt: number
  requests: SavedRequest[]
}

SavedRequest {
  id: string
  name: string
  method: HttpMethod
  url: string
  savedAt: number
  requestSnapshot: RequestState
}
```

These types reuse `HttpMethod` and `RequestState` from `src/types/http.ts`.

---

## Phase 1: Type Definitions and Storage Layer <a id="phase-1"></a>

### Objective

Define persistence types and build the storage service abstraction.

### Prerequisites

None. This phase has no dependencies on existing runtime code.

### Detailed Tasks

1. **Create `src/types/persistence.ts`** with the types defined in the [Type Definitions Map](#type-definitions):
   - `HistoryEntry` interface
   - `SavedRequest` interface
   - `Collection` interface
   - Export all types; import `HttpMethod` and `RequestState` from `./http.ts`

2. **Create `src/services/storage.ts`** with a `StorageService` object:
   - Define constants for storage keys: `HISTORY_KEY = "qb:history"`, `COLLECTIONS_KEY = "qb:collections"`, `WORKBENCH_KEY = "qb:workbench"`
   - Implement `getItem<T>(key: string, fallback: T): T` -- wraps `localStorage.getItem` + `JSON.parse`, returns `fallback` on any error (missing key, parse failure, localStorage unavailable)
   - Implement `setItem<T>(key: string, value: T): void` -- wraps `JSON.stringify` + `localStorage.setItem`, silently catches errors (quota exceeded, etc.)
   - Implement `removeItem(key: string): void`
   - Implement domain-specific helpers:
     - `getHistory(): HistoryEntry[]` -- calls `getItem(HISTORY_KEY, [])` with runtime validation (checks array, checks each entry has required fields)
     - `setHistory(entries: HistoryEntry[]): void`
     - `getCollections(): Collection[]` -- calls `getItem(COLLECTIONS_KEY, [])` with runtime validation
     - `setCollections(collections: Collection[]): void`
     - `getWorkbenchState(): RequestState | null` -- calls `getItem(WORKBENCH_KEY, null)` with validation
     - `setWorkbenchState(state: RequestState): void`
   - Runtime validation: Use type guard functions (`isHistoryEntry`, `isCollection`, etc.) that check the shape of deserialized objects. If validation fails, return the fallback and clear the corrupt key.

3. **Create `src/services/__tests__/storage.test.ts`** (optional, if testing infrastructure exists -- currently no test runner detected, so document the test plan but do not block on it):
   - Test plan: serialization round-trip, corrupt data handling, quota exceeded handling, missing localStorage

### Affected Files

- `src/types/persistence.ts` -- **create**
- `src/services/storage.ts` -- **create**

### Applied Best Practices

- **Single Responsibility (SRP)**: Storage service only handles serialization and localStorage access; no business logic.
- **Fail Fast with graceful degradation**: Type guards validate data shape immediately on read; corrupt data returns defaults.
- **DRY**: All localStorage access goes through one module; no scattered `JSON.parse(localStorage.getItem(...))` calls.

### Completion Criteria

- [ ] `persistence.ts` compiles with `bun astro check` (no type errors)
- [ ] `storage.ts` compiles with `bun astro check`
- [ ] All domain helpers return correct fallback values when localStorage is empty
- [ ] Type guards correctly reject malformed data

### Risks and Mitigations

- Risk: Type guards too strict, rejecting valid data after minor schema changes -> Mitigation: Guards check only essential fields (id, method, url), not optional ones. Document the schema version strategy.
- Risk: localStorage unavailable in some environments (SSR, incognito with full storage) -> Mitigation: All reads/writes wrapped in try/catch with fallback.

### Complexity Estimation

Low - Pure data types and thin wrapper around a well-known browser API.

---

## Phase 2: Persistence Stores (Signals) <a id="phase-2"></a>

### Objective

Create Preact signal-based stores for history and collections that read from localStorage on initialization and write back on mutation.

### Prerequisites

Phase 1 complete (types and storage service exist).

### Detailed Tasks

1. **Create `src/stores/history-store.ts`**:
   - Import `signal` from `@preact/signals`
   - Import `StorageService` from `../services/storage`
   - Import `HistoryEntry` from `../types/persistence`
   - Define constant: `MAX_HISTORY = 50`
   - Initialize: `export const historyEntries = signal<HistoryEntry[]>(StorageService.getHistory())`
   - Implement `addHistoryEntry(entry: Omit<HistoryEntry, "id" | "timestamp">): void`:
     - Creates entry with `id: crypto.randomUUID()`, `timestamp: Date.now()`
     - Prepends to array (newest first)
     - Trims to `MAX_HISTORY` entries
     - Updates signal: `historyEntries.value = [newEntry, ...historyEntries.value].slice(0, MAX_HISTORY)`
     - Persists: `StorageService.setHistory(historyEntries.value)`
   - Implement `clearHistory(): void`:
     - Sets signal to `[]`
     - Calls `StorageService.setHistory([])`
   - Implement `removeHistoryEntry(id: string): void`:
     - Filters out entry by id
     - Updates signal and persists

2. **Create `src/stores/collection-store.ts`**:
   - Import `signal` from `@preact/signals`
   - Import `StorageService` from `../services/storage`
   - Import `Collection`, `SavedRequest` from `../types/persistence`
   - Initialize: `export const collections = signal<Collection[]>(StorageService.getCollections())`
   - Implement `createCollection(name: string): Collection`:
     - Creates with `id: crypto.randomUUID()`, `createdAt: Date.now()`, `requests: []`
     - Appends to signal array
     - Persists and returns the new collection
   - Implement `deleteCollection(id: string): void`
   - Implement `renameCollection(id: string, name: string): void`
   - Implement `saveRequestToCollection(collectionId: string, name: string, requestSnapshot: RequestState): SavedRequest`:
     - Creates `SavedRequest` with `id: crypto.randomUUID()`, `savedAt: Date.now()`
     - Extracts `method` and `url` from `requestSnapshot`
     - Pushes to the collection's `requests` array
     - Updates signal and persists
     - Returns the new saved request
   - Implement `removeRequestFromCollection(collectionId: string, requestId: string): void`
   - All mutations follow the pattern: clone -> mutate clone -> assign to signal -> persist via StorageService

3. **Helper function for signal persistence**:
   - Do NOT create a generic "auto-persist" effect at this stage. Explicit persist calls in each mutation are simpler, more predictable, and easier to debug. A generic auto-persist effect (via `effect(() => StorageService.setX(signal.value))`) would fire on initialization (writing back what was just read) and is harder to reason about with multiple signals.

### Affected Files

- `src/stores/history-store.ts` -- **create**
- `src/stores/collection-store.ts` -- **create**

### Applied Best Practices

- **KISS**: Explicit persist-on-mutate rather than magic auto-sync effects.
- **Immutable update pattern**: Always create new arrays/objects before assigning to `.value` (matches http-store pattern).
- **Single source of truth**: Signal is the runtime source; localStorage is the persistence backup. On load, signal reads from localStorage. During runtime, signal is authoritative.

### Completion Criteria

- [ ] Both stores compile with `bun astro check`
- [ ] `historyEntries` signal initializes from localStorage on module load
- [ ] `addHistoryEntry` prepends and trims to 50
- [ ] `collections` signal initializes from localStorage
- [ ] All CRUD operations update both signal and localStorage

### Risks and Mitigations

- Risk: Signal initialization runs during SSR (Astro pre-renders) where `localStorage` is undefined -> Mitigation: `StorageService.getItem` already wraps in try/catch returning fallback. Additionally, these store files are only imported by Preact `.tsx` components that use `client:load`, so they only execute in the browser. Verify this during implementation.
- Risk: Concurrent tab edits cause data loss -> Mitigation: Out of scope for MVP. Document as known limitation.

### Complexity Estimation

Low-Medium - Standard signal store pattern with persistence side-effects.

---

## Phase 3: History Auto-Save Integration <a id="phase-3"></a>

### Objective

Automatically save each successful HTTP request to the history store after `sendRequest()` completes.

### Prerequisites

Phase 1 and Phase 2 complete.

### Detailed Tasks

1. **Modify `src/services/http-client.ts`**:
   - Import `addHistoryEntry` from `../stores/history-store`
   - Import `RequestState` from `../types/http` (already available via `requestState`)
   - After a successful response (inside the `batch()` that sets `requestStatus.value = "success"`), add a call to save the history entry:
     ```
     // After setting responseState and requestStatus to success:
     addHistoryEntry({
       method: state.method,
       url: url,
       status: response.status,
       statusText: response.statusText,
       requestSnapshot: structuredClone(state),
     });
     ```
   - Note: `structuredClone(state)` creates a deep copy of the request state at the time of sending, so future edits don't affect the history entry. Since `RequestState` is a plain object (no functions, no signals), `structuredClone` works. Alternatively, use spread/JSON round-trip if `structuredClone` is not available in target browsers (it is available in all modern browsers).
   - Only save on success, not on error. Rationale: history should show completed requests the user can re-send.

2. **No changes to the UI in this phase.** The history signal will be populated but not yet displayed (sidebar island comes in Phase 6).

### Affected Files

- `src/services/http-client.ts` -- **modify** (add import + one function call after success)

### Applied Best Practices

- **Separation of Concerns**: `http-client.ts` calls `addHistoryEntry` (a store action) without knowing about persistence details. The store handles localStorage.
- **Principle of Least Surprise**: Only successful requests are saved to history (matches Postman behavior).

### Completion Criteria

- [ ] After a successful `sendRequest()`, `historyEntries` signal contains the new entry
- [ ] The entry's `requestSnapshot` is a deep copy (not a reference to the live signal)
- [ ] Failed/aborted requests do NOT create history entries
- [ ] `bun astro check` passes
- [ ] `bun build` succeeds

### Risks and Mitigations

- Risk: `structuredClone` throws on non-cloneable data -> Mitigation: `RequestState` contains only primitives, strings, and plain arrays/objects. Verify there are no signal wrappers or class instances in the cloned object.

### Complexity Estimation

Low - One import and one function call added to an existing file.

---

## Phase 4: Collections CRUD <a id="phase-4"></a>

### Objective

Enable the user to save the current request to a collection from the workbench UI. This phase adds the "Save to Collection" UI trigger; the sidebar display comes in Phase 6.

### Prerequisites

Phase 2 complete (collection-store exists).

### Detailed Tasks

1. **Create `src/components/workbench/SaveToCollectionModal.tsx`**:
   - A Preact component that renders as an overlay/modal dialog
   - UI elements:
     - Title: "Save Request"
     - Input field for request name (pre-filled with the current URL path or a sensible default)
     - Dropdown/select to choose an existing collection OR input to create a new collection
     - "Save" button (calls `saveRequestToCollection` or `createCollection` + `saveRequestToCollection`)
     - "Cancel" button (closes modal)
   - The modal is controlled by a `showSaveModal` signal (local to the modal or in a UI-state module)
   - On save: reads `requestState.value` from http-store, passes as `requestSnapshot`
   - Accessibility: focus trap within modal, Escape key closes, aria-modal, role="dialog"
   - Styling: Use existing pm-* design tokens. Overlay with `bg-black/50`, centered card with `bg-pm-bg-secondary`.

2. **Add a "Save" button to `src/components/request/RequestBar.tsx`**:
   - Add a button between the URL input and the Send button (or next to Send)
   - Icon: a bookmark/save icon (use inline SVG, consistent with existing icon patterns)
   - onClick: sets `showSaveModal.value = true`
   - The button is always visible but could be disabled when URL is empty

3. **Create `src/stores/ui-store.ts`** for UI-only transient state:
   - `export const showSaveModal = signal<boolean>(false)`
   - This store is NOT persisted to localStorage (purely transient UI state)
   - Keeping UI state separate from domain state follows SRP

4. **Integrate the modal in `HttpWorkbench.tsx`**:
   - Import and render `<SaveToCollectionModal />` at the bottom of the HttpWorkbench component
   - It renders conditionally based on `showSaveModal.value`

### Affected Files

- `src/components/workbench/SaveToCollectionModal.tsx` -- **create**
- `src/components/request/RequestBar.tsx` -- **modify** (add Save button)
- `src/stores/ui-store.ts` -- **create**
- `src/components/workbench/HttpWorkbench.tsx` -- **modify** (render modal)

### Applied Best Practices

- **Separation of Concerns**: UI state (modal visibility) separated from domain state (collections data).
- **Accessibility**: Modal follows WAI-ARIA dialog pattern: focus trap, escape to close, aria-modal="true".
- **KISS**: Simple modal inline in the island, not a generic modal system. A generic system would be YAGNI at this stage.

### Completion Criteria

- [ ] "Save" button appears in the request bar
- [ ] Clicking "Save" opens a modal with request name input and collection selector
- [ ] User can create a new collection from within the modal
- [ ] User can save a request to an existing collection
- [ ] Saving updates `collections` signal and persists to localStorage
- [ ] Modal closes after save or on cancel/escape
- [ ] Focus returns to the Save button after modal closes
- [ ] `bun astro check` passes
- [ ] `bun build` succeeds

### Risks and Mitigations

- Risk: Modal z-index conflicts with sidebar overlay -> Mitigation: Use z-60 or higher (sidebar backdrop uses z-40). Test both states.
- Risk: Focus trap implementation is complex -> Mitigation: Keep it simple -- on mount, focus the first input. On Escape or click-outside, close. Use `onKeyDown` on the overlay div. Full focus trap (Tab cycling) is a nice-to-have; implement if time permits or use the simple approach of `autofocus` + Escape handling.

### Complexity Estimation

Medium - New component with form logic, modal behavior, and accessibility.

---

## Phase 5: Workbench State Persistence <a id="phase-5"></a>

### Objective

Persist the current workbench request state to localStorage on every change and restore it on page load.

### Prerequisites

Phase 1 complete (storage service exists). Phase 2 complete (store patterns established).

### Detailed Tasks

1. **Modify `src/stores/http-store.ts`**:
   - Import `StorageService` from `../services/storage`
   - **Restore on initialization**: Change the initial value of `requestState` signal:
     ```
     const savedState = StorageService.getWorkbenchState();
     export const requestState = signal<RequestState>(savedState ?? {
       method: "GET",
       url: "",
       params: [],
       headers: [],
       body: { mode: "none", contentType: "json", raw: "" },
     });
     ```
   - **Persist on change**: Use `effect()` from `@preact/signals` to auto-persist workbench state:
     ```
     effect(() => {
       StorageService.setWorkbenchState(requestState.value);
     });
     ```
   - Why `effect()` is appropriate HERE but not for history/collections: The workbench state changes frequently via many different actions (updateUrl, updateMethod, addParam, updateHeader, updateBodyRaw, etc.). Adding `StorageService.setWorkbenchState()` to every single action function would be error-prone and violate DRY. An effect that reacts to the signal is the right tool. For history/collections, mutations are discrete and infrequent, so explicit persist is clearer.
   - **Debounce consideration**: The effect fires on every keystroke in the URL input or body editor. localStorage writes are synchronous and fast (~1ms), so debouncing is unnecessary for MVP. If performance issues arise, wrap in `setTimeout` with 300ms debounce. Document this as a future optimization.

2. **Verify SSR safety**:
   - The `effect()` call must NOT execute during SSR/build. Since `http-store.ts` is only imported by Preact components with `client:load`, it only runs in the browser. Verify by running `bun build` -- if the store is accidentally pulled into SSR, the build will fail because `localStorage` is undefined.

### Affected Files

- `src/stores/http-store.ts` -- **modify** (restore initial state from localStorage, add persist effect)

### Applied Best Practices

- **DRY**: One `effect()` replaces adding persist calls to 10+ action functions.
- **Principle of Least Surprise**: The user's work is always saved. Reloading the page restores exactly where they left off.

### Completion Criteria

- [ ] On page load, the workbench shows the last URL, method, headers, params, and body the user was editing
- [ ] Changing any field in the request updates localStorage within one tick
- [ ] If localStorage is empty (first visit), the default empty state is shown
- [ ] If localStorage contains corrupt data, the default empty state is shown (graceful degradation)
- [ ] `bun astro check` passes
- [ ] `bun build` succeeds (no SSR errors)

### Risks and Mitigations

- Risk: `effect()` fires during module evaluation in SSR -> Mitigation: Verify that store module is only imported from `client:load` components. If needed, wrap `effect()` in `if (typeof window !== "undefined")` guard.
- Risk: Rapid keystrokes cause excessive localStorage writes -> Mitigation: Acceptable for MVP. localStorage writes are ~0.1ms for small payloads. Document debounce as future optimization if profiling shows issues.

### Complexity Estimation

Low - Small changes to one existing file.

---

## Phase 6: Sidebar Islands (History + Collections) <a id="phase-6"></a>

### Objective

Convert the History and Collections sidebar panels from static Astro placeholders to Preact islands that display persisted data reactively.

### Prerequisites

Phase 2 complete (stores exist). Phase 3 complete (history is being populated). Phase 4 complete (collections CRUD works).

### Detailed Tasks

1. **Create `src/components/sidebar/HistoryPanel.tsx`** (Preact island):
   - Imports `historyEntries` from `../../stores/history-store`
   - Imports `clearHistory` from `../../stores/history-store`
   - Renders the history list:
     - If empty: show "No history yet." placeholder (same text/style as current HistoryList.astro)
     - If not empty: render entries grouped by day (Today, Yesterday, Older)
     - Each entry shows: method badge (colored span matching pm-method-* tokens), truncated URL, relative timestamp, status code
     - Method badge: Use a `<span>` with the same color classes as `Badge.astro` (e.g., `text-pm-method-get bg-pm-method-get/10`). Since Badge.astro is an Astro component and cannot be used inside Preact, create an inline helper or a small `MethodBadge.tsx` Preact component that replicates the same styling.
   - Each entry is a clickable `<button>` (for accessibility) that dispatches a custom event or calls a store action to load the request (Phase 7)
   - "Clear History" button at the top (visible when history is not empty)
   - Accessibility: entries use `role="list"` / `role="listitem"`, keyboard navigable

2. **Create `src/components/sidebar/CollectionPanel.tsx`** (Preact island):
   - Imports `collections` from `../../stores/collection-store`
   - Imports `deleteCollection`, `removeRequestFromCollection` from `../../stores/collection-store`
   - Renders collections as a tree:
     - If empty: show "No collections yet." placeholder
     - Each collection is a collapsible group (click to expand/collapse)
     - Collection header shows name + delete button (trash icon)
     - Nested requests show method badge + name, with click to load and delete button
   - "New Collection" button at the top (opens inline input for collection name)
   - Collapse/expand: Use local Preact state (`useState`) per collection item, NOT the pm-tree Custom Element (that only works with static HTML)
   - Accessibility: `role="tree"`, `role="treeitem"`, `aria-expanded`, keyboard arrow navigation for tree items

3. **Create `src/components/shared/MethodBadge.tsx`** (shared Preact component):
   - Replicates the styling logic of `Badge.astro` for method badges, usable in `.tsx` components
   - Props: `method: HttpMethod`
   - Renders: `<span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold {colorClass}">{method}</span>`
   - Color mapping: same as Badge.astro (`GET -> text-pm-method-get bg-pm-method-get/10`, etc.)

4. **Modify `src/components/sidebar/Sidebar.astro`**:
   - Replace `<CollectionTree />` with `<CollectionPanel client:load />`
   - Replace `<HistoryList />` with `<HistoryPanel client:load />`
   - Keep `<EnvironmentList />` as-is (static placeholder)
   - Import the new Preact components at the top

5. **Keep existing `.astro` sidebar item components** (`CollectionTree.astro`, `HistoryList.astro`, `CollectionItem.astro`, `HistoryItem.astro`, `RequestItem.astro`, `FolderItem.astro`):
   - Do NOT delete them yet. They may be useful as reference or for a future SSR-rendered mode.
   - They are simply no longer imported by `Sidebar.astro`.

### Affected Files

- `src/components/sidebar/HistoryPanel.tsx` -- **create**
- `src/components/sidebar/CollectionPanel.tsx` -- **create**
- `src/components/shared/MethodBadge.tsx` -- **create**
- `src/components/sidebar/Sidebar.astro` -- **modify** (swap static components for islands)

### Applied Best Practices

- **Reuse**: `MethodBadge.tsx` is a shared Preact component usable by any island that needs method badges.
- **Separation of Concerns**: Each panel is self-contained. HistoryPanel only knows about history-store; CollectionPanel only knows about collection-store.
- **Accessibility**: Tree pattern follows WAI-ARIA Treeview practices. List uses semantic roles.
- **Progressive enhancement**: If JS fails to load, the sidebar shows nothing (same as current placeholder behavior). No regression.

### Completion Criteria

- [ ] History panel shows "No history yet." when empty
- [ ] History panel renders entries after requests are sent
- [ ] Entries are grouped by day (Today, Yesterday, Older)
- [ ] Each entry shows method (colored), truncated URL, relative time, status
- [ ] "Clear History" button empties the list and localStorage
- [ ] Collection panel shows "No collections yet." when empty
- [ ] Collection panel renders collections and their requests after saving
- [ ] Collections are collapsible
- [ ] Delete collection and delete request work
- [ ] Method badges use the correct pm-method-* color tokens
- [ ] Sidebar tab switching (pm-tabs Custom Element) still works with new islands
- [ ] `bun astro check` passes
- [ ] `bun build` succeeds

### Risks and Mitigations

- Risk: `pm-tabs` Custom Element hides/shows panels with `classList.add("hidden")`, but Preact islands use `client:load` which hydrates immediately. The `hidden` class on the parent div might prevent rendering or cause layout issues -> Mitigation: `client:load` hydrates regardless of CSS visibility. The Preact component renders into its container; the parent `hidden` class just hides it visually. The `pm-tabs` Custom Element toggles the `hidden` class on `[data-panel]` divs. Verify that the Preact island root element is inside the `[data-panel]` div (it is, based on Sidebar.astro structure). No conflict expected.
- Risk: Sidebar islands increase initial JS load -> Mitigation: Consider `client:idle` instead of `client:load` for sidebar islands. The sidebar content is not immediately critical (user first interacts with the workbench). Using `client:idle` defers hydration until the main thread is idle, improving perceived load time. **Recommendation: use `client:idle` for sidebar islands.**

### Complexity Estimation

High - Two new island components with list rendering, grouping logic, tree behavior, accessibility, and integration with the existing sidebar shell.

---

## Phase 7: Wire Up Load-to-Workbench Flow <a id="phase-7"></a>

### Objective

When the user clicks a history entry or a saved collection request, load that request's state into the workbench.

### Prerequisites

Phase 5 (workbench persistence) and Phase 6 (sidebar islands) complete.

### Detailed Tasks

1. **Add `loadRequest` action to `src/stores/http-store.ts`**:
   - New function: `export function loadRequest(snapshot: RequestState): void`
   - Implementation:
     ```
     export function loadRequest(snapshot: RequestState): void {
       requestState.value = {
         ...snapshot,
         // Ensure all KeyValuePairs have unique IDs (in case of duplication)
         params: snapshot.params.map(p => ({ ...p, id: crypto.randomUUID() })),
         headers: snapshot.headers.map(h => ({ ...h, id: crypto.randomUUID() })),
       };
       // Reset response when loading a new request
       resetResponse();
     }
     ```
   - Regenerating IDs prevents potential key collisions if the same snapshot is loaded multiple times
   - Calling `resetResponse()` clears any previous response, making it clear the user needs to re-send

2. **Wire up HistoryPanel.tsx**:
   - Import `loadRequest` from `../../stores/http-store`
   - On entry click: call `loadRequest(entry.requestSnapshot)`
   - Visual feedback: briefly highlight the clicked entry (optional, use CSS transition)

3. **Wire up CollectionPanel.tsx**:
   - Import `loadRequest` from `../../stores/http-store`
   - On request click: call `loadRequest(savedRequest.requestSnapshot)`

4. **Mobile sidebar auto-close** (nice-to-have):
   - After loading a request on mobile, auto-close the sidebar so the user sees the workbench
   - Implementation: dispatch a custom event `sidebar-close` or directly toggle the sidebar's `collapsed` class
   - This matches existing sidebar behavior in `src/scripts/sidebar.ts`

### Affected Files

- `src/stores/http-store.ts` -- **modify** (add `loadRequest` function)
- `src/components/sidebar/HistoryPanel.tsx` -- **modify** (wire click handler)
- `src/components/sidebar/CollectionPanel.tsx` -- **modify** (wire click handler)

### Applied Best Practices

- **Single entry point**: All request loading goes through `loadRequest()`, regardless of source (history, collection, future import).
- **Defensive copying**: Regenerating IDs prevents subtle bugs from shared references.
- **Principle of Least Surprise**: Loading a request clears the previous response.

### Completion Criteria

- [ ] Clicking a history entry loads its URL, method, headers, params, and body into the workbench
- [ ] Clicking a collection request loads its state into the workbench
- [ ] The response panel is cleared when a request is loaded
- [ ] The loaded state persists to localStorage (via the Phase 5 effect)
- [ ] The user can send the loaded request and get a response
- [ ] `bun astro check` passes
- [ ] `bun build` succeeds

### Risks and Mitigations

- Risk: Stale `requestSnapshot` references signals instead of plain data -> Mitigation: Phase 3 already uses `structuredClone` to snapshot. Verify that `SavedRequest.requestSnapshot` is also a plain object when saved in Phase 4.

### Complexity Estimation

Low - Adding one function and two click handlers.

---

## Phase 8: Verification and Polish <a id="phase-8"></a>

### Objective

End-to-end verification, edge case handling, and final polish.

### Prerequisites

All previous phases complete.

### Detailed Tasks

1. **End-to-end manual testing checklist**:
   - [ ] Open queryBox fresh (empty localStorage) -- workbench shows default empty state, sidebar shows "No history/collections yet"
   - [ ] Enter a URL and send a request -- history entry appears in sidebar
   - [ ] Send 3 more requests -- history shows 4 entries, newest first
   - [ ] Click a history entry -- workbench loads that request, response clears
   - [ ] Press Send again -- request fires, new history entry added
   - [ ] Click "Save" in request bar -- modal opens
   - [ ] Create a new collection "My APIs" and save the request -- collection appears in sidebar
   - [ ] Save another request to the same collection -- it appears nested
   - [ ] Click a saved collection request -- workbench loads it
   - [ ] Reload the page -- workbench restores last state, history and collections persist
   - [ ] Clear history -- sidebar shows empty state, localStorage key removed
   - [ ] Delete a collection -- removed from sidebar and localStorage
   - [ ] Delete a request from a collection -- removed from collection
   - [ ] Test with localStorage quota exceeded (fill localStorage, try to save) -- no errors thrown, app continues working
   - [ ] Test in mobile viewport -- sidebar islands render correctly, modal is usable

2. **Edge cases to handle**:
   - Very long URLs in history/collection items: ensure `truncate` CSS class is applied
   - Empty collection name: validate, show inline error, prevent save
   - Empty request name: use URL as fallback name
   - Duplicate collection names: allow (they have unique IDs)
   - History with 50+ entries: verify FIFO trim works

3. **Performance verification**:
   - Run `bun build` and check bundle sizes
   - Verify sidebar islands are separate chunks (Astro's island architecture handles this)
   - Check that `client:idle` defers sidebar hydration (if applied per Phase 6 recommendation)

4. **Code cleanup**:
   - Remove any unused imports
   - Ensure consistent code style with existing files (semicolons, 2-space indent, etc.)
   - Run `bun astro check` for final type verification

### Affected Files

- No new files. Potential minor fixes across files from previous phases.

### Applied Best Practices

- **Testing**: Comprehensive manual test matrix covering happy path, edge cases, and error scenarios.
- **Performance**: Bundle size awareness, deferred hydration for non-critical islands.

### Completion Criteria

- [ ] All manual test cases pass
- [ ] `bun astro check` reports zero errors
- [ ] `bun build` succeeds with no warnings related to this feature
- [ ] No console errors during normal usage
- [ ] localStorage data survives page reloads correctly

### Risks and Mitigations

- Risk: Integration issues between phases discovered late -> Mitigation: Run `bun astro check` and `bun build` at the end of every phase, not just Phase 8.

### Complexity Estimation

Low - Testing and polish, no new architecture.

---

## Dependency Graph

```
Phase 1 (Types + Storage)
  |
  +---> Phase 2 (Stores: history-store, collection-store)
  |       |
  |       +---> Phase 3 (History auto-save in http-client.ts)
  |       |
  |       +---> Phase 4 (Collections CRUD + Save modal)
  |       |
  |       +---> Phase 6 (Sidebar islands: HistoryPanel, CollectionPanel)
  |                |
  +---> Phase 5 (Workbench persistence in http-store.ts)
          |
          +---> Phase 7 (Load-to-workbench flow)
                  |
                  +---> Phase 8 (Verification + Polish)
```

Phases 3, 4, 5 can be implemented in parallel after Phase 2 is complete.
Phase 6 depends on Phase 2 (stores exist) and benefits from Phase 3/4 (data to display).
Phase 7 depends on Phase 5 (persistence effect) and Phase 6 (click targets).
Phase 8 is always last.

---

## File Change Summary

| File | Action | Phase |
|------|--------|-------|
| `src/types/persistence.ts` | create | 1 |
| `src/services/storage.ts` | create | 1 |
| `src/stores/history-store.ts` | create | 2 |
| `src/stores/collection-store.ts` | create | 2 |
| `src/services/http-client.ts` | modify | 3 |
| `src/components/workbench/SaveToCollectionModal.tsx` | create | 4 |
| `src/components/request/RequestBar.tsx` | modify | 4 |
| `src/stores/ui-store.ts` | create | 4 |
| `src/components/workbench/HttpWorkbench.tsx` | modify | 4 |
| `src/stores/http-store.ts` | modify | 5, 7 |
| `src/components/sidebar/HistoryPanel.tsx` | create | 6 |
| `src/components/sidebar/CollectionPanel.tsx` | create | 6 |
| `src/components/shared/MethodBadge.tsx` | create | 6 |
| `src/components/sidebar/Sidebar.astro` | modify | 6 |

**Total**: 9 new files, 5 modified files, 0 deleted files.

---

## Known Limitations (Out of Scope)

1. **Environments**: Not part of this feature. EnvironmentList.astro remains a static placeholder.
2. **Multi-tab sync**: Changes in one browser tab are not reflected in another. A `storage` event listener could solve this in a future iteration.
3. **Export/Import**: No ability to export collections as JSON or import Postman collections. Future feature.
4. **Folders in collections**: Collections contain a flat list of requests. Folder hierarchy is a future enhancement.
5. **Search/filter**: No search within history or collections. Future feature.
6. **Response body in history**: History entries store the request snapshot but NOT the response body (to save space). The user must re-send to see the response.
