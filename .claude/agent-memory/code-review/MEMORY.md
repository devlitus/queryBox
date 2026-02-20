# Code Review Agent Memory

## Recurring Patterns in this Project

### Typical Implementation Phase
- Phases 1-5 (foundation, visual components) tend to be implemented well
- Phases 6-7 (responsiveness, accessibility) tend to be incomplete or partial
- Senior developer focuses effort on visual components before responsive/a11y functionality

### Common Accessibility Issues

#### Missing ARIA Attributes (Recurring Pattern)
1. **Tabs**: Forget `aria-controls` linking tab → tabpanel
2. **Trees**: Forget `aria-level` to indicate hierarchy depth
3. **Dropdowns**: Forget `role="listbox"` and `role="option"` on menu items
4. **Decorative icons**: Don't add `aria-hidden="true"` to inline SVGs

#### Keyboard Navigation (CRITICAL - Always verify)
- Custom Elements only implement `click` events
- **Never implement** `keydown` handlers for Arrow keys, Enter, Space, Escape
- This is a **WCAG 2.1 AA blocker** (criterion 2.1.1)
- Expected patterns:
  - Tabs: ArrowLeft/Right to navigate, Enter/Space to activate
  - Dropdowns: ArrowUp/Down to navigate options, Enter to select, Escape to close
  - Trees: ArrowRight (expand), ArrowLeft (collapse), ArrowUp/Down (navigate items)

### Common Responsiveness Issues

#### Breakpoints Implemented Only in CSS
- CSS defines media queries but **NO changes in JSX/HTML** to adapt layout
- Typical example: Media query for mobile but **missing hamburger button in component**

#### RequestBar/Forms Don't Stack on Mobile
- Plan specifies "multiple lines on mobile" but implementation uses only `flex` without responsive `flex-col`
- Need responsive Tailwind classes: `flex md:flex-row flex-col`

### Code Quality - Positive Patterns Observed

#### TypeScript Strict Compliance
- Project uses `astro/tsconfigs/strict` and code always passes `bun astro check`
- Well-defined interfaces for all props and mock data
- No use of `any` types

#### Custom Elements Pattern
- Use guard `if (!customElements.get('name'))` before `customElements.define()`
- This prevents redefinition errors
- Correct pattern observed in `tabs.ts`, `tree.ts`, `dropdown.ts`, `sidebar.ts`

#### DRY Compliance
- Reusable components well implemented (KeyValueTable, CodeViewer, Badge)
- Single component used in multiple contexts (e.g.: KeyValueTable in Params, Headers, Body form-data)

### File Structure vs Plan

- Senior developer **always creates all files** specified in the plan
- Sometimes creates **more files** than necessary (e.g.: 14 icons vs 6-8 expected)
- Structural files never missing, but **functionality within files is missing**

## Optimized Review Checklist

### Phase 1-5 (Usually OK)
- [ ] Verify `bun astro check` (0 errors)
- [ ] Verify `bun build` (successful)
- [ ] Verify design tokens in `@theme`
- [ ] Verify mock data has TypeScript interfaces
- [ ] Verify components have typed props

### Phase 6 (ALWAYS review thoroughly)
- [ ] **Media queries in CSS have corresponding JSX components**
- [ ] Hamburger button exists on mobile/tablet
- [ ] RequestBar uses responsive classes (`flex-col` on mobile)
- [ ] Header simplifies on mobile (search hidden)
- [ ] Sidebar has backdrop in overlay mode

### Phase 7 (ALWAYS review thoroughly)
- [ ] **Keyboard navigation implemented** in all Custom Elements
- [ ] `aria-controls` on tabs links to panels
- [ ] `aria-level` on trees indicates depth
- [ ] `role="listbox"` and `role="option"` on dropdowns
- [ ] `aria-hidden="true"` on all decorative icons
- [ ] Focus trap in open modals/dropdowns
- [ ] Color contrast verified (use devtools)

## Issue Severity - Criteria

### HIGH (Blocks approval)
1. Plan requirements not implemented (complete functionality missing)
2. Keyboard navigation missing (WCAG 2.1.1 violation)
3. Responsiveness not functional on specified breakpoints
4. TypeScript errors (`bun astro check` fails)
5. Build fails

### MEDIUM (Blocks approval)
1. Missing ARIA attributes affecting screen readers
2. Color contrast < 4.5:1 for normal text
3. Incorrect HTML semantics (e.g.: `<div>` with `cursor-pointer` instead of `<button>`)
4. Evident performance issues (bundle size, re-renders)
5. Unhandled edge cases that plan implies

### LOW (Doesn't block approval)
1. Props defined but not used (dead code)
2. Minor style inconsistencies
3. Missing documentation/comments
4. Refactoring opportunities
5. Nice-to-have improvements not in plan

## Verification Commands

```bash
# Always run before reviewing
cd D:/work/queryBox
bun astro check  # TypeScript + Astro validation
bun build        # Production build

# To verify contrast (manual in devtools)
# Chrome DevTools > Elements > Styles > Color picker > Contrast ratio
```

## Notes on queryBox Project

### Project Conventions
- Package manager: **Bun** (not npm/yarn)
- Framework: **Astro 5**
- Tailwind: **v4** (uses `@theme` in CSS, NOT `tailwind.config.js`)
- TypeScript: **Strict mode** (`astro/tsconfigs/strict`)
- Interactivity: **Custom Elements** (not React/Vue/Svelte)

### Design System
- Token prefix: `pm-` (e.g.: `bg-pm-bg-primary`, `text-pm-accent`)
- Fonts: Inter (UI), JetBrains Mono (code)
- Tertiary color adjusted: `#808080` (for WCAG AA compliance)

### Important Locations
- Plan: `docs/[feature]/[feature]-plan.md`
- Review: `docs/[feature]/review/[feature]-review.md` (append, don't overwrite)
- Components: `src/components/[area]/ComponentName.astro`
- Scripts: `src/scripts/script-name.ts`
- Mock data: `src/data/mock-name.ts`

## Learnings from Postman Clone Review

### First Review - What Went Wrong
1. **Responsiveness**: CSS defined but JSX without responsive changes
2. **Keyboard nav**: No Custom Element implemented it initially
3. **ARIA**: Missing 4 specific patterns (controls, level, listbox, hidden)
4. **Mobile UI**: No hamburger, no RequestBar stack, no header simplification

### Second Review - Successful Corrections
**ALL issues were corrected successfully:**
1. ✅ Complete responsiveness: hamburger, backdrop, responsive RequestBar, header simplified
2. ✅ Keyboard navigation: all Custom Elements now have complete keyboard handlers
3. ✅ Complete ARIA: `aria-controls`, `aria-level`, `role="listbox"`, `aria-hidden` implemented
4. ✅ LOW issues corrected: clean props, correct semantics, consistent design tokens

**Correction pattern observed:**
- Senior developer capable of correcting ALL issues when given specific feedback
- Corrections are high quality (no new issues introduced)
- Estimated correction time: ~4-6 hours for 12 issues

### Early Red Flags to Detect
- If I see media queries in CSS but no `md:hidden` or `lg:flex` in components → **HIGH Issue**
- If I see Custom Elements without `addEventListener('keydown')` → **HIGH Issue**
- If I see tabs without `aria-controls` → **MEDIUM Issue**
- If I see SVG icons without `aria-hidden="true"` → **MEDIUM Issue**

### Approved Work Quality
**Postman Clone approved metrics:**
- Structure: 56/53 files (106% of plan)
- TypeScript: 0 errors, 0 warnings
- Build: Successful (957ms)
- WCAG 2.1 AA: Complete
- Responsive: Mobile, tablet, desktop complete
- Keyboard nav: Complete WAI-ARIA patterns

## Learnings from HTTP Client MVP Review (Preact Islands)

### Error Pattern: Framework Integration in astro.config.mjs
- **CRITICAL**: `bun astro check` does NOT verify framework renderers are registered
- Package `@astrojs/preact` can be in `package.json` BUT if not in `integrations: [preact()]` in `astro.config.mjs`, build fails
- Production error: `[NoMatchingRenderer] Unable to render ComponentName`
- **Always verify**: `grep -r "integrations" astro.config.mjs` and compare with installed packages
- `bun run build` is the only command that detects this error (not `bun astro check`)

### Error Pattern: XSS in dangerouslySetInnerHTML
- `dangerouslySetInnerHTML` with third-party data (HTTP responses) is XSS if HTML not escaped
- Plan might say "MVP acceptable" but HTTP responses come from third parties, not just users
- **Always verify**: if `dangerouslySetInnerHTML`, do data come from user input or network?
- Minimum fix: `escapeHtml()` before inserting content in `__html`
- Correct pattern: escape first, then apply highlighting spans

### Error Pattern: Duplicate IDs in Multiple Component Instances on Same Page
- When multiple instances of a tab component on same page (request tabs + response tabs), generate duplicate IDs
- IDs `tabpanel-body` and `tabpanel-headers` appeared in BOTH `RequestConfigTabs` and `ResponseTabs`
- This breaks `aria-controls` and violates HTML specification
- Fix: `idPrefix` prop in reusable `Tabs` component, or unique hardcoded IDs per context

### Quality Observations - Preact Implementation
- Global signals used directly with `.value` in components is idiomatic `@preact/signals` pattern (autotracking)
- Keyboard navigation correctly implemented in Dropdown and Tabs (learned from previous feedback)
- ARIA correctly implemented in Tabs (aria-controls linking correct)
- Bidirectional URL-params sync implemented with `isUpdatingFromParams` flag to prevent re-entry
- `batch()` correctly used for multiple atomic signal updates

### Additional Checklist for Framework Reviews (Preact/React/etc.)
- [ ] `astro.config.mjs` has `integrations: [framework()]`
- [ ] `bun run build` (not just `bun astro check`) passes
- [ ] `dangerouslySetInnerHTML` escapes HTML entities before inserting
- [ ] DOM IDs are unique across entire page (not just per component)

## Learnings from Local Persistence Review (Preact Islands)

### New Error Pattern: Keyboard Handler with Focus Model Mismatch (Tree Navigation)
- In `CollectionPanel.tsx` (2nd review), keyboard handler **present but non-functional**
- Error: `querySelectorAll('[role="treeitem"]')` returns `<li>` without `tabIndex` → not focusable
- `document.activeElement` always a child `<button>` → `items.indexOf(focused) = -1` always
- Result: ArrowDown is silent no-op; ArrowRight/Left never fires (getAttribute("aria-level") on button = null)
- **Correct fix**: change selector to focusable `<button>` within each treeitem, use `closest('[role="treeitem"]')` to read aria-level and data-collection-id to identify collection
- **Red flag when reviewing**: keyboard handler + `querySelectorAll` + `.focus()` → verify elements are natively focusable or have `tabIndex`

### New Error Pattern: Nested `<button>` inside `<button>` (Invalid HTML)
- Senior developer put "delete" button inside "load" button in `HistoryPanel.tsx`
- HTML spec: `<button>` cannot contain interactive content (other buttons, links, inputs)
- Browsers handle this inconsistently; screen readers may ignore inner button
- **Red flag**: If I see a layout of "row with main action + secondary action (delete)", always verify HTML structure

### Local Persistence Review — Final Outcome (3 review cycles)
- Cycle 1: 1 ALTA + 2 MEDIA found. Architecture excellent, issues in a11y/HTML validity.
- Cycle 2: ALTA + MEDIA #1 resolved. MEDIA #2 (keyboard nav) re-attempted but broken — focus model mismatch.
- Cycle 3: MEDIA #2 resolved with `button:first-of-type` selector + `closest()` walkup + `data-collection-id`. APPROVED.
- Approved selector pattern: `'[role="treeitem"] button:first-of-type'` — targets primary action buttons, excludes delete buttons (second sibling), excludes collapsed children (not in DOM).
- Correct expand/collapse pattern: `focused.closest('[role="treeitem"]')` → read `aria-level` and `dataset.collectionId` → call `toggleExpanded(colId)`.
- Total: 3 ALTA/MEDIA issues resolved, 1 BAJA open (non-blocking `defaultName` redundancy in modal).
- Correct fix: Container `<div>` with two `<button>` siblings, NOT `<button>` containing another
- **`CollectionPanel.tsx` used correct pattern** (div with two button siblings) - reference for fix
- Correct pattern also observed in CollectionPanel: `group-hover:opacity-100` to show delete on hover

### Recurring Error Pattern: Missing `aria-level` on Trees
- This is the SECOND review where `aria-level` is missing on `role="treeitem"`
- Senior developer implements `role="tree"`, `role="treeitem"`, `aria-expanded` but forgets `aria-level`
- Fix: `aria-level={1}` on collections (depth 1), `aria-level={2}` on requests (depth 2)

### Overall Quality of Local Persistence Implementation
- Excellent architecture: StorageService with type guards, signal stores with explicit persist, effect() for workbench
- TypeScript: 0 errors, 0 warnings
- Build: successful (1.44s), all modules as separate chunks
- What went well vs Postman Clone: Basic ARIA better implemented, client:idle correctly chosen
- What still fails: `aria-level` + keyboard tree nav + nested interactive elements

## For Next Review

1. **Read complete plan** before reviewing code (5-10 min)
2. **Identify Phase 6 and 7 requirements** specifically
3. **Run verification** (`astro check` + `bun run build`) first - BOTH are necessary
4. **Verify astro.config.mjs** has integrations registered if .tsx/.jsx present
5. **Review dangerouslySetInnerHTML** for HTML escaping if data comes from external sources
6. **Review DOM IDs** for duplicates when multiple instances of reusable components
7. **Review Custom Elements** for keyboard handlers (always missing in first implementation)
8. **Review media queries** against JSX components (always disconnected)
9. **Use grep** to find all `role="tab"`, `role="treeitem"`, etc. and verify ARIA
10. **Generate checklist** of plan compliance before starting detailed review
