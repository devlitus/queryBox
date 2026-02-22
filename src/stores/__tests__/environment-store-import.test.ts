import { describe, it, expect, beforeEach, vi } from "vitest";
import { makeEnvironment, makeEnvironmentVariable } from "../../test/factories";

let environmentStore: typeof import("../environment-store");

beforeEach(async () => {
  vi.resetModules();
  localStorage.clear();
  environmentStore = await import("../environment-store");
});

// ---------------------------------------------------------------------------
// importEnvironments — replace strategy
// ---------------------------------------------------------------------------

describe("importEnvironments — replace strategy", () => {
  it("replaces existing environments with imported ones", () => {
    environmentStore.createEnvironment("Old Env");
    expect(environmentStore.environments.value).toHaveLength(1);

    const imported = [
      makeEnvironment({ id: "e1", name: "New Env A" }),
      makeEnvironment({ id: "e2", name: "New Env B" }),
    ];
    environmentStore.importEnvironments(imported, "replace");

    expect(environmentStore.environments.value).toHaveLength(2);
    expect(environmentStore.environments.value.map((e) => e.name)).toContain("New Env A");
    expect(environmentStore.environments.value.map((e) => e.name)).not.toContain("Old Env");
  });

  it("regenerates IDs for all imported environments on replace", () => {
    const imported = [makeEnvironment({ id: "original-id", name: "Regen" })];
    environmentStore.importEnvironments(imported, "replace");

    const stored = environmentStore.environments.value[0];
    expect(stored.id).not.toBe("original-id");
    expect(typeof stored.id).toBe("string");
    expect(stored.id.length).toBeGreaterThan(0);
  });

  it("regenerates IDs for nested variables on replace", () => {
    const variable = makeEnvironmentVariable({ id: "original-var-id", key: "apiKey" });
    const env = makeEnvironment({ id: "e1", variables: [variable] });
    environmentStore.importEnvironments([env], "replace");

    const storedVar = environmentStore.environments.value[0].variables[0];
    expect(storedVar.id).not.toBe("original-var-id");
  });

  it("returns correct counts for replace", () => {
    environmentStore.createEnvironment("Existing");
    const imported = [
      makeEnvironment({ id: "e1", name: "A" }),
      makeEnvironment({ id: "e2", name: "B" }),
    ];
    const result = environmentStore.importEnvironments(imported, "replace");

    expect(result.added).toBe(2);
    expect(result.skipped).toBe(0);
  });

  it("resets activeEnvironmentId when the active environment is removed by replace", async () => {
    // Create an environment and set it as active
    const env = environmentStore.createEnvironment("Will Be Replaced");
    environmentStore.setActiveEnvironment(env.id);
    expect(environmentStore.activeEnvironmentId.value).toBe(env.id);

    // Replace with completely different environments
    const imported = [makeEnvironment({ id: "new-e1", name: "Replacement" })];
    environmentStore.importEnvironments(imported, "replace");

    // The active environment ID no longer exists in the new list — should be null
    expect(environmentStore.activeEnvironmentId.value).toBeNull();
    expect(localStorage.getItem("qb:active-environment")).toBeNull();
  });

  it("does NOT reset activeEnvironmentId if the new environments happen to keep the same ID", async () => {
    // This tests the edge case: after replace, the new IDs are regenerated so
    // the active ID is always gone. The reset should always fire if activeId was set.
    const env = environmentStore.createEnvironment("Active Env");
    environmentStore.setActiveEnvironment(env.id);

    const imported = [makeEnvironment({ id: "whatever", name: "Different" })];
    environmentStore.importEnvironments(imported, "replace");

    // Old ID is definitely gone — activeEnvironmentId must be null
    expect(environmentStore.activeEnvironmentId.value).toBeNull();
  });

  it("does not reset activeEnvironmentId if it was already null", () => {
    expect(environmentStore.activeEnvironmentId.value).toBeNull();
    const imported = [makeEnvironment({ id: "e1", name: "New" })];
    environmentStore.importEnvironments(imported, "replace");

    // Still null — no unnecessary writes
    expect(environmentStore.activeEnvironmentId.value).toBeNull();
  });

  it("persists replaced environments to localStorage", () => {
    const imported = [makeEnvironment({ id: "p1", name: "Persisted" })];
    environmentStore.importEnvironments(imported, "replace");

    const stored = JSON.parse(localStorage.getItem("qb:environments") ?? "[]");
    expect(stored).toHaveLength(1);
    expect(stored[0].name).toBe("Persisted");
  });

  it("handles empty import array on replace", () => {
    environmentStore.createEnvironment("Existing");
    const result = environmentStore.importEnvironments([], "replace");

    expect(environmentStore.environments.value).toHaveLength(0);
    expect(result.added).toBe(0);
    expect(result.skipped).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// importEnvironments — merge strategy
// ---------------------------------------------------------------------------

describe("importEnvironments — merge strategy", () => {
  it("adds environments whose names do not exist", () => {
    environmentStore.createEnvironment("Existing");
    const imported = [
      makeEnvironment({ id: "e1", name: "New A" }),
      makeEnvironment({ id: "e2", name: "New B" }),
    ];
    environmentStore.importEnvironments(imported, "merge");

    expect(environmentStore.environments.value).toHaveLength(3);
  });

  it("skips environments with duplicate names (case-insensitive)", () => {
    environmentStore.createEnvironment("My Environment");
    const imported = [
      makeEnvironment({ id: "e1", name: "my environment" }), // lowercase duplicate
      makeEnvironment({ id: "e2", name: "MY ENVIRONMENT" }), // uppercase duplicate
      makeEnvironment({ id: "e3", name: "Unique" }), // new
    ];
    const result = environmentStore.importEnvironments(imported, "merge");

    expect(environmentStore.environments.value).toHaveLength(2);
    expect(result.added).toBe(1);
    expect(result.skipped).toBe(2);
  });

  it("regenerates IDs for merged environments", () => {
    const imported = [makeEnvironment({ id: "original-id", name: "Merged" })];
    environmentStore.importEnvironments(imported, "merge");

    const added = environmentStore.environments.value.find((e) => e.name === "Merged");
    expect(added?.id).not.toBe("original-id");
  });

  it("preserves existing environments during merge", () => {
    const existing = environmentStore.createEnvironment("Keep Me");
    const imported = [makeEnvironment({ id: "new-id", name: "Added" })];
    environmentStore.importEnvironments(imported, "merge");

    const kept = environmentStore.environments.value.find((e) => e.id === existing.id);
    expect(kept).toBeDefined();
    expect(kept?.name).toBe("Keep Me");
  });

  it("returns correct counts for merge", () => {
    environmentStore.createEnvironment("Duplicate");
    const imported = [
      makeEnvironment({ id: "e1", name: "duplicate" }), // skipped
      makeEnvironment({ id: "e2", name: "Brand New" }),
    ];
    const result = environmentStore.importEnvironments(imported, "merge");

    expect(result.added).toBe(1);
    expect(result.skipped).toBe(1);
  });

  it("does NOT reset activeEnvironmentId during merge", () => {
    const env = environmentStore.createEnvironment("Active");
    environmentStore.setActiveEnvironment(env.id);

    const imported = [makeEnvironment({ id: "e1", name: "New Env" })];
    environmentStore.importEnvironments(imported, "merge");

    // Active environment is still active — merge should not touch it
    expect(environmentStore.activeEnvironmentId.value).toBe(env.id);
  });

  it("persists merged environments to localStorage", () => {
    const imported = [makeEnvironment({ id: "p1", name: "Merged Persisted" })];
    environmentStore.importEnvironments(imported, "merge");

    const stored = JSON.parse(localStorage.getItem("qb:environments") ?? "[]");
    expect(stored.some((e: { name: string }) => e.name === "Merged Persisted")).toBe(true);
  });

  it("preserves variables in imported environments during merge", () => {
    const variable = makeEnvironmentVariable({ id: "v1", key: "apiKey", value: "secret" });
    const env = makeEnvironment({ id: "e1", name: "With Vars", variables: [variable] });
    environmentStore.importEnvironments([env], "merge");

    const added = environmentStore.environments.value.find((e) => e.name === "With Vars");
    expect(added?.variables).toHaveLength(1);
    expect(added?.variables[0].key).toBe("apiKey");
    expect(added?.variables[0].value).toBe("secret");
  });

  it("deduplicates across imported items themselves during merge", () => {
    const imported = [
      makeEnvironment({ id: "e1", name: "Dup" }),
      makeEnvironment({ id: "e2", name: "dup" }), // same name as above
    ];
    const result = environmentStore.importEnvironments(imported, "merge");

    expect(environmentStore.environments.value).toHaveLength(1);
    expect(result.added).toBe(1);
    expect(result.skipped).toBe(1);
  });
});
