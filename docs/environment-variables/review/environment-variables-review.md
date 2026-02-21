# Code Review Report

## Feature: Environment Variables
## Plan: `docs/environment-variables/environment-variables-plan.md`
## Date: 2026-02-21
## Status: ❌ NO APROBADO

---

### Summary

The implementation covers all 7 phases with high overall quality. TypeScript passes with 0 errors and 0 warnings (`bun astro check`). The production build succeeds (`bun build`). All 255 tests pass (`bun run test`). Coverage thresholds are met (91.57% statements, 83.5% branches globally — all above the 70% threshold). The new files match the plan's file manifest: all 7 CREATE, 6 MODIFY, and 2 DELETE files are accounted for.

The core functionality — interpolation utility, environment store, StorageService extensions, http-client integration, EnvironmentPanel, and keyboard navigation — is implemented correctly and follows established codebase patterns.

Two MEDIA issues block approval:
1. The EnvironmentSelector button is missing the environment icon specified in the plan.
2. The VariableIndicator is shown even when no active environment is selected, violating the explicit acceptance criterion.

---

### Plan Compliance Checklist

#### Phase 1: Types, Utility Functions, and Unit Tests
- [x] `src/types/environment.ts` exports `EnvironmentVariable` and `Environment` types — correct shape, all fields present
- [x] `interpolateVariables` — regex, trim, missing-var left unchanged, fast path
- [x] `extractVariableNames` — deduplication, trim, empty-brace skip
- [x] `hasVariables` — quick detection, edge cases
- [x] `interpolateRequest` — structuredClone, all fields interpolated, immutable
- [x] `src/utils/interpolation.test.ts` — 36 tests covering all specified scenarios including edge cases

#### Phase 2: Environment Store and StorageService
- [x] Storage keys `qb:environments` and `qb:active-environment` added
- [x] `isEnvironmentVariable` type guard implemented
- [x] `isEnvironment` type guard implemented (validates nested variables array)
- [x] `getEnvironments` / `setEnvironments` implemented
- [x] `getActiveEnvironmentId` / `setActiveEnvironmentId` implemented (null removes key)
- [x] All new StorageService methods exported
- [x] `src/services/storage.test.ts` extended with environment round-trip and corruption tests
- [x] `environments` and `activeEnvironmentId` signals initialized from localStorage
- [x] `activeEnvironment` computed signal
- [x] `activeVariablesMap` computed — Map from enabled variables with non-empty keys
- [x] All 8 action functions: `createEnvironment`, `deleteEnvironment`, `renameEnvironment`, `duplicateEnvironment`, `setActiveEnvironment`, `addVariable`, `updateVariable`, `removeVariable`, `toggleVariable`
- [x] Deleting active env clears `activeEnvironmentId` and persists null
- [x] `src/stores/environment-store.test.ts` — 49 tests, all passing
- [x] `makeEnvironmentVariable` and `makeEnvironment` factory functions in `src/test/factories.ts`

#### Phase 3: HTTP Client Interpolation Integration
- [x] `activeVariablesMap` imported from environment-store
- [x] `interpolateRequest` and `interpolateVariables` imported from interpolation utility
- [x] `interpolatedState` used for headers, body, method
- [x] `resolvedUrl` used for URL validation, fetch call, and tab rename
- [x] History entry uses original unresolved `state` and `url`
- [x] Fast path when `variables.size === 0`

#### Phase 4: Environment Selector in Header
- [x] `src/components/header/EnvironmentSelector.tsx` created
- [x] Uses existing `Dropdown` component
- [x] "No Environment" as first item with `__none__` sentinel
- [x] `setActiveEnvironment(null)` called when `__none__` is selected
- [x] `<EnvironmentSelector client:load />` added before Settings button in HeaderBar
- [ ] Button shows environment icon from `environment.svg` — ❌ NOT IMPLEMENTED (see MEDIA issue #1)
- [x] `panelClass="right-0 left-auto"` for right-aligned overflow prevention
- [x] `hidden md:inline-flex` to hide label text on mobile
- [x] Keyboard navigation inherited from Dropdown (ArrowUp/Down/Enter/Escape)
- [x] Accessible via `label="Select active environment"` prop

#### Phase 5: Environment Management Panel in Sidebar
- [x] `src/components/sidebar/EnvironmentPanel.tsx` created
- [x] `<EnvironmentPanel client:idle />` in Sidebar.astro environments tabpanel
- [x] `EnvironmentList.astro` deleted
- [x] `EnvironmentItem.astro` deleted
- [x] Header section with "Environments" title and "+" create button
- [x] Inline create input with validation (name required, trimmed), Create/Cancel buttons
- [x] `role="alert"` on error message
- [x] Environment list as `role="tree"` with `role="treeitem"` items
- [x] `aria-level={1}` on environment treeitems
- [x] `aria-expanded` on treeitem
- [x] Active indicator (green dot via `bg-pm-status-success`)
- [x] Expand/collapse per environment with chevron rotation
- [x] Set-active checkmark button
- [x] Rename button (inline input with Enter/Escape handling)
- [x] Duplicate button
- [x] Delete button
- [x] KeyValueTable for variable editing (`showDescription={false}`)
- [x] `toKeyValuePairs` adapter maps EnvironmentVariable to KeyValuePair
- [x] `handleTableUpdate` maps KeyValuePair field updates back to EnvironmentVariable fields
- [x] Empty state "No environments yet." message
- [x] WAI-ARIA Treeview keyboard navigation (ArrowDown/Up/Right/Left)
- [x] New environment auto-expanded after creation

#### Phase 6: Variable Detection Indicator in Request UI
- [x] `src/components/shared/VariableIndicator.tsx` created
- [x] Badge shows variable count ("1 var" / "N vars")
- [x] CSS hover tooltip with resolved variable values
- [x] Undefined variables shown as `(undefined)` with error styling
- [x] `role="tooltip"` on tooltip div
- [x] `aria-label` on badge span with full count description
- [x] Renders null when no variables detected
- [x] `src/components/request/RequestBar.tsx` imports and uses VariableIndicator
- [ ] Indicator hidden when no active environment is selected — ❌ NOT IMPLEMENTED (see MEDIA issue #2)

#### Phase 7: Build Verification
- [x] `bun astro check` — 0 errors, 0 warnings
- [x] `bun build` — succeeds, 1 page built
- [x] `bun run test` — 255 tests pass (8 test files)
- [x] `bun run test:coverage` — all thresholds met (statements 91.57%, branches 83.5%, functions 95.27%, lines 94.84%)

---

### Issues Found

#### 🔴 ALTA (0 issues)

No high-severity issues found.

#### 🟡 MEDIA (2 issues)

**1. EnvironmentSelector button missing environment icon** — `src/components/header/EnvironmentSelector.tsx:11-34`

- Description: The plan's Phase 4 Detailed Tasks item 1 specifies: "Button shows: an environment icon (from `environment.svg`) + active environment name (or 'No Environment')." The icon `src/assets/icons/environment.svg` exists in the project but is not imported or rendered in `EnvironmentSelector.tsx`. The button only shows the text label via the Dropdown component.
- Plan reference: Phase 4, Detailed Tasks item 1 — "Button shows: an environment icon (from `environment.svg`) + active environment name (or 'No Environment')."
- Suggestion: Import `environment.svg` with `?raw` and render it in the Dropdown button area. Since `Dropdown` does not accept an icon prop, the simplest fix is to pass a custom `buttonClass` and extend `DropdownItem` with an optional icon, or modify the `label` prop to include an icon+text pair by rendering the button via a custom label approach. Alternatively — and more pragmatically — prefix the selected label text with an inline SVG by extending `Dropdown`'s `buttonClass` to include the icon. The cleanest solution given the Dropdown component's current API is to render the icon before the Dropdown component's button area, but since Dropdown renders the button internally, the best approach is to add an `icon` slot or `iconClass` prop to Dropdown, or switch to a custom button for the environment selector. A minimal fix that does not require changing `Dropdown`: create a thin custom button+panel directly in `EnvironmentSelector` instead of using `Dropdown`. Example:
  ```tsx
  import environmentIcon from "../../assets/icons/environment.svg?raw";
  // Inside button: render <Fragment set:html={...} /> equivalent for Preact
  // dangerouslySetInnerHTML={{ __html: environmentIcon }}
  ```

**2. VariableIndicator shown when no active environment is selected** — `src/components/request/RequestBar.tsx:16`

- Description: `showVariableIndicator` is computed as `hasVariables(url)` (line 16), which is `true` whenever the URL contains `{{...}}` patterns regardless of whether an active environment is set. When no environment is active, the indicator badge still appears and the tooltip shows all variables as `(undefined)`. The plan's Phase 6 completion criteria explicitly states: "Indicator is hidden when no active environment is selected."
- Plan reference: Phase 6 Completion Criteria — "Indicator is hidden when no active environment is selected."
- Suggestion: Also import `activeEnvironmentId` from environment-store and guard the indicator on both conditions:
  ```tsx
  import { activeVariablesMap, activeEnvironmentId } from "../../stores/environment-store";
  // ...
  const showVariableIndicator = activeEnvironmentId.value !== null && hasVariables(url);
  ```
  This ensures the indicator only appears when an environment is active. When no environment is selected, the `{{variable}}` text in the URL already gives the user a hint, and the send button will produce a clear URL-validation error.

#### 🟢 BAJA (2 issues)

**1. Redundant `aria-label` prop on Dropdown component** — `src/components/header/EnvironmentSelector.tsx:28`

- Description: `aria-label="Select active environment"` is passed as a JSX prop directly to `<Dropdown>`. The Dropdown component's Props interface does not declare an `aria-label` prop, so this attribute is silently ignored by Preact. Accessibility works correctly because `label="Select active environment"` (line 31) is also passed and IS accepted by Dropdown's Props. The redundant `aria-label` prop is dead code.
- Suggestion: Remove the `aria-label="Select active environment"` prop from the `<Dropdown>` element at line 28, leaving only `label="Select active environment"`.

**2. Uncovered lines in `storage.ts` (pre-existing gap from add-requests feature)** — `src/services/storage.ts:88-90,174-198`

- Description: Lines 88-90 (`isTab` null check) and 174-198 (`getTabs`, `setTabs`, `getActiveTabId`, `setActiveTabId`) remain untested. These lines existed before this feature (they were introduced in the add-requests phase) and are not in scope for the environment-variables plan. Coverage thresholds are still met. This is a carry-forward gap from the previous phase.
- Suggestion: Add coverage for these functions in a future iteration or as part of a dedicated storage test cleanup.

---

### Verdict

The implementation is of high quality and close to complete. All core functionality — types, interpolation utilities, environment store with full CRUD, StorageService extensions, HTTP client interpolation, EnvironmentPanel with keyboard navigation, EnvironmentSelector in the header, and VariableIndicator — is correctly implemented and tested.

However, two explicit plan requirements are not satisfied:

1. The EnvironmentSelector button does not display the environment icon (`environment.svg`) as specified in the plan.
2. The VariableIndicator is shown even when no active environment is selected, violating an explicit acceptance criterion.

Both are MEDIA issues that block approval. The senior-developer must fix these two items before the implementation can be approved.

---

## Review #2 - 2026-02-21

### Status: APPROVED

### Summary

All three issues from Review #1 have been correctly fixed. The implementation now fully satisfies every plan requirement. TypeScript check passes with 0 errors, the production build succeeds, all 255 tests pass, and all coverage thresholds are met.

The fixes were:
1. `Dropdown.tsx` was extended with an `icon?: string` prop that renders the SVG using `dangerouslySetInnerHTML`. `EnvironmentSelector.tsx` imports `environment.svg?raw` and passes it via the new `icon` prop. The SVG is a static asset (not user input), so the use of `dangerouslySetInnerHTML` is safe.
2. `RequestBar.tsx` now imports `activeEnvironmentId` from environment-store and guards `showVariableIndicator` with `activeEnvironmentId.value !== null && hasVariables(url)`. The indicator is correctly hidden when no environment is active.
3. The redundant `aria-label` prop on the `<Dropdown>` element in `EnvironmentSelector.tsx` has been removed. Only the accepted `label` prop remains.

No new issues were introduced by the fixes.

---

### Fix Verification

#### Previous MEDIA Issue #1 — EnvironmentSelector button missing environment icon
- Status: RESOLVED
- Evidence: `src/components/header/EnvironmentSelector.tsx` line 1 imports `environmentIcon` from `"../../assets/icons/environment.svg?raw"`. Line 29 passes `icon={environmentIcon}` to the `Dropdown` component. `src/components/shared/Dropdown.tsx` Props interface (line 17) declares `icon?: string` and renders it at lines 117-119 as `<span class="w-4 h-4 shrink-0" aria-hidden="true" dangerouslySetInnerHTML={{ __html: icon }} />`. The SVG content (`src/assets/icons/environment.svg`) is a static file — not user data — so `dangerouslySetInnerHTML` is safe. The decorative icon span correctly carries `aria-hidden="true"`.

#### Previous MEDIA Issue #2 — VariableIndicator shown when no active environment
- Status: RESOLVED
- Evidence: `src/components/request/RequestBar.tsx` line 7 now imports `activeEnvironmentId` in addition to `activeVariablesMap`. Line 16 reads: `const showVariableIndicator = activeEnvironmentId.value !== null && hasVariables(url);`. This exactly matches the suggested fix. The indicator is only rendered when an environment is active AND the URL contains variable placeholders.

#### Previous BAJA Issue #1 — Redundant aria-label prop on Dropdown
- Status: RESOLVED
- Evidence: `src/components/header/EnvironmentSelector.tsx` lines 24-34 show the `<Dropdown>` element has `label="Select active environment"` (the accepted prop) and no `aria-label` attribute. The dead prop has been removed.

---

### Plan Compliance Checklist (Re-verification)

- [x] Phase 4, Detailed Task 1 — Button shows environment icon from `environment.svg` — RESOLVED
- [x] Phase 6, Completion Criteria — Indicator is hidden when no active environment is selected — RESOLVED
- [x] All other checklist items from Review #1 remain satisfied

---

### Build and Test Verification

- `bun astro check` — 0 errors, 0 warnings (unchanged)
- `bun run build` — succeeds, 1 page built (unchanged)
- `bun run test` — 255 tests pass, 8 test files (unchanged)
- `bun run test:coverage` — all thresholds met: statements 91.57%, branches 83.5%, functions 95.27%, lines 94.84% (unchanged)

---

### New Issues Introduced by Fixes

#### ALTA (0 issues)
None.

#### MEDIA (0 issues)
None.

#### BAJA (0 issues)
None. The modification to `Dropdown.tsx` to add the `icon` prop is minimal, follows the existing component pattern (same rendering approach as other SVG icons in the codebase), is correctly typed, and does not affect existing Dropdown usages since the prop is optional.

---

### Verdict

All ALTA and MEDIA issues from Review #1 have been resolved. No new issues were introduced. The implementation fully satisfies the plan's 7 phases and all acceptance criteria. The code quality remains high, TypeScript is clean, the build succeeds, and all tests pass.

The feature is approved.
