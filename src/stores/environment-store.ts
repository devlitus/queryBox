import { signal, computed } from "@preact/signals";
import { StorageService } from "../services/storage";
import type { Environment, EnvironmentVariable } from "../types/environment";

// ---------------------------------------------------------------------------
// Signals
// ---------------------------------------------------------------------------

export const environments = signal<Environment[]>(StorageService.getEnvironments());
export const activeEnvironmentId = signal<string | null>(StorageService.getActiveEnvironmentId());

// ---------------------------------------------------------------------------
// Computed signals
// ---------------------------------------------------------------------------

export const activeEnvironment = computed<Environment | null>(
  () => environments.value.find((e) => e.id === activeEnvironmentId.value) ?? null
);

/**
 * Builds a Map<key, value> from the active environment's enabled variables.
 * Returns an empty Map when no active environment is selected.
 * This is the primary data structure consumed by interpolation.
 */
export const activeVariablesMap = computed<Map<string, string>>(() => {
  const env = activeEnvironment.value;
  if (!env) return new Map();

  const map = new Map<string, string>();
  for (const variable of env.variables) {
    if (variable.enabled && variable.key !== "") {
      map.set(variable.key, variable.value);
    }
  }
  return map;
});

// ---------------------------------------------------------------------------
// Action functions — all follow explicit-persist pattern of collection-store
// ---------------------------------------------------------------------------

export function createEnvironment(name: string): Environment {
  const newEnvironment: Environment = {
    id: crypto.randomUUID(),
    name,
    variables: [],
    createdAt: Date.now(),
  };
  environments.value = [...environments.value, newEnvironment];
  StorageService.setEnvironments(environments.value);
  return newEnvironment;
}

export function deleteEnvironment(id: string): void {
  environments.value = environments.value.filter((e) => e.id !== id);
  StorageService.setEnvironments(environments.value);
  // If deleted environment was the active one, clear the active environment
  if (activeEnvironmentId.value === id) {
    activeEnvironmentId.value = null;
    StorageService.setActiveEnvironmentId(null);
  }
}

export function renameEnvironment(id: string, name: string): void {
  environments.value = environments.value.map((e) =>
    e.id === id ? { ...e, name } : e
  );
  StorageService.setEnvironments(environments.value);
}

export function duplicateEnvironment(id: string): Environment | null {
  const source = environments.value.find((e) => e.id === id);
  if (!source) return null;

  const duplicated: Environment = {
    id: crypto.randomUUID(),
    name: `${source.name} (Copy)`,
    createdAt: Date.now(),
    variables: source.variables.map((v) => ({
      ...v,
      id: crypto.randomUUID(),
    })),
  };

  environments.value = [...environments.value, duplicated];
  StorageService.setEnvironments(environments.value);
  return duplicated;
}

export function setActiveEnvironment(id: string | null): void {
  activeEnvironmentId.value = id;
  StorageService.setActiveEnvironmentId(id);
}

export function addVariable(envId: string): void {
  const newVariable: EnvironmentVariable = {
    id: crypto.randomUUID(),
    key: "",
    value: "",
    enabled: true,
  };
  environments.value = environments.value.map((e) =>
    e.id === envId
      ? { ...e, variables: [...e.variables, newVariable] }
      : e
  );
  StorageService.setEnvironments(environments.value);
}

export function updateVariable(
  envId: string,
  varId: string,
  field: keyof Omit<EnvironmentVariable, "id">,
  value: string | boolean
): void {
  environments.value = environments.value.map((e) => {
    if (e.id !== envId) return e;
    return {
      ...e,
      variables: e.variables.map((v) =>
        v.id === varId ? { ...v, [field]: value } : v
      ),
    };
  });
  StorageService.setEnvironments(environments.value);
}

export function removeVariable(envId: string, varId: string): void {
  environments.value = environments.value.map((e) => {
    if (e.id !== envId) return e;
    return {
      ...e,
      variables: e.variables.filter((v) => v.id !== varId),
    };
  });
  StorageService.setEnvironments(environments.value);
}

export function toggleVariable(envId: string, varId: string): void {
  environments.value = environments.value.map((e) => {
    if (e.id !== envId) return e;
    return {
      ...e,
      variables: e.variables.map((v) =>
        v.id === varId ? { ...v, enabled: !v.enabled } : v
      ),
    };
  });
  StorageService.setEnvironments(environments.value);
}
