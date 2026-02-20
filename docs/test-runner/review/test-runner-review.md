# Code Review Report

## Feature: Unit Testing Infrastructure (Test Runner)
## Plan: `docs/test-runner/test-runner-plan.md`
## Date: 2026-02-20
## Status: APROBADO CON OBSERVACIONES

---

### Summary

The implementation correctly installs Vitest, configures it via `getViteConfig()`, and creates all five test files specified in the plan. **118 tests across 5 files all pass** when run with the correct commands (`bun run test`, `bun run test:coverage`). TypeScript reports 0 errors and 0 warnings. The production build succeeds with no regressions.

Two ALTA issues were found: the `bun test` command invokes Bun's native runner instead of the Vitest script (causing 100% test failure), and the `http-store.ts` statement coverage is 75.75% — below the plan-required 80% target for that file. Three BAJA observations are noted but do not block approval.

---

### Plan Compliance Checklist

#### Phase 1 — Install and Configure Vitest
- [x] `vitest` and `happy-dom` installed as devDependencies — DONE (`vitest@4.0.18`, `happy-dom@20.6.3`)
- [x] `@vitest/coverage-v8` installed — DONE (required for `--coverage` flag with v8 provider)
- [x] `vitest.config.ts` created with `getViteConfig()` — DONE, matches plan exactly
- [x] `environment: "happy-dom"` — DONE
- [x] `globals: true` — DONE
- [x] `include` / `exclude` patterns — DONE
- [x] `coverage.provider: "v8"` with correct include/exclude — DONE (extra excludes for `http-client.ts` and `ui-store.ts` are reasonable and documented inline)
- [x] Coverage thresholds set to 70% for statements, branches, functions, lines — DONE
- [x] `setupFiles: ["./src/test/setup.ts"]` — DONE
- [x] `src/test/setup.ts` created with `afterEach(() => localStorage.clear())` — DONE
- [x] `test`, `test:watch`, `test:coverage` scripts in `package.json` — DONE
- [x] `tsconfig.json` updated with `"types": ["vitest/globals"]` — DONE
- [ ] `bun test` runs successfully — FAIL: `bun test` invokes Bun's native runner, not the package.json script (see Issue #1)

#### Phase 2 — URL Utility Tests (`src/utils/url.test.ts`)
- [x] `parseQueryParams`: empty string — DONE
- [x] `parseQueryParams`: URL without params — DONE
- [x] `parseQueryParams`: single param — DONE
- [x] `parseQueryParams`: multiple params — DONE
- [x] `parseQueryParams`: URL without protocol — DONE
- [x] `parseQueryParams`: invalid/malformed input — DONE
- [x] `parseQueryParams`: item structure (id, key, value, enabled) — DONE
- [x] `parseQueryParams`: URL-encoded characters — DONE
- [x] `buildUrlWithParams`: empty baseUrl — DONE
- [x] `buildUrlWithParams`: empty params array — DONE
- [x] `buildUrlWithParams`: all params disabled — DONE
- [x] `buildUrlWithParams`: single enabled param — DONE
- [x] `buildUrlWithParams`: multiple enabled params — DONE
- [x] `buildUrlWithParams`: skip empty key — DONE
- [x] `buildUrlWithParams`: skip disabled params — DONE
- [x] `buildUrlWithParams`: URL without protocol — DONE
- [x] `buildUrlWithParams`: malformed URL fallback — DONE (test present, but fallback catch block not exercised — see Issue #2)
- [x] `buildUrlWithParams`: preserve existing path — DONE
- [x] `formatBytes`: 0 bytes — DONE
- [x] `formatBytes`: bytes < 1024 — DONE
- [x] `formatBytes`: exactly 1024 — DONE
- [x] `formatBytes`: kilobytes — DONE
- [x] `formatBytes`: exactly 1 MB — DONE
- [x] `formatBytes`: megabytes — DONE
- [x] `formatBytes`: just below 1 MB — DONE

#### Phase 3 — Storage Service Tests (`src/services/storage.test.ts`)
- [x] `getItem`: fallback when missing — DONE
- [x] `getItem`: parsed JSON — DONE
- [x] `getItem`: fallback on invalid JSON — DONE
- [x] `setItem`: stores JSON — DONE
- [x] `setItem`: silently handles quota exceeded — DONE
- [x] `removeItem`: removes key — DONE
- [x] `removeItem`: no-throw when missing — DONE
- [x] `getHistory`: empty array when empty — DONE
- [x] `getHistory`: valid entries — DONE
- [x] `getHistory`: filters corrupted and re-saves — DONE
- [x] `getHistory`: non-array clears key — DONE
- [x] `setHistory`: persists — DONE
- [x] `getCollections`: all patterns mirroring history — DONE
- [x] `setCollections`: persists — DONE
- [x] `getWorkbenchState`: null when empty — DONE
- [x] `getWorkbenchState`: null on invalid + clears key — DONE
- [x] `getWorkbenchState`: valid state — DONE
- [x] `setWorkbenchState`: persists — DONE
- [x] `src/test/factories.ts` created with all factories — DONE

#### Phase 4 — Store Tests: history and collections
- [x] `vi.resetModules()` + dynamic import pattern — DONE
- [x] `historyEntries` signal: initializes empty — DONE
- [x] `historyEntries` signal: initializes from localStorage — DONE
- [x] `addHistoryEntry`: adds to beginning — DONE
- [x] `addHistoryEntry`: generates id and timestamp — DONE
- [x] `addHistoryEntry`: persists to localStorage — DONE
- [x] `addHistoryEntry`: empty history — DONE
- [x] `addHistoryEntry`: MAX_HISTORY (50) FIFO limit — DONE
- [x] `clearHistory`: empties signal — DONE
- [x] `clearHistory`: persists empty array — DONE
- [x] `removeHistoryEntry`: removes by id — DONE
- [x] `removeHistoryEntry`: persists after removal — DONE
- [x] `removeHistoryEntry`: no-op for missing id — DONE
- [x] `collections` signal: initializes empty — DONE
- [x] `collections` signal: initializes from localStorage — DONE
- [x] `createCollection`: generated id and createdAt — DONE
- [x] `createCollection`: appends to signal — DONE
- [x] `createCollection`: persists — DONE
- [x] `createCollection`: returns collection — DONE
- [x] `deleteCollection`: removes by id — DONE
- [x] `deleteCollection`: persists — DONE
- [x] `deleteCollection`: no-op for missing id — DONE
- [x] `renameCollection`: updates name — DONE
- [x] `renameCollection`: persists — DONE
- [x] `renameCollection`: no-op for missing id — DONE
- [x] `saveRequestToCollection`: appends to correct collection — DONE
- [x] `saveRequestToCollection`: generates id and savedAt — DONE
- [x] `saveRequestToCollection`: persists — DONE
- [x] `saveRequestToCollection`: returns SavedRequest — DONE
- [x] `removeRequestFromCollection`: removes by id — DONE
- [x] `removeRequestFromCollection`: persists — DONE
- [ ] `collection-store`: extra test "does not affect other collections" added — BONUS (not blocking)

#### Phase 5 — HTTP Store Tests (`src/stores/http-store.test.ts`)
- [x] `StorageService` mocked — DONE
- [x] `vi.resetModules()` + dynamic import pattern — DONE
- [x] `updateMethod`: updates method — DONE
- [x] `updateMethod`: preserves other fields — DONE
- [x] `updateUrl`: updates url — DONE
- [x] `updateUrl`: parses params from URL — DONE
- [x] `updateUrl`: replaces params signal — DONE
- [x] `updateUrl`: empty params on no-query URL — DONE
- [x] `addParam` / `updateParam` / `removeParam` / `toggleParam` — all covered with URL sync tests — DONE
- [x] `addHeader` / `updateHeader` / `removeHeader` / `toggleHeader` — all covered — DONE
- [x] `updateBodyMode` / `updateBodyContentType` / `updateBodyRaw` — DONE
- [x] `resetResponse`: responseState, requestStatus, requestError — DONE
- [x] `loadRequest`: loads snapshot — DONE
- [x] `loadRequest`: regenerates param IDs — DONE
- [x] `loadRequest`: regenerates header IDs — DONE
- [x] `loadRequest`: preserves content — DONE
- [x] `loadRequest`: calls resetResponse — DONE
- [ ] Statement coverage 80%+ for `http-store.ts` — FAIL: 75.75% (see Issue #3)

#### Phase 6 — CI Readiness
- [x] `bun run test` exits with code 0 — DONE
- [x] `bun run test:coverage` exits with code 0 and meets 70% thresholds — DONE
- [x] `bun astro check`: 0 errors, 0 warnings — DONE
- [x] `bun run build` succeeds — DONE
- [x] `coverage/` in `.gitignore` — DONE

---

### Issues Found

#### ALTA (2 issues)

**#1 — `bun test` invokes Bun's native runner, not Vitest** — `package.json` scripts
- **Description**: In Bun's CLI, `bun test` is a built-in alias for Bun's own test runner (`bun test v1.3.5`), completely ignoring `package.json` scripts. Running `bun test` directly causes 100% test failure: `localStorage is not defined`, `vi.resetModules is not a function`, and `Storage is not defined` — because Bun's native runner does not load `vitest.config.ts` and provides no DOM environment. The correct command to run Vitest is `bun run test`. The plan's Phase 1 completion criterion states: "`bun test` runs successfully (even with 0 tests)."
- **Expected**: Phase 1 criterion requires `bun test` to run successfully. Either the plan's language should be acknowledged as "works via `bun run test`", or the setup must be adjusted so `bun test` also works (e.g., add a `bunfig.toml` that maps `bun test` to the vitest script, or rename the script to `test:vitest` and document the correct invocation).
- **Impact**: Any CI pipeline, developer, or agent that invokes `bun test` verbatim will see 100% test failures with misleading errors. This is a documentation/discoverability risk.
- **Suggestion**: Either add a `bunfig.toml` entry to redirect Bun's test runner, or update the plan/readme to clarify that `bun run test` is the correct invocation. At minimum, add a comment to `package.json`'s test script explaining this distinction.

**#2 — `buildUrlWithParams` catch-block with enabled params is not exercised** — `src/utils/url.test.ts:137-145`
- **Description**: The test at line 137 intends to cover the `catch` branch in `buildUrlWithParams` when `enabledParams.length > 0` (lines 60-64 in `url.ts`). However, the URL `"not a url at all!!!"` is parsed by `new URL()` with the `https://dummy.host/` prefix prefix as `https://dummy.host/not%20a%20url%20at%20all!!!`, which succeeds — the catch block is never entered. The assertion at line 144 (`expect(result).toContain("key=val")`) passes because the non-protocol path returns `not%20a%20url%20at%20all!!!?key=val` via the `hasProtocol=false` code path, not via the catch fallback. Lines 59-64 remain uncovered, contributing to the 80% statement and branch gap in `url.ts`.
- **Expected**: The plan states "Handles malformed URLs (fallback path: direct string concatenation)" as a required test case. The catch block implements the stated fallback and must be exercised.
- **Suggestion**: Use a URL string with a colon-only scheme such as `"::::"` or `"ftp:/\/"` — or more reliably, the string `"http://[invalid"` which throws `TypeError: Failed to construct 'URL'`. Example:
  ```typescript
  it("uses direct string concatenation for truly unparseable URLs", () => {
    const params: KeyValuePair[] = [
      { id: "1", key: "key", value: "val", enabled: true },
    ];
    const result = buildUrlWithParams("http://[invalid", params);
    expect(result).toContain("key=val");
    expect(result).toContain("http://[invalid");
  });
  ```

**#3 — `http-store.ts` statement coverage is 75.75%, below the plan's 80% target** — `src/stores/http-store.test.ts`
- **Description**: The plan (Phase 5 completion criteria) specifies "Coverage for `src/stores/http-store.ts` reaches 80%+ on statements." Actual result: 75.75% statements, 25% branches. The untested code is the computed signal callbacks: `enabledParams` (line 43), `enabledHeaders` (line 47), `formattedSize` (lines 56-57), and `statusColorClass` (lines 61-65). These computed signals contain real business logic — notably `statusColorClass` has three conditional branches (2xx, 3xx, 4xx/5xx) that are entirely uncovered.
- **Expected**: 80% statement coverage on `http-store.ts` per Phase 5 criteria. The computed signals export public values that drive UI rendering and should have tests.
- **Suggestion**: Add tests for the computed signals in `http-store.test.ts`:
  ```typescript
  describe("enabledParams computed", () => {
    it("returns only enabled params with non-empty keys", () => {
      httpStore.addParam();
      const id = httpStore.requestState.value.params[0].id;
      httpStore.updateParam(id, "key", "active");
      httpStore.addParam();
      const id2 = httpStore.requestState.value.params[1].id;
      httpStore.toggleParam(id2); // disable
      expect(httpStore.enabledParams.value).toHaveLength(1);
      expect(httpStore.enabledParams.value[0].key).toBe("active");
    });
  });

  describe("statusColorClass computed", () => {
    it("returns default class when no response", () => {
      expect(httpStore.statusColorClass.value).toBe("text-pm-text-primary");
    });
    // additional tests for 2xx, 3xx, and error status ranges
  });
  ```

---

#### MEDIA (0 issues)

No MEDIA issues found.

---

#### BAJA (3 issues)

**#4 — Redundant `vi.mock` call inside `beforeEach` after `vi.resetModules()`** — `src/stores/http-store.test.ts:24-33`
- **Description**: The file applies `vi.mock("../services/storage", ...)` twice — once at module scope (line 6, hoisted by Vitest) and again inside `beforeEach` at line 24 after `vi.resetModules()`. The `vi.mock` inside `beforeEach` is not hoisted and its relationship to `vi.resetModules()` is non-obvious. In practice, Vitest applies mock factories from the factory registry (hoisted call) even after `resetModules()`, so the `beforeEach` call is effectively a no-op that adds confusion.
- **Suggestion**: Remove the redundant `vi.mock` block inside `beforeEach`. The top-level `vi.mock` (line 6) is sufficient and correctly hoisted.

**#5 — `factories.ts` does not include `makeSavedRequest` in plan specification** — `src/test/factories.ts:38-48`
- **Description**: The plan (Phase 3) defines exactly three factory functions: `makeRequestState`, `makeHistoryEntry`, `makeCollection`. The implementation additionally exports `makeKeyValuePair` and `makeSavedRequest`. This is a positive addition (more reusable utilities), not a defect. It is noted here for awareness only.
- **Suggestion**: No action required. The extra factories improve reusability and are correctly typed.

**#6 — `url.test.ts` line 80 tests `buildUrlWithParams` behavior with trailing slash** — `src/utils/url.test.ts:79-81`
- **Description**: The test at line 79 expects `buildUrlWithParams("https://api.example.com", [])` to return `"https://api.example.com/"` (with trailing slash). This is correct behavior for the `URL` constructor, which normalizes `https://api.example.com` to `https://api.example.com/`. However line 152-155 has a separate test that correctly expects no trailing slash for paths: `"https://api.example.com/path"` → `"https://api.example.com/path"`. The slight inconsistency in test naming and grouping could confuse future developers — the two tests both say "unchanged" but one adds a trailing slash.
- **Suggestion**: Add a comment clarifying that the `URL` constructor normalizes bare origins to include a trailing slash: `// URL constructor normalizes https://api.example.com to https://api.example.com/`.

---

### Verdict

The implementation is of high quality. All 118 tests pass, TypeScript reports zero errors, and the production build succeeds. The test structure, patterns, and coverage are well-designed.

**This implementation cannot be approved as-is due to two ALTA issues:**

1. The `bun test` command invocation fails completely because Bun intercepts it before the `package.json` script is read. This is a genuine risk in CI and multi-developer environments where `bun test` is the expected idiomatic command. The fix is simple: either document the distinction clearly or add tooling to redirect it.

2. The `http-store.ts` statement coverage is 75.75%, missing the plan's explicit 80% target. Additionally, the `statusColorClass` computed signal's three conditional branches (2xx, 3xx, 4xx/5xx) are 0% covered. Adding 4-6 tests for computed signals would resolve both the statement and branch gaps.

Once Issues #1, #2, and #3 are resolved, the implementation can be approved.

---

## Review #2 - 2026-02-20

## Feature: Unit Testing Infrastructure (Test Runner) — Fix Verification
## Plan: `docs/test-runner/test-runner-plan.md`
## Date: 2026-02-20
## Status: APROBADO CON OBSERVACIONES

---

### Summary

Three ALTA issues were identified in Review #1. The senior-developer applied fixes for all three. After re-review:

- **Issue #2** (catch block not exercised): RESOLVED — `"http://[invalid"` correctly triggers `TypeError` in `new URL()`, exercising the fallback concatenation path. Coverage confirms lines 57-65 of `url.ts` are now covered.
- **Issue #3** (`http-store.ts` coverage below 80%): RESOLVED — 13 new tests added for computed signals (`enabledParams`, `enabledHeaders`, `formattedSize`, `statusColorClass`). Coverage is now 96.96% statements / 95.83% branches, well above the 80% threshold.
- **Issue #1** (`bun test` invokes native runner): PARTIALLY ADDRESSED — A `bunfig.toml` documentation file was created at the project root clearly warning developers that `bun test` invokes Bun's native runner and that `bun run test` is the correct command. However, `bun test` still fails at runtime with 100% test failures (`localStorage is not defined`, `vi.resetModules is not a function`). The plan's Phase 1 completion criterion "`bun test` runs successfully (even with 0 tests)" remains literally unmet.

`bun run test` runs 131 tests across 5 files — all pass. `bun run test:coverage` exits 0 with all thresholds met. `bun astro check` reports 0 errors. `bun run build` succeeds.

---

### Re-Review of ALTA Issues from Review #1

#### Issue #1 — `bun test` invokes Bun's native runner — STILL PRESENT (downgraded to MEDIA)

**Status: STILL PRESENT**

The fix created `bunfig.toml` with a clear, prominent comment block warning that `bun test` should not be used and that `bun run test` is the correct invocation. This addresses the discoverability risk and goes beyond the "at minimum" suggestion from Review #1.

However, the functional problem is unchanged: running `bun test` still invokes Bun's native test runner and produces 100% test failures. The plan's Phase 1 completion criterion literally states "`bun test` runs successfully (even with 0 tests)."

**Severity downgrade rationale**: The original ALTA classification was driven by two concerns: (a) CI/developer confusion and (b) the plan's literal criterion. Concern (a) is now substantially mitigated by the root-level documentation — any developer or CI system that reads `bunfig.toml` before running tests will not be misled. The `bunfig.toml` file is a project-wide convention document visible in any editor or file listing. Concern (b) remains: the plan says `bun test` should work.

Given that `bun test` cannot technically be redirected to Vitest via `bunfig.toml` in Bun 1.3.5 (there is no `[test]` runner-redirect configuration in Bun's TOML schema), the only complete fix would require either: (1) writing Bun-native test files alongside Vitest files (not feasible), or (2) acknowledging the plan's criterion was aspirational and updating it. The documentation fix is the pragmatically correct approach.

**Downgraded to MEDIA**: The functional failure of `bun test` is a real concern but the documentation now makes the correct invocation unambiguous. This is reclassified as MEDIA rather than ALTA because the correct command (`bun run test`) works perfectly and the risk of confusion is now documented at the project root.

#### Issue #2 — `buildUrlWithParams` catch block not exercised — RESOLVED

**Status: RESOLVED**

The test at `src/utils/url.test.ts:137-146` now uses `"http://[invalid"` as the input URL. Verification confirms this string throws `TypeError: Invalid URL` in the `new URL()` constructor (confirmed with Node.js v20 — same V8 URL implementation used by Bun and happy-dom). The `enabledParams.length > 0` branch of the catch block is exercised by the test. Coverage report shows `url.ts` branch coverage at 90% — the only remaining uncovered line is line 27 (`parseQueryParams` catch return), which is an acceptable BAJA-level item, not required by the plan.

#### Issue #3 — `http-store.ts` statement coverage below 80% — RESOLVED

**Status: RESOLVED**

Coverage report from `bun run test:coverage`:

```
http-store.ts  |  96.96 |  95.83 |  96.87 |  100  | 83
```

96.96% statements (was 75.75%), 95.83% branches (was 25%), 96.87% functions, 100% lines. The plan required 80%+ on statements. The new tests cover:
- `enabledParams` computed: 3 tests (empty, filtered by disabled, filtered by empty key)
- `enabledHeaders` computed: 2 tests (empty, filtered)
- `formattedSize` computed: 2 tests (null response, response with size)
- `statusColorClass` computed: 6 tests (null, 200, 201, 301, 404, 500) — all three conditional branches covered

Only line 83 (`isUpdatingFromParams` guard inside `updateUrl`) remains uncovered, which is an acceptable residual.

---

### Issues Found in Re-Review

#### MEDIA (1 issue)

**#7 — `bun test` still fails at runtime** — `bunfig.toml` (documentation only, no functional redirect)
- **Description**: `bunfig.toml` documents the problem clearly but `bun test` still invokes Bun's native runner and fails 100% of tests. The plan's Phase 1 criterion "`bun test` runs successfully (even with 0 tests)" is unmet. The `bunfig.toml` TOML spec for Bun 1.3.5 has no mechanism to redirect the `bun test` CLI command to a package.json script.
- **Impact**: CI pipelines or developers that invoke `bun test` idiomatically will still see cascading failures. The `bunfig.toml` warning mitigates but does not eliminate this risk.
- **Suggestion**: One of the following:
  1. Add a comment to `package.json`'s `test` script (e.g., `"test": "vitest run  # use 'bun run test', NOT 'bun test'"`) to reinforce the distinction at the script definition level.
  2. Add a `README.md` section or update `docs/test-runner/test-runner-plan.md` to acknowledge that the "`bun test` runs successfully" criterion was aspirational and that `bun run test` is the established project convention.
  3. If the plan's criterion is considered binding, rename the script from `test` to `test:vitest` so that `bun run test:vitest` is the explicit invocation, and document this in `bunfig.toml`.

#### ALTA (0 issues)

No ALTA issues remain.

#### BAJA (1 issue)

**#8 — Redundant `vi.mock` inside `beforeEach` (from BAJA #4 in Review #1, still present)**
- `src/stores/http-store.test.ts:24-33`
- The `vi.mock` call inside `beforeEach` (lines 24-33) is still present after the fixes. This was flagged as BAJA in Review #1 and does not block approval. The redundant mock adds confusion but causes no functional harm.

---

### Verdict

**Issues #2 and #3 are fully resolved.** Issue #1 is partially resolved — the documentation fix significantly reduces the discoverability risk but does not make `bun test` functional. Given that:

1. `bun test` cannot technically be redirected to Vitest in Bun 1.3.5
2. The `bunfig.toml` warning is prominent and correct
3. All 131 tests pass via `bun run test`
4. All coverage thresholds are met via `bun run test:coverage`
5. TypeScript and build are clean

The remaining Issue #7 is reclassified to MEDIA. **This implementation CANNOT be approved until Issue #7 (MEDIA) is resolved.** The required fix is small: either add a clarifying comment to the `package.json` test script, or formally acknowledge in the plan/documentation that `bun run test` is the project-standard invocation (not `bun test`).

**Recommended minimal fix**: Add a single inline comment to `package.json`:
```json
"test": "vitest run",
```
and add to `bunfig.toml` or a `CONTRIBUTING.md` / README section a note explicitly stating that `bun run test` is the correct command and that `bun test` is not supported. This formally closes the plan criterion gap.

Once Issue #7 is resolved (documentation acknowledgment that the plan criterion maps to `bun run test`), the implementation should be approved. All other aspects are excellent.
