# Code Review Report

## Feature: Local Persistence (History, Collections, Workbench State)
## Plan: `docs/local-persistence/local-persistence-plan.md`
## Date: 2026-02-20
## Status: REJECTED (NO APROBADO)

---

### Summary

Reviewed 14 files (9 new, 5 modified) against the implementation plan. The overall architecture and code quality are excellent. The storage layer, signal-based stores, workbench persistence, and save-to-collection modal are all well-implemented and match the plan closely. The build passes (`bun astro check`: 0 errors, `bun run build`: success at 1.44s).

However, one critical HTML validity bug was found that must be fixed before approval: a nested `<button>` inside another `<button>` in `HistoryPanel.tsx`. Additionally, the plan's explicit requirement for keyboard arrow navigation in the collection tree is not implemented, and `aria-level` is missing from tree items, both of which are MEDIA-level issues.

---

### Plan Compliance Checklist

#### Phase 1 - Type Definitions and Storage Layer
- [x] `src/types/persistence.ts` created with `HistoryEntry`, `SavedRequest`, `Collection` interfaces
- [x] Types import `HttpMethod` and `RequestState` from `./http.ts`
- [x] `src/services/storage.ts` created with `StorageService` object
- [x] Storage keys namespaced with `qb:` prefix (`qb:history`, `qb:collections`, `qb:workbench`)
- [x] Generic `getItem<T>`, `setItem<T>`, `removeItem` implemented with try/catch
- [x] Domain helpers: `getHistory`, `setHistory`, `getCollections`, `setCollections`, `getWorkbenchState`, `setWorkbenchState`
- [x] Type guards implemented: `isRequestState`, `isHistoryEntry`, `isCollection`
- [x] Corrupt data cleared and fallback returned on validation failure

#### Phase 2 - Persistence Stores (Signals)
- [x] `src/stores/history-store.ts` created, initializes from `StorageService.getHistory()`
- [x] `addHistoryEntry` prepends, trims to 50, persists
- [x] `clearHistory` and `removeHistoryEntry` implemented
- [x] `src/stores/collection-store.ts` created, initializes from `StorageService.getCollections()`
- [x] `createCollection`, `deleteCollection`, `renameCollection` implemented
- [x] `saveRequestToCollection`, `removeRequestFromCollection` implemented
- [x] All mutations follow clone -> mutate -> assign to signal -> persist pattern
- [x] No auto-persist effect (explicit persist per mutation, as specified)

#### Phase 3 - History Auto-Save Integration
- [x] `src/services/http-client.ts` modified with `addHistoryEntry` import
- [x] `addHistoryEntry` called after successful response (after `batch()` sets status to "success")
- [x] `structuredClone(state)` used for deep copy of request snapshot
- [x] Failed/aborted requests do NOT create history entries

#### Phase 4 - Collections CRUD
- [x] `src/stores/ui-store.ts` created with `showSaveModal = signal<boolean>(false)`
- [x] `src/components/workbench/SaveToCollectionModal.tsx` created
- [x] Modal has title, request name input, collection selector, new collection input
- [x] Save and Cancel buttons implemented
- [x] Validation: empty request name and empty collection name are caught with inline errors
- [x] `structuredClone(requestState.value)` used when saving to collection
- [x] Modal closes on Cancel, Save, and Escape key
- [x] Focus restored to trigger button on close
- [x] `aria-modal="true"`, `role="dialog"`, `aria-labelledby` implemented
- [x] Save button added to `RequestBar.tsx` with bookmark icon
- [x] Save button disabled when URL is empty
- [x] `SaveToCollectionModal` rendered inside `HttpWorkbench.tsx`
- [ ] Focus returns to Save button after modal closes - PARTIAL: triggerButtonRef stores `document.activeElement` on open, restores on close. Works correctly for keyboard users. Acceptable.

#### Phase 5 - Workbench State Persistence
- [x] `src/stores/http-store.ts` modified with `StorageService` import
- [x] `requestState` initializes from `StorageService.getWorkbenchState()` with fallback to default
- [x] `effect()` auto-persists `requestState` to localStorage on every change
- [x] SSR safety: build passes, store only imported by `client:load` island

#### Phase 6 - Sidebar Islands
- [x] `src/components/sidebar/HistoryPanel.tsx` created as Preact island
- [x] Empty state: "No history yet." shown when empty
- [x] Entries grouped by day: Today, Yesterday, Older
- [x] Each entry shows: method badge (colored), truncated URL, relative time, status code
- [x] "Clear History" button at top when history not empty
- [x] Per-entry delete button implemented
- [x] `src/components/sidebar/CollectionPanel.tsx` created as Preact island
- [x] Empty state: "No collections yet." shown when empty
- [x] Collections are collapsible (expand/collapse toggle with chevron)
- [x] Collection header with name and delete button
- [x] Nested requests with method badge, name, delete button
- [x] "New Collection" inline input with Enter/Escape keyboard handling
- [x] `src/components/shared/MethodBadge.tsx` created with pm-method-* tokens
- [x] `src/components/sidebar/Sidebar.astro` modified to use `CollectionPanel client:idle` and `HistoryPanel client:idle`
- [x] Old static components (`CollectionTree`, `HistoryList`) are no longer imported
- [x] `client:idle` used as recommended by plan (not `client:load`)
- [ ] `role="list"` / `role="listitem"` on history entries - IMPLEMENTED
- [ ] Keyboard arrow navigation for tree items - NOT IMPLEMENTED (see Issue #3)
- [ ] `aria-level` on tree items - NOT IMPLEMENTED (see Issue #2)

#### Phase 7 - Load-to-Workbench Flow
- [x] `loadRequest` function added to `src/stores/http-store.ts`
- [x] `loadRequest` regenerates all KeyValuePair IDs to avoid key collisions
- [x] `loadRequest` calls `resetResponse()` to clear previous response
- [x] `HistoryPanel.tsx` wired: click calls `loadRequest(entry.requestSnapshot)`
- [x] `CollectionPanel.tsx` wired: click calls `loadRequest(req.requestSnapshot)`

#### Phase 8 - Verification and Polish
- [x] `bun astro check`: 0 errors, 0 warnings (1 pre-existing hint in `dropdown.ts`)
- [x] `bun run build`: successful (1.44s)
- [x] No unused imports detected
- [x] Consistent code style (2-space indent, semicolons)

---

### Issues Found

#### ALTA (1 issue)

**1. Nested `<button>` inside `<button>` (invalid HTML)** - `src/components/sidebar/HistoryPanel.tsx:95-124`

- **Description**: The outer row button (click to load request, lines 95-108) contains an inner delete button (lines 110-123). Nesting interactive elements inside buttons is explicitly prohibited by the HTML specification. The `<button>` element's content model is "phrasing content, but there must be no interactive content descendant." Browsers handle this inconsistently: some render the inner button outside the outer, some fire both click handlers, some ignore the inner button entirely. Screen readers may not announce the inner button at all since it is contained within another interactive element. Keyboard navigation is broken: Tab may skip the delete button, and the aria-label on the inner button may be inaccessible.
- **Expected**: The row should be a non-interactive container (`<div>` or `<li>`), with two sibling `<button>` elements: one for loading the request and one for deleting it.
- **Suggestion**: Replace the outer `<button>` wrapping the entire row with a `<div class="flex items-center gap-2 px-3 py-1.5 w-full group relative hover:bg-pm-bg-elevated cursor-pointer transition-colors rounded">`. Then render two sibling `<button>` elements inside it: the load button covering the main clickable area (use `flex-1`) and the delete button as a sibling to the right. Pattern used successfully in `CollectionPanel.tsx` lines 79-102 for reference.

---

#### MEDIA (2 issues)

**1. Missing `aria-level` on `role="treeitem"` elements** - `src/components/sidebar/CollectionPanel.tsx:24,78`

- **Description**: The WAI-ARIA specification for the `tree` role requires that each `treeitem` exposes `aria-level` to convey its depth in the hierarchy. Without it, screen readers cannot announce to users whether an item is a top-level collection or a nested request. The collection items at depth 1 (line 24) and request items at depth 2 (line 78) both have `role="treeitem"` but no `aria-level`.
- **Suggestion**: Add `aria-level={1}` to the `<li role="treeitem">` at line 24 (collection items). Add `aria-level={2}` to the `<li role="treeitem">` at line 78 (request items). Example:
  ```tsx
  // Collection item (depth 1):
  <li role="treeitem" aria-level={1} aria-expanded={expanded} class="mb-1">

  // Request item (depth 2):
  <li key={req.id} role="treeitem" aria-level={2} class="group/req">
  ```

**2. No keyboard arrow navigation for tree items** - `src/components/sidebar/CollectionPanel.tsx`

- **Description**: The plan explicitly requires "keyboard arrow navigation for tree items" (Phase 6 completion criteria, line 560). The WAI-ARIA Treeview pattern (WCAG 2.1 criterion 2.1.1) requires: ArrowRight to expand a collapsed node or move focus to first child of an expanded node; ArrowLeft to collapse an expanded node or move focus to parent; ArrowDown/ArrowUp to move focus between visible tree items. Currently, only the expand/collapse button has keyboard interaction via native `<button>` Enter/Space. Arrow key navigation is entirely absent.
- **Suggestion**: Add a `tabIndex={0}` to the collection `<li>` elements and an `onKeyDown` handler on the `<ul role="tree">` container that handles arrow key navigation. A reference implementation using a keyboard manager pattern:
  ```tsx
  function handleTreeKeyDown(e: KeyboardEvent) {
    const items = Array.from(
      (e.currentTarget as HTMLElement).querySelectorAll('[role="treeitem"]')
    ) as HTMLElement[];
    const focused = document.activeElement as HTMLElement;
    const idx = items.indexOf(focused);

    if (e.key === "ArrowDown" && idx < items.length - 1) {
      e.preventDefault();
      items[idx + 1].focus();
    } else if (e.key === "ArrowUp" && idx > 0) {
      e.preventDefault();
      items[idx - 1].focus();
    }
  }
  ```
  Note: Full WAI-ARIA tree keyboard pattern with ArrowRight/Left for expand/collapse requires passing expand state down to the keyboard handler. A simplified approach (ArrowUp/Down for visible items only) is acceptable for this codebase given the plan's "KISS" principle.

---

#### BAJA (2 issues)

**1. Redundant `defaultName` computation in `SaveToCollectionModal`** - `src/components/workbench/SaveToCollectionModal.tsx:10-19`

- **Description**: Lines 10-19 compute `defaultName` from `requestState.value.url` during every render. This value is used only to initialize the `useState(defaultName)` call on line 21. However, `useState` only uses its initializer on component mount, not on re-renders. Since the component mounts once and the `useEffect` at lines 31-58 correctly recalculates and sets `requestName` on every open, the lines 10-19 computation is only relevant for the very first mount (before the modal is ever opened). The result is dead code on all subsequent renders.
- **Suggestion**: Remove the `defaultName` variable (lines 10-19) and initialize `useState` with an empty string: `const [requestName, setRequestName] = useState("")`. The `useEffect` handles the correct initialization on every open.

**2. Double truncation in `HistoryPanel`** - `src/components/sidebar/HistoryPanel.tsx:38-40,103-104`

- **Description**: The `truncateUrl` function (lines 38-40) truncates the URL at 35 characters and appends an ellipsis. The container `<div>` on line 103 also has the `truncate` Tailwind class, which applies `overflow: hidden; text-overflow: ellipsis; white-space: nowrap`. This results in the URL being manually clipped at 35 chars first, then potentially clipped again by CSS. The JavaScript function adds its own `"…"` which may itself be truncated by the CSS ellipsis. The CSS `truncate` class alone is sufficient and more reliable (respects the actual container width).
- **Suggestion**: Remove the `truncateUrl` function and its call. Change line 104 from `{truncateUrl(entry.url)}` to `{entry.url}` and rely on the `truncate` CSS class on the parent div. The `title={entry.url}` attribute on the parent button (line 99) already provides the full URL on hover.

---

### Verdict

**REJECTED (NO APROBADO)** due to 1 ALTA issue and 2 MEDIA issues.

The implementation is architecturally sound and the core features (storage layer, signal stores, history auto-save, workbench persistence, save-to-collection modal, sidebar islands, load-to-workbench flow) are all correctly implemented and match the plan. The code quality is high: TypeScript strict mode compliance, immutable update patterns, proper type guards for runtime validation, and correct use of `client:idle` vs `client:load`.

The blocking issues are:

1. The nested `<button>` in `HistoryPanel.tsx` is an invalid HTML construct that breaks keyboard navigation and screen reader accessibility. It must be refactored to use sibling buttons within a container element, using the same pattern already used correctly in `CollectionPanel.tsx`.

2. `aria-level` is required by the WAI-ARIA tree specification for screen readers to convey hierarchy depth. It is a one-line fix per treeitem.

3. Keyboard arrow navigation for the collection tree was explicitly specified in the plan's completion criteria and is required for WCAG 2.1 criterion 2.1.1 compliance.

After these three issues are resolved, the implementation should be re-reviewed. The BAJA issues are recommended improvements but do not block approval.

---

## Review #2 - 2026-02-20

### Summary

Re-reviewed `src/components/sidebar/HistoryPanel.tsx` and `src/components/sidebar/CollectionPanel.tsx` after fixes were applied for the 3 blocking issues from Review #1. Build verification: `bun run build` passes in 1.52s with 0 errors.

**ALTA #1 (nested button)**: Correctly resolved. **MEDIA #1 (aria-level)**: Correctly resolved. **MEDIA #2 (keyboard tree navigation)**: Fix was applied but is **non-functional** due to a focus model mismatch in the implementation. A new MEDIA issue is introduced by this bug. Approval is still blocked.

---

### Fix Verification

#### ALTA #1 - Nested `<button>` in `HistoryPanel.tsx`
**Status: RESOLVED**

The outer `<button>` has been replaced by the `<li>` element as the row container. The load-request button and delete button are now proper siblings inside the `<li>`. The `e.stopPropagation()` call (which was needed to prevent event bubbling to the outer button) has also been removed since there is no longer an outer button. The hover-reveal pattern for the delete button (`group-hover:opacity-100 focus-visible:opacity-100`) is correctly applied. The `truncateUrl` helper has also been removed and the CSS `truncate` class alone is used, resolving BAJA #2 from Review #1.

The HTML structure is now valid:

```
<li role="listitem" class="group flex items-center ...">   <!-- container -->
  <button ... class="flex-1 ...">                           <!-- load action -->
    ...
  </button>
  <button ... class="shrink-0 ...">                         <!-- delete action -->
    ...
  </button>
</li>
```

#### MEDIA #1 - Missing `aria-level` on `role="treeitem"` elements in `CollectionPanel.tsx`
**Status: RESOLVED**

`aria-level={1}` has been added to the collection `<li role="treeitem">` at line 24. `aria-level={2}` has been added to the request `<li role="treeitem">` at line 78. Both are correct.

#### MEDIA #2 - Keyboard arrow navigation in `CollectionPanel.tsx`
**Status: STILL BROKEN (non-functional implementation)**

A `handleTreeKeyDown` handler has been added to the `<ul role="tree">` and all four arrow keys are handled. However, the implementation has a fundamental focus model mismatch that makes it non-functional:

**Root cause**: `querySelectorAll('[role="treeitem"]')` returns the `<li>` elements. But HTML `<li>` elements without a `tabIndex` attribute are **not focusable** — they cannot receive or hold keyboard focus. The actual focused element (`document.activeElement`) when a user interacts with the tree will always be one of the child `<button>` elements inside the `<li>`, never the `<li>` itself.

As a result:

1. `items.indexOf(focused)` always evaluates to `-1` because `focused` (a `<button>`) is never in the `items` array (which contains `<li>` elements).
2. With `idx = -1`: the ArrowDown guard `idx < items.length - 1` evaluates to `true` (`-1 < N`), so `items[0].focus()` is called — but `items[0]` is a `<li>` without `tabIndex`, so `.focus()` is a silent no-op. The focused element does not move.
3. With `idx = -1`: the ArrowUp guard `idx > 0` evaluates to `false`, so nothing happens. Safe but still broken.
4. For ArrowRight/ArrowLeft: `focused.getAttribute("aria-level")` is called on the `<button>` (which does not have `aria-level`), returning `null`. The condition `=== "1"` is never met, so expand/collapse via arrow keys never fires.

Additionally, the ArrowRight/ArrowLeft expansion logic is brittle: it extracts the collection name by stripping the prefix from the `aria-label` string (`"Collapse collection MyName"` → `"MyName"`), then searches `allCollections` by `name`. This breaks if a collection name contains the substring `"collection "` or if the aria-label format ever changes. It also does a linear scan by name rather than by ID.

---

### New Issues Found

#### MEDIA (1 new issue)

**1. Keyboard arrow navigation is non-functional due to focus model mismatch** - `src/components/sidebar/CollectionPanel.tsx:168-206`

- **Description**: See analysis above. The handler exists and fires (events do bubble from focused `<button>` up through `<li>` up to `<ul>`), but all four arrow key actions silently fail because `document.activeElement` is always a `<button>`, never a `<li role="treeitem">`. The `<li>` elements are non-focusable.
- **Expected**: Arrow key presses move focus between tree items and expand/collapse collections.
- **Suggestion**: Two correct approaches, choose one:

  **Approach A (simpler — query buttons, not li elements)**: Change the `querySelectorAll` selector to target the focusable child buttons instead of the `<li>` wrappers. For ArrowRight/Left, walk up to the parent `<li>` to read `aria-level`. For expand/collapse, use the collection ID stored in a `data-collection-id` attribute on the `<li>`:

  ```tsx
  function handleTreeKeyDown(e: KeyboardEvent) {
    if (!["ArrowDown", "ArrowUp", "ArrowRight", "ArrowLeft"].includes(e.key)) return;

    const tree = e.currentTarget as HTMLElement;
    // Target the first button in each treeitem (the action button, not the delete button)
    const items = Array.from(
      tree.querySelectorAll<HTMLElement>('[role="treeitem"] > div > button:first-child, [role="treeitem"] > button:first-child')
    );
    const focused = document.activeElement as HTMLElement;
    const idx = items.indexOf(focused);

    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (idx < items.length - 1) items[idx + 1].focus();
      else if (idx === -1 && items.length > 0) items[0].focus(); // enter tree
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (idx > 0) items[idx - 1].focus();
    } else if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      e.preventDefault();
      const li = focused.closest<HTMLElement>('[role="treeitem"]');
      if (li?.getAttribute("aria-level") === "1") {
        const colId = li.dataset.collectionId;
        const col = allCollections.find((c) => c.id === colId);
        if (col) {
          const isExpanded = expandedIds.has(col.id);
          if (e.key === "ArrowRight" && !isExpanded) toggleExpanded(col.id);
          if (e.key === "ArrowLeft" && isExpanded) toggleExpanded(col.id);
        }
      }
    }
  }
  ```

  And add `data-collection-id={col.id}` to the `<li role="treeitem" aria-level={1}>` in `CollectionGroup`.

  **Approach B (standard roving tabIndex pattern)**: Add `tabIndex={-1}` to the `<li role="treeitem">` elements and manage focus on the `<li>` level. This is the canonical WAI-ARIA roving tabIndex approach for trees but requires more restructuring. Approach A is simpler and correct for this codebase.

---

### Verdict

**REJECTED (NO APROBADO)** — 1 MEDIA issue unresolved.

- ALTA #1 (nested button): RESOLVED
- MEDIA #1 (aria-level): RESOLVED
- MEDIA #2 (keyboard navigation): STILL BROKEN — the handler is present but non-functional due to focus model mismatch. Arrow key navigation does not move focus and does not expand/collapse collections.

---

## Review #3 - 2026-02-20

### Summary

Final re-review of `src/components/sidebar/CollectionPanel.tsx` after the keyboard navigation fix was applied for the remaining MEDIA #2 issue. Build verification: `bun run build` passes in 1.48s with 0 errors. No new issues introduced.

**MEDIA #2 (keyboard navigation)**: RESOLVED. The fix correctly addresses the focus model mismatch identified in Review #2.

---

### Fix Verification

#### MEDIA #2 - Keyboard arrow navigation (Review #2 finding)
**Status: RESOLVED**

The fix implements Approach A as suggested in Review #2: targeting focusable `<button>` elements instead of non-focusable `<li>` elements.

**Three changes applied:**

1. `data-collection-id={collection.id}` added to `<li role="treeitem" aria-level={1}>` at line 24. This allows the keyboard handler to identify which collection to expand/collapse without relying on the brittle aria-label string parsing that the previous implementation used.

2. `querySelectorAll` selector changed from `'[role="treeitem"]'` (returns non-focusable `<li>` elements) to `'[role="treeitem"] button:first-of-type'` (returns the focusable primary action button inside each treeitem). The selector is correct for this DOM structure:
   - For collection treeitems (`aria-level=1`): the wrapper `<div>` contains two `<button>` siblings — expand/collapse (first, matched) and delete (second, not matched). `button:first-of-type` is scoped to siblings within the same parent, so only the expand/collapse button is selected.
   - For request treeitems (`aria-level=2`): the `<li>` contains two `<button>` siblings — load (first, matched) and delete (second, not matched). Only the load button is selected.
   - Collapsed collections' request buttons are not in the DOM, so they are correctly excluded from the query result.

3. `focused.closest('[role="treeitem"]')` used for ArrowRight/ArrowLeft to walk up from the focused button to the parent `<li>`, from which `aria-level` and `dataset.collectionId` are read. This replaces the regex-based aria-label parsing from the previous attempt.

**Full logical trace of all code paths:**

- **ArrowDown with focused primary button at index N**: `primaryButtons.indexOf(focused)` returns `N` (correct, buttons are focusable and the same element reference). Guard `N < primaryButtons.length - 1` passes, `primaryButtons[N+1].focus()` moves focus to the next visible item in DOM order. Correct.
- **ArrowUp with focused primary button at index N**: `N > 0` guard passes, `primaryButtons[N-1].focus()` moves focus to previous item. Correct.
- **ArrowDown with focus outside tree (idx = -1)**: `-1 < length - 1` is true, `primaryButtons[0].focus()` enters the tree at the first item. Acceptable behavior.
- **ArrowUp with focus outside tree (idx = -1)**: `-1 > 0` is false, no-op. Safe.
- **ArrowRight on collection primary button**: `focused.closest('[role="treeitem"]')` reaches the `<li aria-level=1>`. `aria-level === "1"` passes. `dataset.collectionId` retrieves the UUID directly (no brittle string parsing). `expandedIds.has(colId)` checks current state. If collapsed, `toggleExpanded(colId)` expands it. If already expanded, `!isExpanded` is false, no-op. Correct.
- **ArrowLeft on collection primary button**: Same walk-up. If expanded, `isExpanded` is true, `toggleExpanded(colId)` collapses it. If already collapsed, no-op. Correct.
- **ArrowRight/Left on request primary button**: `focused.closest('[role="treeitem"]')` reaches the `<li aria-level=2>`. `aria-level !== "1"` guard triggers early return. Correct — leaf nodes are not expandable.
- **ArrowRight/Left on any delete button**: `closest` walk-up still reaches the parent treeitem. For collection delete buttons (inside the wrapper `<div>` inside the collection `<li aria-level=1>`): `aria-level === "1"` is true, so expand/collapse fires. This is a reasonable side-effect — pressing an arrow key while focused on the delete button still operates on the collection's expand state. For request delete buttons: `aria-level=2`, early return. Correct.
- **`e.preventDefault()`**: Called in all three conditional branches (ArrowDown, ArrowUp, combined ArrowRight/ArrowLeft). Default scroll behavior suppressed for all four arrow keys whenever the handler fires. Correct.

**No new issues introduced.** The `expandedIds` state lift that was done in Review #2 (from `CollectionGroup`-local state to `CollectionPanel`-level state) continues to work correctly and is required for the keyboard handler to access expand state by collection ID.

---

### All Issues — Final Status

| # | Severity | Issue | Status |
|---|----------|-------|--------|
| ALTA #1 | ALTA | Nested `<button>` in `HistoryPanel.tsx` | RESOLVED (Review #2) |
| MEDIA #1 | MEDIA | Missing `aria-level` on treeitems in `CollectionPanel.tsx` | RESOLVED (Review #2) |
| MEDIA #2 | MEDIA | Keyboard arrow navigation non-functional | RESOLVED (Review #3) |
| BAJA #1 | BAJA | Redundant `defaultName` in `SaveToCollectionModal.tsx` | Not fixed (does not block) |
| BAJA #2 | BAJA | Double truncation in `HistoryPanel.tsx` | RESOLVED (Review #2, as side effect of ALTA fix) |

---

### Verdict

**APPROVED (APROBADO)**

All ALTA and MEDIA issues have been resolved across the three review cycles. No new ALTA or MEDIA issues were introduced by any of the fixes. The two BAJA issues that remain open (`defaultName` redundancy in `SaveToCollectionModal.tsx`) do not block approval per the review policy.

The local-persistence feature is complete and meets all plan requirements:

- Storage layer with namespaced keys, generic typed read/write, runtime type guards, and graceful degradation on corrupt data.
- Signal-based stores for history and collections with explicit persist-on-mutate and correct immutable update patterns.
- History auto-save on every successful request using `structuredClone` for deep snapshot isolation.
- Save-to-collection modal with validation, focus management, aria-modal, and Escape-to-close.
- Workbench state persistence via a single `effect()` auto-persisting on every `requestState` change.
- Sidebar Preact islands using `client:idle` with reactive signal subscriptions, correct WAI-ARIA tree and list roles, `aria-level` depth markers, and functional keyboard arrow navigation.
- Load-to-workbench flow via a single `loadRequest` action that regenerates IDs and clears the response panel.
- `bun run build`: success (1.48s), 0 errors, 0 new warnings.

The fix attempt for MEDIA #2 demonstrates the right intent and correct structure (handler on `<ul role="tree">`, all four arrow keys, expand/collapse logic), but the implementation detail of querying `<li>` elements instead of their focusable children breaks the entire mechanism. The suggested Approach A above can be applied as a targeted fix to the existing handler without restructuring the component.
