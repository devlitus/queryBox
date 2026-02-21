import { useSignal } from "@preact/signals";
import Dropdown from "../shared/Dropdown";
import VariableIndicator from "../shared/VariableIndicator";
import {
  requestState,
  updateAuthType,
  updateBasicAuth,
  updateBearerToken,
  updateApiKey,
} from "../../stores/http-store";
import { activeVariablesMap, activeEnvironmentId } from "../../stores/environment-store";
import type { AuthType } from "../../types/auth";

const AUTH_TYPE_ITEMS: Array<{ label: string; value: AuthType }> = [
  { label: "No Auth",      value: "none" },
  { label: "Basic Auth",   value: "basic" },
  { label: "Bearer Token", value: "bearer" },
  { label: "API Key",      value: "apikey" },
];

/** Shared input class — mirrors KeyValueTable input styling. */
const INPUT_CLASS =
  "w-full bg-transparent border-b border-pm-border-subtle focus:border-pm-accent focus:outline-none text-sm text-pm-text-primary placeholder:text-pm-text-tertiary px-1 py-1";

/** Shared label class for field labels. */
const LABEL_CLASS = "block text-xs font-semibold text-pm-text-secondary uppercase mb-1";

// ---------------------------------------------------------------------------
// Sub-panels
// ---------------------------------------------------------------------------

function NoAuthPanel() {
  return (
    <p class="text-sm text-pm-text-tertiary text-center py-8">
      This request does not use any authentication.
    </p>
  );
}

function BasicAuthPanel() {
  // Local signal for password visibility toggle
  const showPassword = useSignal(false);
  const { basic } = requestState.value.auth.type === "basic"
    ? requestState.value.auth
    : { basic: { username: "", password: "" } };

  const variables = activeVariablesMap.value;
  const envActive = activeEnvironmentId.value !== null;

  return (
    <div class="flex flex-col gap-4">
      {/* Username */}
      <div>
        <label class={LABEL_CLASS} for="auth-basic-username">Username</label>
        <div class="flex items-center gap-2">
          <input
            id="auth-basic-username"
            type="text"
            class={INPUT_CLASS}
            value={basic.username}
            placeholder="Username"
            aria-label="Basic Auth username"
            onInput={(e) => updateBasicAuth("username", (e.target as HTMLInputElement).value)}
          />
          {envActive && <VariableIndicator text={basic.username} variables={variables} />}
        </div>
      </div>

      {/* Password */}
      <div>
        <label class={LABEL_CLASS} for="auth-basic-password">Password</label>
        <div class="flex items-center gap-2">
          <input
            id="auth-basic-password"
            type={showPassword.value ? "text" : "password"}
            class={INPUT_CLASS}
            value={basic.password}
            placeholder="Password"
            aria-label="Basic Auth password"
            onInput={(e) => updateBasicAuth("password", (e.target as HTMLInputElement).value)}
          />
          {envActive && <VariableIndicator text={basic.password} variables={variables} />}
          <button
            type="button"
            class="shrink-0 text-pm-text-tertiary hover:text-pm-text-primary transition-colors"
            aria-label="Toggle password visibility"
            onClick={() => { showPassword.value = !showPassword.value; }}
          >
            {showPassword.value ? (
              /* Eye-off icon */
              <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                <line x1="1" y1="1" x2="23" y2="23" />
              </svg>
            ) : (
              /* Eye icon */
              <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function BearerTokenPanel() {
  const { bearer } = requestState.value.auth.type === "bearer"
    ? requestState.value.auth
    : { bearer: { token: "", prefix: "Bearer" } };

  const variables = activeVariablesMap.value;
  const envActive = activeEnvironmentId.value !== null;

  return (
    <div class="flex flex-col gap-4">
      {/* Prefix */}
      <div>
        <label class={LABEL_CLASS} for="auth-bearer-prefix">Prefix</label>
        <input
          id="auth-bearer-prefix"
          type="text"
          class={INPUT_CLASS}
          value={bearer.prefix}
          placeholder="Bearer"
          aria-label="Bearer token prefix"
          onInput={(e) => updateBearerToken("prefix", (e.target as HTMLInputElement).value)}
        />
      </div>

      {/* Token */}
      <div>
        <label class={LABEL_CLASS} for="auth-bearer-token">Token</label>
        <div class="flex items-start gap-2">
          <textarea
            id="auth-bearer-token"
            class="w-full bg-pm-bg-tertiary rounded p-2 font-pm-mono text-sm text-pm-text-primary focus:outline-none focus:ring-1 focus:ring-pm-accent resize-y min-h-[80px]"
            value={bearer.token}
            placeholder="Enter token"
            aria-label="Bearer token value"
            onInput={(e) => updateBearerToken("token", (e.target as HTMLTextAreaElement).value)}
          />
          {envActive && <VariableIndicator text={bearer.token} variables={variables} />}
        </div>
      </div>
    </div>
  );
}

function ApiKeyPanel() {
  const { apikey } = requestState.value.auth.type === "apikey"
    ? requestState.value.auth
    : { apikey: { key: "", value: "", addTo: "header" as const } };

  const variables = activeVariablesMap.value;
  const envActive = activeEnvironmentId.value !== null;

  return (
    <div class="flex flex-col gap-4">
      {/* Key */}
      <div>
        <label class={LABEL_CLASS} for="auth-apikey-key">Key</label>
        <div class="flex items-center gap-2">
          <input
            id="auth-apikey-key"
            type="text"
            class={INPUT_CLASS}
            value={apikey.key}
            placeholder="Header or param name"
            aria-label="API Key name"
            onInput={(e) => updateApiKey("key", (e.target as HTMLInputElement).value)}
          />
          {envActive && <VariableIndicator text={apikey.key} variables={variables} />}
        </div>
      </div>

      {/* Value */}
      <div>
        <label class={LABEL_CLASS} for="auth-apikey-value">Value</label>
        <div class="flex items-center gap-2">
          <input
            id="auth-apikey-value"
            type="text"
            class={INPUT_CLASS}
            value={apikey.value}
            placeholder="API key value"
            aria-label="API Key value"
            onInput={(e) => updateApiKey("value", (e.target as HTMLInputElement).value)}
          />
          {envActive && <VariableIndicator text={apikey.value} variables={variables} />}
        </div>
      </div>

      {/* Add to: header or query param */}
      <fieldset>
        <legend class={LABEL_CLASS}>Add to</legend>
        <div class="flex items-center gap-6">
          <label class="inline-flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="apikey-addto"
              value="header"
              checked={apikey.addTo === "header"}
              class="accent-pm-accent"
              onChange={() => updateApiKey("addTo", "header")}
            />
            <span class="text-sm text-pm-text-primary">Header</span>
          </label>
          <label class="inline-flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="apikey-addto"
              value="query"
              checked={apikey.addTo === "query"}
              class="accent-pm-accent"
              onChange={() => updateApiKey("addTo", "query")}
            />
            <span class="text-sm text-pm-text-primary">Query Params</span>
          </label>
        </div>
      </fieldset>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main AuthEditor component
// ---------------------------------------------------------------------------

export default function AuthEditor() {
  const auth = requestState.value.auth;

  return (
    <div class="flex flex-col gap-4">
      {/* Auth type selector */}
      <div class="flex items-center gap-3">
        <span class={LABEL_CLASS} style="margin-bottom: 0">Type</span>
        <Dropdown
          items={AUTH_TYPE_ITEMS}
          selected={auth.type}
          onSelect={(value) => updateAuthType(value as AuthType)}
          buttonClass="inline-flex items-center gap-2 px-3 py-1.5 bg-pm-bg-tertiary hover:bg-pm-bg-elevated transition-colors text-sm text-pm-text-primary rounded"
          panelClass="left-0 min-w-[140px]"
          label="Authentication type"
        />
      </div>

      {/* Dynamic panel based on selected type */}
      {auth.type === "none"    && <NoAuthPanel />}
      {auth.type === "basic"   && <BasicAuthPanel />}
      {auth.type === "bearer"  && <BearerTokenPanel />}
      {auth.type === "apikey"  && <ApiKeyPanel />}
    </div>
  );
}
