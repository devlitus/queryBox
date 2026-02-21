# Environment Variables - Implementation Plan

## Feature Overview

Enable users to create, manage, and use environment variables in queryBox requests. Variables use `{{variableName}}` syntax and are interpolated at request execution time across URL, headers, params, and body.

## Architecture Decision Record

### ADR-1: State Management Approach

**Decision**: Use `@preact/signals` module-level signals (same pattern as `tab-store.ts`, `collection-store.ts`, `history-store.ts`).

**Alternatives considered**:
- **Nanostores**: Astro docs recommend nanostores for cross-framework islands, but queryBox is Preact-only. Adding a new dependency provides no benefit and would break the established pattern.
- **Context providers**: Not viable with Astro's islands architecture (each island hydrates independently).

**Justification**: All existing stores use `signal()` + explicit persist functions that call `StorageService`. This is a proven, well-tested pattern in the codebase. The environment store will follow the identical structure as `collection-store.ts` (signal + action functions + explicit StorageService persist calls).

### ADR-2: Interpolation Strategy

**Decision**: Pure utility function `interpolateVariables(template: string, variables: Map<string, string>): string` in `src/utils/interpolation.ts`. Interpolation happens in `http-client.ts` at request execution time.

**Alternatives considered**:
- **Store-level computed signals**: Would couple interpolation logic to signal infrastructure, making it harder to test.
- **Middleware/interceptor pattern**: Over-engineered for a single interpolation step.

**Justification**: A pure function is trivially unit-testable, has zero dependencies, and follows the existing pattern where `http-client.ts` reads store values and applies transformations before `fetch()`. The function is reusable for URL, headers, params, and body with the same call signature.

### ADR-3: Variable Highlighting Approach

**Decision**: CSS-based inline highlighting using a computed signal that detects `{{...}}` patterns and applies visual feedback via a subtle background color on the entire input when variables are detected, plus a resolved-value tooltip on the URL input.

**Alternatives considered**:
- **contentEditable div with rich rendering**: Complex to implement, breaks native input behavior (copy/paste, undo, accessibility). Significant scope creep.
- **Shadow DOM overlay**: Browser support inconsistencies, complex z-index management.
- **Simple border/icon indicator**: Minimal effort, clear enough for users.

**Justification**: A full rich-text variable highlighter (coloring individual `{{var}}` tokens inside an input) requires replacing `<input>` with a `contentEditable` element or a custom editor component. This is a significant undertaking that would warrant its own feature. Instead, we take a pragmatic approach: detect variables in the input value, show a small visual indicator (icon + tooltip with resolved values), and defer rich inline highlighting to a future enhancement.

### ADR-4: Environment Selector Placement

**Decision**: Place the active environment selector dropdown in the **header bar** (right section, before settings). This makes it globally visible and accessible regardless of which sidebar tab is active.

**Alternatives considered**:
- **Sidebar top**: Only visible when sidebar is open and Environments tab is active.
- **Request bar area**: Clutters the request-focused UI.

**Justification**: Postman places its environment selector in the top-right of the header. This is the expected UX pattern for this type of tool. The header is always visible, making the active environment contextually accessible.

### ADR-5: History Storage of Unresolved vs Resolved URLs

**Decision**: Store **unresolved** (raw) URLs containing `{{variableName}}` in history entries. The `requestSnapshot` in history preserves the original template values.

**Justification**: This matches the requirement that "variable interpolation should happen at request execution time (not stored in history with resolved values)." Users can re-execute historical requests with different environments. The resolved URL is only shown ephemerally during execution and in the response panel status bar.

---

## Type Definitions

```typescript
// src/types/environment.ts

export interface EnvironmentVariable {
  id: string;           // crypto.randomUUID()
  key: string;          // variable name (e.g., "baseUrl")
  value: string;        // variable value (e.g., "https://api.dev.example.com")
  enabled: boolean;     // can be individually toggled
}

export interface Environment {
  id: string;           // crypto.randomUUID()
  name: string;         // display name (e.g., "Development")
  variables: EnvironmentVariable[];
  createdAt: number;    // Date.now()
}
```

---

## Component Architecture

```
HeaderBar.astro
  +-- EnvironmentSelector.tsx (client:load)    <-- NEW island in header
        reads: activeEnvironmentId, environments
        writes: setActiveEnvironment()

Sidebar.astro
  +-- EnvironmentPanel.tsx (client:idle)        <-- REPLACES EnvironmentList.astro
        reads: environments
        writes: createEnvironment, deleteEnvironment, renameEnvironment
        child: EnvironmentEditor.tsx             <-- inline variable editing
                reads: environment.variables
                writes: addVariable, updateVariable, removeVariable, toggleVariable

HttpWorkbench.tsx
  +-- RequestBar.tsx                            <-- MODIFIED (variable indicator)
        reads: activeEnvironmentVariables (computed)
        shows: variable detection indicator + tooltip

http-client.ts                                  <-- MODIFIED (interpolation at send)
  calls: interpolateVariables() before fetch()
  interpolates: URL, headers, params, body
```

---

## Phase 1: Types, Utility Functions, and Unit Tests

### Objective
Establish the type definitions, interpolation utility, and their comprehensive unit tests as the foundation for all subsequent phases.

### Prerequisites
None (first phase).

### Detailed Tasks

1. **Create `src/types/environment.ts`** with `EnvironmentVariable` and `Environment` interfaces as defined in the Type Definitions section above.

2. **Create `src/utils/interpolation.ts`** with the following functions:

   - `interpolateVariables(template: string, variables: Map<string, string>): string`
     - Replaces all `{{variableName}}` occurrences with their values from the map.
     - Uses regex: `/\{\{([^}]+)\}\}/g` to match variable placeholders.
     - Trims whitespace inside braces: `{{ baseUrl }}` should match key `baseUrl`.
     - If a variable is not found in the map, leaves the placeholder unchanged (does NOT throw).
     - Returns the original string if no placeholders are found (fast path).

   - `extractVariableNames(template: string): string[]`
     - Extracts all unique variable names from a template string.
     - Returns deduplicated array of trimmed variable names.
     - Returns empty array if no variables found.

   - `hasVariables(text: string): boolean`
     - Returns true if the text contains any `{{...}}` pattern.
     - Used for quick detection in UI components (variable indicator).

   - `interpolateRequest(request: RequestState, variables: Map<string, string>): RequestState`
     - Deep-clones the request, then interpolates: `url`, each header `key` and `value`, each param `key` and `value`, and `body.raw`.
     - Returns the interpolated clone (original unchanged).
     - Uses `structuredClone()` for deep copy (same pattern as `loadRequest` in http-store).

3. **Create `src/utils/interpolation.test.ts`** with comprehensive tests:
   - `interpolateVariables`: basic substitution, multiple variables, missing variables left unchanged, nested braces, empty string, no placeholders, whitespace trimming inside braces.
   - `extractVariableNames`: single variable, multiple, duplicates removed, no variables, whitespace trimming.
   - `hasVariables`: true cases, false cases, edge cases (single brace, empty braces).
   - `interpolateRequest`: URL interpolation, header key/value interpolation, param key/value interpolation, body interpolation, original request unchanged (immutability test).

### Affected Files
- `src/types/environment.ts` - CREATE
- `src/utils/interpolation.ts` - CREATE
- `src/utils/interpolation.test.ts` - CREATE

### Applied Best Practices
- **Single Responsibility Principle (SRP)**: Each function does one thing. `interpolateVariables` handles string replacement, `interpolateRequest` handles the full request object, `extractVariableNames` handles detection.
- **Pure Functions**: All interpolation functions are pure (no side effects, deterministic output). This makes them trivially testable and composable.
- **Immutability**: `interpolateRequest` returns a new object, never mutates the input.
- **Fail Gracefully**: Missing variables are left as-is rather than throwing errors.

### Completion Criteria
- [ ] `src/types/environment.ts` exports `EnvironmentVariable` and `Environment` types
- [ ] All four utility functions implemented and exported
- [ ] All unit tests pass with `bun run test`
- [ ] Regex handles edge cases: `{{}}` (empty), `{{ spaced }}`, `{{nested{{}}}`

### Risks and Mitigations
- Risk: Regex performance on very large body strings --> Mitigation: The regex `/\{\{([^}]+)\}\}/g` is non-backtracking and linear. Bodies are capped at 5MB in http-client.ts. Not a concern.
- Risk: Variable names with special characters --> Mitigation: The regex captures `[^}]+` which allows any character except `}`. Document that variable names should be alphanumeric + underscore by convention, but do not enforce in interpolation (enforcement is in the UI).

### Complexity Estimation
Low - Pure utility functions with straightforward regex logic and standard TypeScript types.

---

## Phase 2: Environment Store and StorageService

### Objective
Create the reactive state store for environments with localStorage persistence, following the established collection-store pattern exactly.

### Prerequisites
Phase 1 completed (types defined).

### Detailed Tasks

1. **Extend `src/services/storage.ts`**:
   - Add storage key: `const ENVIRONMENTS_KEY = "qb:environments";`
   - Add storage key: `const ACTIVE_ENV_KEY = "qb:active-environment";`
   - Add type guard `isEnvironmentVariable(value: unknown): value is EnvironmentVariable` - check `id` (string), `key` (string), `value` (string), `enabled` (boolean).
   - Add type guard `isEnvironment(value: unknown): value is Environment` - check `id` (string), `name` (string), `createdAt` (number), `variables` (array of isEnvironmentVariable).
   - Add `getEnvironments(): Environment[]` - same pattern as `getCollections()`.
   - Add `setEnvironments(environments: Environment[]): void` - same pattern as `setCollections()`.
   - Add `getActiveEnvironmentId(): string | null` - same pattern as `getActiveTabId()`.
   - Add `setActiveEnvironmentId(id: string | null): void` - same pattern; accepts null to represent "No Environment".
   - Export all new functions from the `StorageService` object.

2. **Extend `src/services/storage.test.ts`** with tests for:
   - `getEnvironments` / `setEnvironments` round-trip.
   - `getActiveEnvironmentId` / `setActiveEnvironmentId` round-trip.
   - Type guard validation (corrupt data is filtered out).
   - Empty localStorage returns `[]` for environments and `null` for active ID.

3. **Create `src/stores/environment-store.ts`**:

   **Signals**:
   - `environments = signal<Environment[]>(StorageService.getEnvironments())`
   - `activeEnvironmentId = signal<string | null>(StorageService.getActiveEnvironmentId())`

   **Computed signals**:
   - `activeEnvironment = computed(() => environments.value.find(e => e.id === activeEnvironmentId.value) ?? null)`
   - `activeVariablesMap = computed<Map<string, string>>(() => { ... })` - builds a `Map<string, string>` from the active environment's enabled variables (key -> value). Returns empty Map when no active environment. This is the primary data structure consumed by interpolation.

   **Action functions** (all follow explicit-persist pattern of collection-store):
   - `createEnvironment(name: string): Environment` - creates with UUID, empty variables, persists.
   - `deleteEnvironment(id: string): void` - removes, persists. If deleted env was active, sets `activeEnvironmentId` to null.
   - `renameEnvironment(id: string, name: string): void` - updates name, persists.
   - `duplicateEnvironment(id: string): Environment | null` - deep-clones the environment with new IDs, appends " (Copy)" to name, persists.
   - `setActiveEnvironment(id: string | null): void` - sets `activeEnvironmentId`, persists.
   - `addVariable(envId: string): void` - appends a new empty `EnvironmentVariable` to the environment's variables array, persists.
   - `updateVariable(envId: string, varId: string, field: keyof Omit<EnvironmentVariable, "id">, value: string | boolean): void` - updates a specific field on a variable, persists.
   - `removeVariable(envId: string, varId: string): void` - removes variable from environment, persists.
   - `toggleVariable(envId: string, varId: string): void` - toggles the `enabled` field, persists.

4. **Create `src/stores/environment-store.test.ts`** following the `collection-store.test.ts` pattern:
   - Use `vi.resetModules()` + dynamic import in `beforeEach`.
   - Test signal initialization (empty state, pre-loaded from localStorage).
   - Test each action function (create, delete, rename, duplicate, setActive).
   - Test variable CRUD (add, update, remove, toggle).
   - Test `activeVariablesMap` computed (correct map, only enabled variables, empty when no env).
   - Test that deleting the active environment clears `activeEnvironmentId`.
   - Test persistence (each mutation persists to localStorage).

5. **Add `src/test/factories.ts` entries**:
   - `makeEnvironmentVariable(overrides?: Partial<EnvironmentVariable>): EnvironmentVariable`
   - `makeEnvironment(overrides?: Partial<Environment>): Environment`

### Affected Files
- `src/services/storage.ts` - MODIFY
- `src/services/storage.test.ts` - MODIFY
- `src/stores/environment-store.ts` - CREATE
- `src/stores/environment-store.test.ts` - CREATE
- `src/test/factories.ts` - MODIFY
- `src/types/environment.ts` - already created in Phase 1 (no changes)

### Applied Best Practices
- **Open/Closed Principle (OCP)**: StorageService is extended with new methods without modifying existing ones.
- **DRY**: The store follows the identical structure to collection-store (signal + actions + persist), not inventing a new pattern.
- **Separation of Concerns**: Storage layer (read/write/validate) is separate from reactive layer (signals/computed/actions).
- **Defensive Programming**: Type guards ensure corrupted localStorage data does not crash the app.

### Completion Criteria
- [ ] StorageService extended with environment read/write/type-guard functions
- [ ] environment-store exports signals, computed signals, and all action functions
- [ ] `activeVariablesMap` correctly computes a Map from enabled variables of the active environment
- [ ] All unit tests pass with `bun run test`
- [ ] Storage tests verify round-trip and corruption handling
- [ ] Factory functions added to `src/test/factories.ts`

### Risks and Mitigations
- Risk: Large number of environments bloating localStorage --> Mitigation: localStorage has a ~5MB limit. Each environment is small (name + key-value pairs). Even 100 environments with 50 variables each would be ~100KB. Not a concern. Can add a MAX_ENVIRONMENTS limit (e.g., 50) if desired, but YAGNI for now.
- Risk: `activeEnvironmentId` pointing to a deleted environment --> Mitigation: `deleteEnvironment` explicitly nullifies `activeEnvironmentId` when the active environment is deleted. `activeEnvironment` computed returns null for dangling IDs.

### Complexity Estimation
Medium - The store itself is straightforward (follows existing patterns), but the number of action functions and their tests is significant.

---

## Phase 3: HTTP Client Interpolation Integration

### Objective
Integrate variable interpolation into the request execution pipeline so that `{{variables}}` are resolved at send time.

### Prerequisites
Phase 1 (interpolation utility) and Phase 2 (environment store) completed.

### Detailed Tasks

1. **Modify `src/services/http-client.ts`**:

   - Import `interpolateRequest` from `../utils/interpolation`.
   - Import `activeVariablesMap` from `../stores/environment-store`.
   - Import `buildUrlWithParams` from `../utils/url`.
   - In `sendRequest()`, after reading `state` and `url` from stores, and before any processing:
     ```
     const variables = activeVariablesMap.value;
     const interpolatedState = variables.size > 0
       ? interpolateRequest(state, variables)
       : state;
     ```
   - Replace all subsequent references to `state` with `interpolatedState` for: header building, body extraction, and fetch options.
   - For the URL, interpolate `fullUrl.value` directly:
     ```
     const resolvedUrl = variables.size > 0
       ? interpolateVariables(fullUrl.value, variables)
       : fullUrl.value;
     ```
   - Use `resolvedUrl` for URL validation, the `fetch()` call, and the URL parsing for tab rename.
   - **Critical**: The `addHistoryEntry` call MUST still use the original `state` (not `interpolatedState`) and original `url` (not `resolvedUrl`) for the `requestSnapshot` and `url` fields. This preserves unresolved templates in history.
   - The `status`, `statusText`, `response` fields come from the actual HTTP response (resolved), which is correct.

2. **Verify no regressions**: The `sendRequest` function currently reads `requestState.value` and `fullUrl.value`. After changes, it will additionally read `activeVariablesMap.value`. When no environment is active, `activeVariablesMap.value` is an empty Map, and the fast-path (`variables.size > 0` check) ensures zero overhead.

### Affected Files
- `src/services/http-client.ts` - MODIFY

### Applied Best Practices
- **Principle of Least Surprise**: When no environment is active, behavior is identical to before. Users who don't use environments see zero changes.
- **Fail Gracefully**: If a variable in a URL is not defined in the active environment, the `{{varName}}` placeholder is left as-is. The URL validation will then catch it as an invalid URL and show an appropriate error message.
- **Immutability**: `interpolateRequest` returns a new object; the original signal values are never mutated.
- **Single Responsibility**: http-client.ts orchestrates the request pipeline; interpolation logic lives in the utility module.

### Completion Criteria
- [ ] `sendRequest()` interpolates URL, headers, params, and body from the active environment
- [ ] History entries store unresolved (template) values
- [ ] When no environment is active, request execution is unchanged
- [ ] `bun astro check` and `bun build` pass

### Risks and Mitigations
- Risk: Interpolated URL is invalid (e.g., variable not found, leaving `{{baseUrl}}/api/users`) --> Mitigation: Existing URL validation in `sendRequest()` will catch this and display "not a valid URL" error. This is acceptable UX -- the user sees the error and knows to check their environment.
- Risk: Circular variable references (e.g., `a={{b}}`, `b={{a}}`) --> Mitigation: Not supported. Interpolation is single-pass (no recursive resolution). `{{b}}` would be replaced with its literal value, which might contain `{{a}}` but that is NOT re-processed. This is the standard approach used by Postman.

### Complexity Estimation
Low - The interpolation utility does the heavy lifting. http-client.ts only needs ~10 lines of additional code.

---

## Phase 4: Environment Selector in Header

### Objective
Add an interactive environment selector dropdown to the header bar, allowing users to switch the active environment from anywhere in the app.

### Prerequisites
Phase 2 (environment store) completed.

### Detailed Tasks

1. **Create `src/components/header/EnvironmentSelector.tsx`**:
   - This is a Preact island component (will be rendered with `client:load` in HeaderBar.astro).
   - Import `environments`, `activeEnvironmentId`, `setActiveEnvironment` from environment-store.
   - Import the existing `Dropdown` component from `../shared/Dropdown`.
   - Build dropdown items from `environments.value`:
     - First item: `{ label: "No Environment", value: "__none__" }` (or empty string sentinel).
     - Remaining items: `environments.value.map(e => ({ label: e.name, value: e.id }))`.
   - Selected value: `activeEnvironmentId.value ?? "__none__"`.
   - On select: call `setActiveEnvironment(value === "__none__" ? null : value)`.
   - Style: compact, fits in the header. Use the existing Dropdown component's `buttonClass` and `panelClass` props for styling.
   - Button shows: an environment icon (from `environment.svg`) + active environment name (or "No Environment").
   - Accessible: `aria-label="Select active environment"`.

2. **Modify `src/components/header/HeaderBar.astro`**:
   - Import `EnvironmentSelector` from `./EnvironmentSelector`.
   - Add `<EnvironmentSelector client:load />` in the right section of the header, before the Settings button.
   - The `client:load` directive is necessary because the environment selector must be immediately interactive (it affects request execution).

### Affected Files
- `src/components/header/EnvironmentSelector.tsx` - CREATE
- `src/components/header/HeaderBar.astro` - MODIFY

### Applied Best Practices
- **Reuse**: Leverages the existing `Dropdown` component rather than creating a custom dropdown.
- **Accessibility**: Uses the Dropdown's built-in ARIA attributes (listbox, option, aria-selected) and keyboard navigation.
- **Islands Architecture**: The selector is a small, self-contained island with `client:load` since it's in the always-visible header and affects core functionality.

### Completion Criteria
- [ ] Environment selector renders in the header bar
- [ ] Shows "No Environment" when none is active
- [ ] Shows the active environment name when one is selected
- [ ] Changing environment updates the `activeEnvironmentId` signal
- [ ] Dropdown includes all environments from the store
- [ ] Keyboard navigation works (inherits from Dropdown component)
- [ ] `bun astro check` and `bun build` pass

### Risks and Mitigations
- Risk: Dropdown menu overflows on small screens --> Mitigation: Use `panelClass` to position the dropdown right-aligned (`right-0 left-auto`) so it doesn't overflow the viewport.
- Risk: Header becoming too crowded on mobile --> Mitigation: Hide the environment selector label text on mobile (show only the icon), similar to how other header elements are hidden with `hidden md:inline-flex`.

### Complexity Estimation
Low - Reuses existing Dropdown component and established signal pattern.

---

## Phase 5: Environment Management Panel in Sidebar

### Objective
Replace the static `EnvironmentList.astro` placeholder with a fully functional Preact island for creating, editing, and deleting environments and their variables.

### Prerequisites
Phase 2 (environment store) completed.

### Detailed Tasks

1. **Create `src/components/sidebar/EnvironmentPanel.tsx`** (top-level island):
   - Import `environments`, `activeEnvironmentId`, `createEnvironment`, `deleteEnvironment`, `renameEnvironment`, `duplicateEnvironment`, `setActiveEnvironment` from environment-store.
   - **Structure** (follows CollectionPanel.tsx pattern):

     a. **Header section**: Title "Environments" + "+" button to create new environment.

     b. **Inline create input**: When "+" is clicked, show an input field with Create/Cancel buttons (identical pattern to CollectionPanel's inline create). Validation: name is required, trimmed.

     c. **Environment list**: Render each environment as an expandable group:
        - Environment header row: Radio button (or click) to set active + environment name + expand/collapse chevron + action buttons (duplicate, delete) on hover.
        - Active environment indicated by a green dot (reuse the `isActive` pattern from EnvironmentItem.astro).
        - Click on environment name toggles expand/collapse to show variables editor.
        - Delete button with hover visibility (same pattern as CollectionPanel).

     d. **Expanded environment: Variable editor** (inline, not a modal):
        - Reuse the `KeyValueTable` component (`src/components/shared/KeyValueTable.tsx`) for variable editing.
        - Map `EnvironmentVariable[]` to `KeyValuePair[]` for the table (they share the same shape: id, key, value, enabled).
        - Wire up `onAdd` -> `addVariable(envId)`, `onUpdate` -> `updateVariable(envId, varId, field, value)`, `onRemove` -> `removeVariable(envId, varId)`, `onToggle` -> `toggleVariable(envId, varId)`.
        - The `showDescription` prop should be `false` (variables have key+value only, no description).

   - **Keyboard navigation**: Follow CollectionPanel's tree keyboard pattern (ArrowDown/Up for navigation, ArrowRight/Left for expand/collapse).

2. **Modify `src/components/sidebar/Sidebar.astro`**:
   - Replace `import EnvironmentList from "./EnvironmentList.astro"` with `import EnvironmentPanel from "./EnvironmentPanel"`.
   - Replace `<EnvironmentList />` with `<EnvironmentPanel client:idle />` in the environments tabpanel.
   - The `client:idle` directive is appropriate since the environments panel is in a non-default sidebar tab and not immediately visible.

3. **Optionally delete or keep `EnvironmentList.astro`** - delete it since it is fully replaced and has no other consumers.

4. **Optionally delete or keep `EnvironmentItem.astro`** - delete it since the new panel renders environment items inline. The active indicator pattern (green dot) is replicated in EnvironmentPanel.tsx.

### Affected Files
- `src/components/sidebar/EnvironmentPanel.tsx` - CREATE
- `src/components/sidebar/Sidebar.astro` - MODIFY
- `src/components/sidebar/EnvironmentList.astro` - DELETE
- `src/components/sidebar/EnvironmentItem.astro` - DELETE

### Applied Best Practices
- **DRY**: Reuses `KeyValueTable` for variable editing rather than building a custom editor.
- **Consistency**: Follows the same visual pattern and interaction model as CollectionPanel.tsx (expandable groups, inline create, hover action buttons).
- **Separation of Concerns**: EnvironmentPanel only handles UI; all state mutations go through environment-store action functions.
- **Progressive Enhancement**: Using `client:idle` reduces initial page load since this panel is not immediately visible.
- **Accessibility**: Keyboard navigation follows the WAI-ARIA Treeview pattern established in CollectionPanel.

### Completion Criteria
- [ ] EnvironmentPanel renders in the sidebar Environments tab
- [ ] Users can create new environments with a name
- [ ] Users can delete environments
- [ ] Users can rename environments (inline edit or separate interaction)
- [ ] Users can duplicate environments
- [ ] Expanding an environment shows the KeyValueTable for its variables
- [ ] Users can add, edit, remove, and toggle variables
- [ ] Active environment is visually indicated (green dot)
- [ ] Clicking environment header sets it as active
- [ ] Empty state shows "No environments yet." message
- [ ] Keyboard navigation works
- [ ] `bun astro check` and `bun build` pass

### Risks and Mitigations
- Risk: KeyValueTable uses `KeyValuePair` which has an optional `description` field not present in `EnvironmentVariable` --> Mitigation: `EnvironmentVariable` has the same required fields as `KeyValuePair` (id, key, value, enabled). The optional `description` field in `KeyValuePair` is not used when `showDescription={false}`. Types are compatible.
- Risk: Renaming inline can be complex UX --> Mitigation: For MVP, use double-click or a dedicated rename button (like Postman). The simplest approach is a rename button that shows an inline input, same pattern as the create flow.

### Complexity Estimation
Medium-High - The panel has significant UI complexity (expandable groups, inline editing, multiple action buttons, keyboard navigation). However, it closely follows the CollectionPanel pattern, which reduces design risk.

---

## Phase 6: Variable Detection Indicator in Request UI

### Objective
Provide visual feedback when request fields contain `{{variable}}` placeholders, showing users that variables will be interpolated at execution time.

### Prerequisites
Phase 1 (utility functions), Phase 2 (environment store), Phase 3 (interpolation integration).

### Detailed Tasks

1. **Create `src/components/shared/VariableIndicator.tsx`**:
   - A small inline component that shows a visual cue when variables are detected.
   - Props: `text: string` (the input value to check), `variables: Map<string, string>` (the active environment's variables map).
   - Logic:
     - Call `extractVariableNames(text)` to get the variable names found in the text.
     - If no variables found, render nothing (null).
     - If variables found, render a small pill/badge showing variable count and a tooltip with resolved values.
     - Example: `[2 vars]` badge. Tooltip shows: `baseUrl -> https://api.dev.example.com`, `apiKey -> abc123`.
     - If a variable is not found in the active environment, show it in the tooltip as `varName -> (undefined)` with warning styling.

2. **Modify `src/components/request/RequestBar.tsx`**:
   - Import `activeVariablesMap` from `../../stores/environment-store`.
   - Import `VariableIndicator` from `../shared/VariableIndicator`.
   - Import `hasVariables` from `../../utils/interpolation`.
   - After the URL input, conditionally render `<VariableIndicator text={url} variables={activeVariablesMap.value} />` when `hasVariables(url)` is true.
   - This provides immediate feedback that the URL contains variables that will be resolved.

3. **Optionally extend variable detection to other inputs** (headers, params, body):
   - In `KeyValueTable.tsx`, the value column could show a small indicator when `hasVariables(item.value)` is true. This is a nice-to-have and can be deferred if scope becomes too large.
   - In `BodyEditor.tsx`, show the indicator near the textarea when `hasVariables(raw)`.
   - **Recommendation**: Implement for URL in RequestBar as the primary indicator. Defer header/param/body indicators to a follow-up iteration unless time permits.

### Affected Files
- `src/components/shared/VariableIndicator.tsx` - CREATE
- `src/components/request/RequestBar.tsx` - MODIFY
- `src/components/request/BodyEditor.tsx` - MODIFY (optional, can be deferred)

### Applied Best Practices
- **KISS**: A simple pill badge with tooltip is much simpler than rich inline highlighting while still providing useful feedback.
- **Progressive Disclosure**: The indicator is small and unobtrusive; full variable details are shown on hover via tooltip.
- **Performance**: `hasVariables()` is a simple regex test, negligible overhead on every keystroke.
- **YAGNI**: Start with URL indicator only. Extend to other fields only if needed.

### Completion Criteria
- [ ] VariableIndicator component renders a badge when variables are detected in the URL
- [ ] Tooltip shows resolved values (variable name -> resolved value)
- [ ] Undefined variables are shown with "(undefined)" in the tooltip
- [ ] Indicator is hidden when no variables are present
- [ ] Indicator is hidden when no active environment is selected
- [ ] `bun astro check` and `bun build` pass

### Risks and Mitigations
- Risk: Performance impact of calling `extractVariableNames` on every URL change --> Mitigation: The function is a simple regex scan, O(n) with small n (URL length). Negligible cost.
- Risk: Tooltip implementation complexity --> Mitigation: Use a simple CSS-based tooltip (absolute positioning on hover) or use the existing `title` attribute for simplicity. No external tooltip library needed.

### Complexity Estimation
Low-Medium - The indicator component is simple. The main effort is integrating it cleanly into the existing RequestBar layout.

---

## Phase 7: Build Verification and Coverage Update

### Objective
Ensure all changes pass type checking, production build, and update test coverage configuration.

### Prerequisites
All previous phases completed.

### Detailed Tasks

1. **Update `vitest.config.ts`**:
   - Add `src/stores/environment-store.ts` to the coverage include paths (it should already be covered by the `src/stores/**` glob, but verify).
   - Add `src/utils/interpolation.ts` to the coverage include paths (should be covered by `src/utils/**` glob).
   - Verify thresholds are still met with the new code.

2. **Run `bun astro check`**: Fix any TypeScript errors.

3. **Run `bun build`**: Verify production build succeeds.

4. **Run `bun run test`**: Verify all tests pass.

5. **Run `bun run test:coverage`**: Verify coverage thresholds are met.

6. **Manual smoke test** (development server):
   - Create an environment "Development" with variables `baseUrl=https://jsonplaceholder.typicode.com`.
   - Create a request with URL `{{baseUrl}}/todos/1`.
   - Select "Development" environment.
   - Verify the variable indicator shows in the URL bar.
   - Send the request and verify it resolves to `https://jsonplaceholder.typicode.com/todos/1`.
   - Check history: URL should show `{{baseUrl}}/todos/1` (unresolved).
   - Switch to "No Environment" and send again: should get an invalid URL error.

### Affected Files
- `vitest.config.ts` - VERIFY (likely no changes needed)

### Applied Best Practices
- **Continuous Verification**: Build and type-check after all changes, not just at the end.
- **Test Coverage**: Maintain the 70% threshold established by the project.

### Completion Criteria
- [ ] `bun astro check` passes with zero errors
- [ ] `bun build` succeeds
- [ ] `bun run test` passes all tests
- [ ] `bun run test:coverage` meets 70% threshold
- [ ] Manual smoke test confirms end-to-end functionality

### Risks and Mitigations
- Risk: Coverage drops below 70% due to new untested component code --> Mitigation: Component code (.tsx) is excluded from coverage thresholds by the existing config. Only utils, services, and stores are covered.
- Risk: TypeScript errors from new Preact components --> Mitigation: Follow established patterns from existing .tsx components.

### Complexity Estimation
Low - Verification and validation only.

---

## Dependency Graph

```
Phase 1 (Types + Utils + Tests)
  |
  v
Phase 2 (Store + StorageService)
  |
  +------------+-------------+
  |            |             |
  v            v             v
Phase 3    Phase 4       Phase 5
(HTTP       (Header       (Sidebar
 Client)    Selector)     Panel)
  |            |             |
  +-----+-----+-------------+
        |
        v
    Phase 6 (Variable Indicator)
        |
        v
    Phase 7 (Verification)
```

Phases 3, 4, and 5 are independent of each other and can be implemented in parallel after Phase 2. Phase 6 depends on Phases 1, 2, and 3. Phase 7 is the final verification step.

---

## Summary of All Affected Files

| File | Action | Phase |
|------|--------|-------|
| `src/types/environment.ts` | CREATE | 1 |
| `src/utils/interpolation.ts` | CREATE | 1 |
| `src/utils/interpolation.test.ts` | CREATE | 1 |
| `src/services/storage.ts` | MODIFY | 2 |
| `src/services/storage.test.ts` | MODIFY | 2 |
| `src/stores/environment-store.ts` | CREATE | 2 |
| `src/stores/environment-store.test.ts` | CREATE | 2 |
| `src/test/factories.ts` | MODIFY | 2 |
| `src/services/http-client.ts` | MODIFY | 3 |
| `src/components/header/EnvironmentSelector.tsx` | CREATE | 4 |
| `src/components/header/HeaderBar.astro` | MODIFY | 4 |
| `src/components/sidebar/EnvironmentPanel.tsx` | CREATE | 5 |
| `src/components/sidebar/Sidebar.astro` | MODIFY | 5 |
| `src/components/sidebar/EnvironmentList.astro` | DELETE | 5 |
| `src/components/sidebar/EnvironmentItem.astro` | DELETE | 5 |
| `src/components/shared/VariableIndicator.tsx` | CREATE | 6 |
| `src/components/request/RequestBar.tsx` | MODIFY | 6 |
| `vitest.config.ts` | VERIFY | 7 |

**Total**: 7 CREATE, 6 MODIFY, 2 DELETE, 1 VERIFY = 16 files touched.
