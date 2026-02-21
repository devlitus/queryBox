export type AuthType = "none" | "basic" | "bearer" | "apikey";

export interface BasicAuthConfig {
  username: string;
  password: string;
}

export interface BearerTokenConfig {
  token: string;
  /** Prefix for the Authorization header. Default "Bearer". Some APIs use "Token", "Bot", etc. */
  prefix: string;
}

export interface ApiKeyConfig {
  key: string;
  value: string;
  /** Where to send the API key: as a request header or as a query param. */
  addTo: "header" | "query";
}

/**
 * Discriminated union for authentication configuration.
 * The `type` field is the discriminant — TypeScript narrows the type safely in switch statements.
 * Extensible: adding OAuth 2.0 requires only a new case (Open/Closed Principle).
 */
export type AuthConfig =
  | { type: "none" }
  | { type: "basic"; basic: BasicAuthConfig }
  | { type: "bearer"; bearer: BearerTokenConfig }
  | { type: "apikey"; apikey: ApiKeyConfig };

/** Default auth configuration: no authentication. */
export const DEFAULT_AUTH: AuthConfig = { type: "none" };
