import type { RequestState } from "../types/http";
import type { AuthConfig } from "../types/auth";

/** Regex to match {{variableName}} placeholders. Captures the name inside the braces. */
const VARIABLE_REGEX = /\{\{([^}]+)\}\}/g;

/**
 * Replaces all `{{variableName}}` occurrences with their values from the map.
 * - Trims whitespace inside braces: `{{ baseUrl }}` matches key `baseUrl`.
 * - If a variable is not found in the map, leaves the placeholder unchanged.
 * - Returns the original string unchanged if no placeholders are found (fast path).
 */
export function interpolateVariables(
  template: string,
  variables: Map<string, string>
): string {
  if (!template.includes("{{")) return template;

  return template.replace(VARIABLE_REGEX, (match, name: string) => {
    const trimmedName = name.trim();
    return variables.has(trimmedName) ? (variables.get(trimmedName) as string) : match;
  });
}

/**
 * Extracts all unique variable names from a template string.
 * Returns a deduplicated array of trimmed variable names.
 * Returns an empty array if no variables found.
 */
export function extractVariableNames(template: string): string[] {
  if (!template.includes("{{")) return [];

  const seen = new Set<string>();
  const regex = /\{\{([^}]+)\}\}/g;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(template)) !== null) {
    const trimmed = match[1].trim();
    if (trimmed.length > 0) {
      seen.add(trimmed);
    }
  }

  return Array.from(seen);
}

/**
 * Returns true if the text contains any `{{...}}` pattern.
 * Used for quick detection in UI components (variable indicator).
 */
export function hasVariables(text: string): boolean {
  return text.includes("{{") && /\{\{[^}]+\}\}/.test(text);
}

/**
 * Deep-clones the request, then interpolates all variable placeholders in:
 * - url
 * - each header key and value
 * - each param key and value
 * - body.raw
 * Returns the interpolated clone (original is never mutated).
 */
export function interpolateRequest(
  request: RequestState,
  variables: Map<string, string>
): RequestState {
  const clone = structuredClone(request);

  clone.url = interpolateVariables(clone.url, variables);

  clone.headers = clone.headers.map((h) => ({
    ...h,
    key: interpolateVariables(h.key, variables),
    value: interpolateVariables(h.value, variables),
  }));

  clone.params = clone.params.map((p) => ({
    ...p,
    key: interpolateVariables(p.key, variables),
    value: interpolateVariables(p.value, variables),
  }));

  clone.body = {
    ...clone.body,
    raw: interpolateVariables(clone.body.raw, variables),
  };

  clone.auth = interpolateAuth(clone.auth, variables);

  return clone;
}

/**
 * Interpolates environment variables in auth config fields.
 * - basic:  username and password are interpolated.
 * - bearer: token is interpolated; prefix is NOT (it's a fixed protocol keyword like "Bearer").
 * - apikey: key and value are interpolated.
 * - none:   returned unchanged.
 */
function interpolateAuth(auth: AuthConfig, variables: Map<string, string>): AuthConfig {
  switch (auth.type) {
    case "none":
      return auth;
    case "basic":
      return {
        ...auth,
        basic: {
          username: interpolateVariables(auth.basic.username, variables),
          password: interpolateVariables(auth.basic.password, variables),
        },
      };
    case "bearer":
      return {
        ...auth,
        bearer: {
          ...auth.bearer,
          token: interpolateVariables(auth.bearer.token, variables),
        },
      };
    case "apikey":
      return {
        ...auth,
        apikey: {
          ...auth.apikey,
          key: interpolateVariables(auth.apikey.key, variables),
          value: interpolateVariables(auth.apikey.value, variables),
        },
      };
  }
}
