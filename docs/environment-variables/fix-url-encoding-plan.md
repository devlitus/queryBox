# Bug Fix: Variable Interpolation URL Encoding

## Feature Branch
`feature/environment-variables`

## Bug Report
`"%7B%7BbaseUrl%7D%7D/users" is not a valid URL. Make sure it starts with http:// or https://.`

`%7B%7B` is the percent-encoded form of `{{`, and `%7D%7D` is `}}`. The variable placeholder `{{baseUrl}}` is being URL-encoded before interpolation occurs, making the regex unable to find and replace it.

---

## Root Cause Analysis

### Primary Bug — `resolvedUrl` built from URL-encoded string

**Data flow** in `http-client.ts`:

```
fullUrl.value
  ↓ calls buildUrlWithParams(state.url, state.params)
  ↓ buildUrlWithParams calls new URL("https://dummy.host/{{baseUrl}}/users")
  ↓ new URL() percent-encodes { → %7B, } → %7D
  = "%7B%7BbaseUrl%7D%7D/users"          ← this is url

interpolateVariables(url, variables)
  ↓ regex /\{\{([^}]+)\}\}/g searches in "%7B%7BbaseUrl%7D%7D/users"
  ↓ no matches found ({{...}} is now %7B%7B...%7D%7D)
  = "%7B%7BbaseUrl%7D%7D/users"          ← resolvedUrl unchanged

new URL(resolvedUrl) throws
  → "not a valid URL" error shown to user
```

**Why `interpolatedState` is correct but `resolvedUrl` is not**:

`interpolateRequest(state, variables)` works correctly because it operates directly on `state.url` (the raw string `"{{baseUrl}}/users"`), before any URL encoding happens. The bug is only in how `resolvedUrl` is computed — it uses `fullUrl.value` instead of the already-interpolated state.

### Secondary Bug — History stores URL-encoded template URL

In `http-client.ts` line 169:
```typescript
addHistoryEntry({
  url: url,  // url = fullUrl.value = "%7B%7BbaseUrl%7D%7D/users" ← wrong
  ...
```

ADR-5 in the feature plan states: *"Store unresolved (raw) URLs containing `{{variableName}}` in history entries."* Using `fullUrl.value` violates this by storing the URL-encoded version. History entries should display `{{baseUrl}}/users`, not `%7B%7BbaseUrl%7D%7D/users`.

---

## Fix

### Only file modified: `src/services/http-client.ts`

#### Change 1 — Add `buildUrlWithParams` import

```typescript
// Add to existing imports from "../utils/url"
import { buildUrlWithParams } from "../utils/url";
```

#### Change 2 — Fix `resolvedUrl` computation

**Before** (buggy):
```typescript
const url = fullUrl.value;
// ...
const resolvedUrl = variables.size > 0
  ? interpolateVariables(url, variables)
  : url;
```

**After** (fixed):
```typescript
// Build resolvedUrl AFTER interpolation, from the already-interpolated state.
// Using fullUrl.value here would URL-encode {{...}} before interpolation,
// making the regex unable to match them. See: fix-url-encoding-plan.md
const resolvedUrl = buildUrlWithParams(interpolatedState.url, interpolatedState.params);
```

**Why this works**:
- `interpolatedState.url` is already the resolved string (e.g., `"https://api.example.com"`)
- `buildUrlWithParams` then constructs the full URL with resolved params
- No `{{...}}` placeholders remain when `buildUrlWithParams` calls `new URL()`, so no incorrect encoding occurs
- When no environment is active, `interpolatedState === state` (fast path), so behavior is identical to before

#### Change 3 — Fix history URL storage

**Before** (stores URL-encoded template):
```typescript
addHistoryEntry({
  url: url,  // fullUrl.value — URL-encoded
```

**After** (stores raw unresolved template, per ADR-5):
```typescript
addHistoryEntry({
  url: state.url,  // raw URL without percent-encoding, preserves {{variables}}
```

Note: `requestSnapshot: structuredClone(state)` already contains the full params, so display components can reconstruct the full URL with params if needed.

#### Change 4 — Remove unused `url` variable

After changes 2 and 3, `const url = fullUrl.value` is no longer used. Remove it and the `fullUrl` import from `http-store`.

---

## Acceptance Criteria

- [ ] Entering `{{baseUrl}}/users` as URL with `baseUrl=https://jsonplaceholder.typicode.com` in the active environment resolves and sends the request successfully
- [ ] The URL `{{baseUrl}}/users` is shown in the VariableIndicator (indicator still works)
- [ ] History entry shows `{{baseUrl}}/users` (unresolved), not `%7B%7BbaseUrl%7D%7D/users`
- [ ] Switching to "No Environment" and sending shows "not a valid URL" error (correct behavior per plan)
- [ ] When no environment is active, requests without variables work identically to before
- [ ] `bun astro check` passes with zero errors
- [ ] `bun build` succeeds
- [ ] `bun run test` passes all existing tests

---

## Affected Files

| File | Action |
|------|--------|
| `src/services/http-client.ts` | MODIFY — fix `resolvedUrl`, fix history `url`, remove unused variable |

**Total**: 1 file modified, ~10 lines changed.

---

## Complexity
Very Low — the fix is a targeted change to one function in one file. No new logic is introduced; the fix reuses `buildUrlWithParams` (already imported in the project) and the existing `interpolatedState` that is already correctly computed.
