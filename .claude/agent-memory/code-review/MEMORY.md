# Code Review Agent Memory

## Recurring Patterns in this Project

### Typical Implementation Quality by Phase
- Phases 1-5 (foundation, components): well implemented
- Phase 6 (responsiveness): CSS media queries defined but JSX components NOT updated (hamburger missing)
- Phase 7 (accessibility): ARIA correct but keyboard navigation always missing first time
- Test features: structure correct, but per-file coverage targets missed; command invocation issues

### Common ALTA Issues (always check these first)

#### Accessibility / Keyboard (WCAG 2.1.1)
- Custom Elements only implement `click` — never `keydown` for Arrow keys, Enter, Space, Escape
- Keyboard handler present but non-functional: `querySelectorAll` returns non-focusable elements
- Tabs: need ArrowLeft/Right; Dropdowns: ArrowUp/Down + Escape; Trees: ArrowRight/Left/Up/Down

#### Responsiveness
- CSS defines media queries but JSX has no corresponding `md:hidden` / `lg:flex` Tailwind classes
- Hamburger button always missing on first implementation

#### Framework Integration
- `bun astro check` does NOT detect missing `integrations: [preact()]` in `astro.config.mjs`
- Only `bun run build` catches `[NoMatchingRenderer]` errors

#### Test Runners (Vitest)
- `bun test` invokes Bun's native runner (fails with `localStorage is not defined`)
- Correct command: `bun run test` — always verify BOTH when reviewing test features
- Tests can appear to exercise a code path but actually go through different branch (check coverage lines)
- `bunfig.toml` in Bun 1.3.5 has NO `[test]` redirect capability — cannot map `bun test` → Vitest
- Documentation fix in `bunfig.toml` mitigates discoverability but does not make `bun test` functional

### Common MEDIA Issues (always check these)
- Plan specifies icons by filename → always verify import and render in component
- Conditional rendering criteria (e.g., "hidden when X") → verify ALL conditions are in the guard
- `dangerouslySetInnerHTML` with HTTP response data → XSS if not escaped
- Missing `aria-controls` on tabs, `aria-level` on trees, `role="listbox"` on dropdowns
- Duplicate DOM IDs when reusable components used multiple times on same page
- Nested `<button>` inside `<button>` (invalid HTML)
- Color contrast < 4.5:1

### Code Quality — Positive Patterns Observed
- TypeScript: always passes `bun astro check` (0 errors, 0 warnings)
- Custom Elements: always use `if (!customElements.get('name'))` guard
- DRY: reusable components implemented well (KeyValueTable, CodeViewer, Badge)
- Factories: typed factory functions in `src/test/factories.ts`
- Vitest: `vi.resetModules()` + dynamic import pattern correctly applied
- add-requests (2026-02-20): Near-perfect implementation. All 7 phases complete, 159 tests pass.
  Only BAJA issues: (1) tabIndex should be -1 for inactive tabs per WAI-ARIA (codebase has correct
  pattern in shared Tabs.tsx), (2) Arrow key navigation does not call .focus() on new active tab,
  (3) new StorageService tab methods (getTabs/setTabs/getActiveTabId/setActiveTabId) untested in
  storage.test.ts despite being in Phase 6 scope.
- environment-variables (2026-02-21): APPROVED on Review #2. 255 tests pass, build succeeds, 0 TS errors.
  Initial 2 MEDIA issues fixed correctly: (1) icon prop added to Dropdown + imported in EnvironmentSelector,
  (2) activeEnvironmentId guard added to showVariableIndicator in RequestBar. 1 BAJA fixed (redundant aria-label).
  Positive: first time keyboard navigation in EnvironmentPanel was correctly implemented on first try.
  Fix pattern: extending shared Dropdown with optional `icon?: string` prop + dangerouslySetInnerHTML is safe
  for static SVG assets (not user data). Always distinguish static-asset SVG (safe) vs HTTP-response data (XSS risk).
  Storage uncovered lines 88-90,174-198 are carry-forward from add-requests phase (not new).
- auth-system (2026-02-21): APPROVED on first review. 299 tests pass, build succeeds, 0 TS errors.
  Near-perfect implementation across all 5 phases. Only 2 BAJA issues:
  (1) Double import from same module in AuthEditor.tsx (style, should be consolidated),
  (2) makeAuthConfig() factory uses `Partial<AuthConfig>` + `as AuthConfig` cast — fragile typing.
  Positive: Unicode base64 with TextEncoder correctly implemented and documented; migration guards applied
  in all 3 required places; VariableIndicator correctly conditioned to `activeEnvironmentId !== null`;
  auth header precedence (auth < user-defined) correctly implemented and commented; 100% coverage on auth.ts.
  Pattern: discriminated union + TextEncoder base64 is the established auth encoding approach in this codebase.

## Optimized Review Checklist

### Always Run First
```bash
bun astro check      # TypeScript: must be 0 errors
bun run build        # Build: must succeed
bun run test         # Tests: all must pass (NOT bun test)
bun run test:coverage  # Coverage: verify thresholds
```

### Phase 6 Responsiveness (ALWAYS review thoroughly)
- [ ] Media queries in CSS AND `md:hidden`/`lg:flex` in JSX components (both needed)
- [ ] Hamburger button exists on mobile/tablet
- [ ] RequestBar stacks on mobile (`flex-col`)
- [ ] Sidebar has backdrop in overlay mode

### Phase 7 Accessibility (ALWAYS review thoroughly)
- [ ] Keyboard navigation in all Custom Elements (`keydown` listeners)
- [ ] `querySelectorAll` targets natively focusable elements (verify `tabIndex`)
- [ ] `aria-controls` on tabs → tabpanel
- [ ] `aria-level` on `role="treeitem"` (depth 1=collection, 2=request)
- [ ] `role="listbox"` and `role="option"` on dropdowns
- [ ] `aria-hidden="true"` on decorative SVG icons
- [ ] No nested `<button>` inside `<button>`

### Test Runner Reviews (Vitest)
- [ ] `bun run test` succeeds (NOT `bun test`)
- [ ] `bun run test:coverage` exits 0 AND thresholds pass
- [ ] Per-file coverage meets plan targets (not just global averages)
- [ ] Verify tests actually exercise intended code paths (read coverage line numbers)

## Issue Severity Criteria

### HIGH (blocks approval)
1. Plan requirements not implemented
2. Keyboard navigation missing (WCAG 2.1.1)
3. Responsiveness not functional on specified breakpoints
4. TypeScript errors
5. Build fails
6. Tests fail to run or coverage below plan targets

### MEDIUM (blocks approval)
1. Missing ARIA attributes affecting screen readers
2. Color contrast < 4.5:1 for normal text
3. Invalid HTML semantics (`<button>` inside `<button>`, `<div>` instead of `<button>`)
4. XSS vulnerability (`dangerouslySetInnerHTML` with unescaped external data)
5. Unhandled edge cases that plan implies

### LOW (doesn't block approval)
1. Dead code (unused props, redundant mocks)
2. Minor style inconsistencies
3. Missing documentation/comments
4. Refactoring opportunities

## Project Conventions

- Package manager: **Bun** (`bun run <script>` for npm scripts)
- Framework: **Astro 5** + **Preact** (islands with `client:idle`)
- Tailwind: **v4** (uses `@theme` in CSS, NOT `tailwind.config.js`)
- TypeScript: **strict** (`astro/tsconfigs/strict`)
- Interactivity: **Custom Elements** (Astro pages) + **Preact** (complex islands)
- Signals: `@preact/signals`, `isUpdatingFromParams` flag for bidirectional sync
- Design tokens: `pm-` prefix (`bg-pm-bg-primary`, `text-pm-accent`)

## Important File Locations
- Plan: `docs/[feature]/[feature]-plan.md`
- Review: `docs/[feature]/review/[feature]-review.md` (APPEND, never overwrite)
- Components: `src/components/[area]/ComponentName.astro`
- Scripts: `src/scripts/script-name.ts`
- Mock data: `src/data/mock-name.ts`
- Test factories: `src/test/factories.ts`
- Test setup: `src/test/setup.ts`

## Detailed Review History
See `review-history.md` for detailed learnings from each feature review.
