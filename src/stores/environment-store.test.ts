import { describe, it, expect, beforeEach, vi } from "vitest";
import { makeEnvironment } from "../test/factories";

// Use dynamic import + vi.resetModules() so each test group gets a fresh
// module instance with clean signal state (module-level signal reads localStorage on load).
let envStore: typeof import("./environment-store");

beforeEach(async () => {
  vi.resetModules();
  localStorage.clear();
  envStore = await import("./environment-store");
});

// ---------------------------------------------------------------------------
// Signal initialization
// ---------------------------------------------------------------------------

describe("environments signal initialization", () => {
  it("initializes to empty array when localStorage is empty", () => {
    expect(envStore.environments.value).toEqual([]);
  });

  it("initializes from localStorage on module load", async () => {
    const env = makeEnvironment({ id: "pre-loaded" });
    localStorage.setItem("qb:environments", JSON.stringify([env]));
    vi.resetModules();
    const freshStore = await import("./environment-store");
    expect(freshStore.environments.value).toHaveLength(1);
    expect(freshStore.environments.value[0].id).toBe("pre-loaded");
  });
});

describe("activeEnvironmentId signal initialization", () => {
  it("initializes to null when localStorage is empty", () => {
    expect(envStore.activeEnvironmentId.value).toBeNull();
  });

  it("initializes from localStorage on module load", async () => {
    localStorage.setItem("qb:active-environment", JSON.stringify("env-abc"));
    vi.resetModules();
    const freshStore = await import("./environment-store");
    expect(freshStore.activeEnvironmentId.value).toBe("env-abc");
  });
});

// ---------------------------------------------------------------------------
// activeEnvironment computed
// ---------------------------------------------------------------------------

describe("activeEnvironment computed", () => {
  it("returns null when no environment is active", () => {
    expect(envStore.activeEnvironment.value).toBeNull();
  });

  it("returns the matching environment when activeEnvironmentId is set", () => {
    const env = envStore.createEnvironment("Dev");
    envStore.setActiveEnvironment(env.id);
    expect(envStore.activeEnvironment.value?.id).toBe(env.id);
    expect(envStore.activeEnvironment.value?.name).toBe("Dev");
  });

  it("returns null when activeEnvironmentId points to a deleted environment", () => {
    const env = envStore.createEnvironment("Temp");
    envStore.setActiveEnvironment(env.id);
    envStore.deleteEnvironment(env.id);
    expect(envStore.activeEnvironment.value).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// activeVariablesMap computed
// ---------------------------------------------------------------------------

describe("activeVariablesMap computed", () => {
  it("returns empty Map when no active environment", () => {
    expect(envStore.activeVariablesMap.value.size).toBe(0);
  });

  it("returns empty Map when active environment has no variables", () => {
    const env = envStore.createEnvironment("Empty");
    envStore.setActiveEnvironment(env.id);
    expect(envStore.activeVariablesMap.value.size).toBe(0);
  });

  it("returns Map with only enabled variables", () => {
    const env = envStore.createEnvironment("Dev");
    envStore.setActiveEnvironment(env.id);
    envStore.addVariable(env.id);
    envStore.addVariable(env.id);

    const vars = envStore.environments.value[0].variables;
    const [var1, var2] = vars;

    envStore.updateVariable(env.id, var1.id, "key", "host");
    envStore.updateVariable(env.id, var1.id, "value", "example.com");
    envStore.updateVariable(env.id, var2.id, "key", "disabled");
    envStore.updateVariable(env.id, var2.id, "value", "secret");
    envStore.updateVariable(env.id, var2.id, "enabled", false);

    const map = envStore.activeVariablesMap.value;
    expect(map.size).toBe(1);
    expect(map.get("host")).toBe("example.com");
    expect(map.has("disabled")).toBe(false);
  });

  it("excludes variables with empty key", () => {
    const env = envStore.createEnvironment("Dev");
    envStore.setActiveEnvironment(env.id);
    envStore.addVariable(env.id);
    // key is "" by default — should be excluded
    const map = envStore.activeVariablesMap.value;
    expect(map.size).toBe(0);
  });

  it("returns correct Map for multiple enabled variables", () => {
    const env = envStore.createEnvironment("Staging");
    envStore.setActiveEnvironment(env.id);
    envStore.addVariable(env.id);
    envStore.addVariable(env.id);

    const vars = envStore.environments.value[0].variables;
    envStore.updateVariable(env.id, vars[0].id, "key", "baseUrl");
    envStore.updateVariable(env.id, vars[0].id, "value", "https://staging.example.com");
    envStore.updateVariable(env.id, vars[1].id, "key", "apiKey");
    envStore.updateVariable(env.id, vars[1].id, "value", "staging-key-123");

    const map = envStore.activeVariablesMap.value;
    expect(map.size).toBe(2);
    expect(map.get("baseUrl")).toBe("https://staging.example.com");
    expect(map.get("apiKey")).toBe("staging-key-123");
  });
});

// ---------------------------------------------------------------------------
// createEnvironment
// ---------------------------------------------------------------------------

describe("createEnvironment", () => {
  it("creates environment with generated id and createdAt", () => {
    const env = envStore.createEnvironment("Production");
    expect(typeof env.id).toBe("string");
    expect(env.id.length).toBeGreaterThan(0);
    expect(typeof env.createdAt).toBe("number");
    expect(env.name).toBe("Production");
    expect(env.variables).toEqual([]);
  });

  it("appends to the environments signal", () => {
    envStore.createEnvironment("First");
    envStore.createEnvironment("Second");
    expect(envStore.environments.value).toHaveLength(2);
    expect(envStore.environments.value[1].name).toBe("Second");
  });

  it("persists to localStorage", () => {
    envStore.createEnvironment("Persisted");
    const stored = JSON.parse(localStorage.getItem("qb:environments") ?? "[]");
    expect(stored).toHaveLength(1);
    expect(stored[0].name).toBe("Persisted");
  });

  it("returns the created Environment object", () => {
    const returned = envStore.createEnvironment("Returned");
    const inSignal = envStore.environments.value[0];
    expect(returned.id).toBe(inSignal.id);
    expect(returned.name).toBe("Returned");
  });
});

// ---------------------------------------------------------------------------
// deleteEnvironment
// ---------------------------------------------------------------------------

describe("deleteEnvironment", () => {
  it("removes environment by id", () => {
    const env = envStore.createEnvironment("ToDelete");
    envStore.deleteEnvironment(env.id);
    expect(envStore.environments.value).toHaveLength(0);
  });

  it("persists updated list after deletion", () => {
    const env = envStore.createEnvironment("Gone");
    envStore.deleteEnvironment(env.id);
    const stored = JSON.parse(localStorage.getItem("qb:environments") ?? "[]");
    expect(stored).toHaveLength(0);
  });

  it("is a no-op when id does not exist", () => {
    envStore.createEnvironment("Kept");
    envStore.deleteEnvironment("nonexistent-id");
    expect(envStore.environments.value).toHaveLength(1);
  });

  it("clears activeEnvironmentId when deleting the active environment", () => {
    const env = envStore.createEnvironment("Active");
    envStore.setActiveEnvironment(env.id);
    expect(envStore.activeEnvironmentId.value).toBe(env.id);
    envStore.deleteEnvironment(env.id);
    expect(envStore.activeEnvironmentId.value).toBeNull();
  });

  it("persists cleared activeEnvironmentId when deleting the active environment", () => {
    const env = envStore.createEnvironment("Active");
    envStore.setActiveEnvironment(env.id);
    envStore.deleteEnvironment(env.id);
    expect(localStorage.getItem("qb:active-environment")).toBeNull();
  });

  it("does NOT clear activeEnvironmentId when deleting a different environment", () => {
    const env1 = envStore.createEnvironment("Active");
    const env2 = envStore.createEnvironment("Other");
    envStore.setActiveEnvironment(env1.id);
    envStore.deleteEnvironment(env2.id);
    expect(envStore.activeEnvironmentId.value).toBe(env1.id);
  });
});

// ---------------------------------------------------------------------------
// renameEnvironment
// ---------------------------------------------------------------------------

describe("renameEnvironment", () => {
  it("updates the name of the matching environment", () => {
    const env = envStore.createEnvironment("OldName");
    envStore.renameEnvironment(env.id, "NewName");
    expect(envStore.environments.value[0].name).toBe("NewName");
  });

  it("persists updated list after rename", () => {
    const env = envStore.createEnvironment("OldName");
    envStore.renameEnvironment(env.id, "NewName");
    const stored = JSON.parse(localStorage.getItem("qb:environments") ?? "[]");
    expect(stored[0].name).toBe("NewName");
  });

  it("is a no-op when id does not exist", () => {
    envStore.createEnvironment("Unchanged");
    envStore.renameEnvironment("nonexistent-id", "ShouldNotApply");
    expect(envStore.environments.value[0].name).toBe("Unchanged");
  });
});

// ---------------------------------------------------------------------------
// duplicateEnvironment
// ---------------------------------------------------------------------------

describe("duplicateEnvironment", () => {
  it("returns null when source id does not exist", () => {
    const result = envStore.duplicateEnvironment("nonexistent");
    expect(result).toBeNull();
    expect(envStore.environments.value).toHaveLength(0);
  });

  it("creates a copy with '(Copy)' appended to the name", () => {
    const env = envStore.createEnvironment("Original");
    const copy = envStore.duplicateEnvironment(env.id);
    expect(copy?.name).toBe("Original (Copy)");
  });

  it("gives the copy a new unique id", () => {
    const env = envStore.createEnvironment("Original");
    const copy = envStore.duplicateEnvironment(env.id);
    expect(copy?.id).not.toBe(env.id);
  });

  it("copies variables with new ids", () => {
    const env = envStore.createEnvironment("Original");
    envStore.addVariable(env.id);
    const originalVarId = envStore.environments.value[0].variables[0].id;
    const copy = envStore.duplicateEnvironment(env.id);
    expect(copy?.variables).toHaveLength(1);
    expect(copy?.variables[0].id).not.toBe(originalVarId);
  });

  it("appends duplicate to the environments list", () => {
    const env = envStore.createEnvironment("Original");
    envStore.duplicateEnvironment(env.id);
    expect(envStore.environments.value).toHaveLength(2);
    expect(envStore.environments.value[1].name).toBe("Original (Copy)");
  });

  it("persists to localStorage", () => {
    const env = envStore.createEnvironment("Original");
    envStore.duplicateEnvironment(env.id);
    const stored = JSON.parse(localStorage.getItem("qb:environments") ?? "[]");
    expect(stored).toHaveLength(2);
    expect(stored[1].name).toBe("Original (Copy)");
  });
});

// ---------------------------------------------------------------------------
// setActiveEnvironment
// ---------------------------------------------------------------------------

describe("setActiveEnvironment", () => {
  it("sets the active environment id", () => {
    const env = envStore.createEnvironment("Dev");
    envStore.setActiveEnvironment(env.id);
    expect(envStore.activeEnvironmentId.value).toBe(env.id);
  });

  it("persists the active environment id to localStorage", () => {
    const env = envStore.createEnvironment("Dev");
    envStore.setActiveEnvironment(env.id);
    const stored = JSON.parse(localStorage.getItem("qb:active-environment") ?? "null");
    expect(stored).toBe(env.id);
  });

  it("accepts null to clear the active environment", () => {
    const env = envStore.createEnvironment("Dev");
    envStore.setActiveEnvironment(env.id);
    envStore.setActiveEnvironment(null);
    expect(envStore.activeEnvironmentId.value).toBeNull();
    expect(localStorage.getItem("qb:active-environment")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// addVariable
// ---------------------------------------------------------------------------

describe("addVariable", () => {
  it("appends a new empty variable to the environment", () => {
    const env = envStore.createEnvironment("Dev");
    envStore.addVariable(env.id);
    const variables = envStore.environments.value[0].variables;
    expect(variables).toHaveLength(1);
    expect(variables[0].key).toBe("");
    expect(variables[0].value).toBe("");
    expect(variables[0].enabled).toBe(true);
  });

  it("generates a unique id for the new variable", () => {
    const env = envStore.createEnvironment("Dev");
    envStore.addVariable(env.id);
    envStore.addVariable(env.id);
    const variables = envStore.environments.value[0].variables;
    expect(variables[0].id).not.toBe(variables[1].id);
  });

  it("persists after adding a variable", () => {
    const env = envStore.createEnvironment("Dev");
    envStore.addVariable(env.id);
    const stored = JSON.parse(localStorage.getItem("qb:environments") ?? "[]");
    expect(stored[0].variables).toHaveLength(1);
  });

  it("is a no-op when envId does not exist", () => {
    envStore.addVariable("nonexistent");
    expect(envStore.environments.value).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// updateVariable
// ---------------------------------------------------------------------------

describe("updateVariable", () => {
  it("updates the key field of a variable", () => {
    const env = envStore.createEnvironment("Dev");
    envStore.addVariable(env.id);
    const varId = envStore.environments.value[0].variables[0].id;
    envStore.updateVariable(env.id, varId, "key", "baseUrl");
    expect(envStore.environments.value[0].variables[0].key).toBe("baseUrl");
  });

  it("updates the value field of a variable", () => {
    const env = envStore.createEnvironment("Dev");
    envStore.addVariable(env.id);
    const varId = envStore.environments.value[0].variables[0].id;
    envStore.updateVariable(env.id, varId, "value", "https://api.example.com");
    expect(envStore.environments.value[0].variables[0].value).toBe("https://api.example.com");
  });

  it("updates the enabled field of a variable", () => {
    const env = envStore.createEnvironment("Dev");
    envStore.addVariable(env.id);
    const varId = envStore.environments.value[0].variables[0].id;
    envStore.updateVariable(env.id, varId, "enabled", false);
    expect(envStore.environments.value[0].variables[0].enabled).toBe(false);
  });

  it("persists after update", () => {
    const env = envStore.createEnvironment("Dev");
    envStore.addVariable(env.id);
    const varId = envStore.environments.value[0].variables[0].id;
    envStore.updateVariable(env.id, varId, "key", "persistedKey");
    const stored = JSON.parse(localStorage.getItem("qb:environments") ?? "[]");
    expect(stored[0].variables[0].key).toBe("persistedKey");
  });

  it("does not affect other variables", () => {
    const env = envStore.createEnvironment("Dev");
    envStore.addVariable(env.id);
    envStore.addVariable(env.id);
    const [var1, var2] = envStore.environments.value[0].variables;
    envStore.updateVariable(env.id, var1.id, "key", "changed");
    expect(envStore.environments.value[0].variables[1].id).toBe(var2.id);
    expect(envStore.environments.value[0].variables[1].key).toBe("");
  });
});

// ---------------------------------------------------------------------------
// removeVariable
// ---------------------------------------------------------------------------

describe("removeVariable", () => {
  it("removes the specified variable from the environment", () => {
    const env = envStore.createEnvironment("Dev");
    envStore.addVariable(env.id);
    const varId = envStore.environments.value[0].variables[0].id;
    envStore.removeVariable(env.id, varId);
    expect(envStore.environments.value[0].variables).toHaveLength(0);
  });

  it("persists after removal", () => {
    const env = envStore.createEnvironment("Dev");
    envStore.addVariable(env.id);
    const varId = envStore.environments.value[0].variables[0].id;
    envStore.removeVariable(env.id, varId);
    const stored = JSON.parse(localStorage.getItem("qb:environments") ?? "[]");
    expect(stored[0].variables).toHaveLength(0);
  });

  it("does not affect other variables", () => {
    const env = envStore.createEnvironment("Dev");
    envStore.addVariable(env.id);
    envStore.addVariable(env.id);
    const [var1, var2] = envStore.environments.value[0].variables;
    envStore.removeVariable(env.id, var1.id);
    expect(envStore.environments.value[0].variables).toHaveLength(1);
    expect(envStore.environments.value[0].variables[0].id).toBe(var2.id);
  });
});

// ---------------------------------------------------------------------------
// toggleVariable
// ---------------------------------------------------------------------------

describe("toggleVariable", () => {
  it("toggles enabled from true to false", () => {
    const env = envStore.createEnvironment("Dev");
    envStore.addVariable(env.id);
    const varId = envStore.environments.value[0].variables[0].id;
    // Default enabled is true
    envStore.toggleVariable(env.id, varId);
    expect(envStore.environments.value[0].variables[0].enabled).toBe(false);
  });

  it("toggles enabled from false to true", () => {
    const env = envStore.createEnvironment("Dev");
    envStore.addVariable(env.id);
    const varId = envStore.environments.value[0].variables[0].id;
    envStore.updateVariable(env.id, varId, "enabled", false);
    envStore.toggleVariable(env.id, varId);
    expect(envStore.environments.value[0].variables[0].enabled).toBe(true);
  });

  it("persists after toggle", () => {
    const env = envStore.createEnvironment("Dev");
    envStore.addVariable(env.id);
    const varId = envStore.environments.value[0].variables[0].id;
    envStore.toggleVariable(env.id, varId);
    const stored = JSON.parse(localStorage.getItem("qb:environments") ?? "[]");
    expect(stored[0].variables[0].enabled).toBe(false);
  });
});
