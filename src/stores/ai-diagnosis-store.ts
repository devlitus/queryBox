import { signal, computed } from "@preact/signals";
import type {
  TabDiagnosisState,
  DiagnosisStatus,
  DiagnosisResult,
  DiagnosisError,
  DiagnosisContext,
  RateLimitInfo,
} from "../types/ai";
import { activeTabId } from "./tab-store";
import { requestState, responseState, requestError } from "./http-store";
import { sanitizeRequestContext } from "../services/ai-sanitizer";
import { requestDiagnosis } from "../services/ai-client";

// ---------------------------------------------------------------------------
// State: per-tab diagnosis state
// ---------------------------------------------------------------------------

const diagnosisMap = signal<Map<string, TabDiagnosisState>>(new Map());

/** Active AbortController for the in-flight diagnosis request. */
let activeAbortController: AbortController | null = null;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getDefaultState(): TabDiagnosisState {
  return {
    status: "idle",
    result: null,
    error: null,
    context: null,
    rateLimitInfo: null,
  };
}

function getTabState(tabId: string): TabDiagnosisState {
  return diagnosisMap.value.get(tabId) ?? getDefaultState();
}

function setTabState(tabId: string, state: TabDiagnosisState): void {
  const next = new Map(diagnosisMap.value);
  next.set(tabId, state);
  diagnosisMap.value = next;
}

function updateTabState(
  tabId: string,
  patch: Partial<TabDiagnosisState>
): void {
  const current = getTabState(tabId);
  setTabState(tabId, { ...current, ...patch });
}

// ---------------------------------------------------------------------------
// Computed signals — proxies to the active tab (same pattern as http-store)
// ---------------------------------------------------------------------------

export const diagnosisState = computed<TabDiagnosisState>(
  () => getTabState(activeTabId.value)
);

export const diagnosisStatus = computed<DiagnosisStatus>(
  () => diagnosisState.value.status
);

export const diagnosisResult = computed<DiagnosisResult | null>(
  () => diagnosisState.value.result
);

export const diagnosisError = computed<DiagnosisError | null>(
  () => diagnosisState.value.error
);

export const diagnosisContext = computed<DiagnosisContext | null>(
  () => diagnosisState.value.context
);

export const rateLimitInfo = computed<RateLimitInfo | null>(
  () => diagnosisState.value.rateLimitInfo
);

/** True when there's an error HTTP or a response with status ≥ 400 */
export const canDiagnose = computed<boolean>(() => {
  const error = requestError.value;
  if (error && error.type !== "abort") return true;

  const response = responseState.value;
  if (response && response.status >= 400) return true;

  return false;
});

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

/**
 * Generates the sanitized DiagnosisContext and sets status to "previewing"
 * so the user can review what will be sent before confirming.
 */
export function previewDiagnosis(): void {
  const tabId = activeTabId.value;
  const request = requestState.value;
  const response = responseState.value;
  const error = requestError.value;

  const context = sanitizeRequestContext(request, response, error);

  updateTabState(tabId, {
    status: "previewing",
    context,
    result: null,
    error: null,
    rateLimitInfo: null,
  });
}

/**
 * Sends the diagnosis context to the server API route and streams the result.
 * Manages status transitions: loading → streaming → done | error.
 */
export async function startDiagnosis(): Promise<void> {
  const tabId = activeTabId.value;
  const state = getTabState(tabId);
  const context = state.context;

  if (!context) return;

  // Cancel any previous in-flight diagnosis
  activeAbortController?.abort();
  activeAbortController = new AbortController();
  const { signal } = activeAbortController;

  updateTabState(tabId, {
    status: "loading",
    result: null,
    error: null,
  });

  let accumulatedContent = "";

  try {
    await requestDiagnosis(
      context,
      (chunk: string) => {
        accumulatedContent += chunk;

        // Update the result progressively (streaming)
        updateTabState(tabId, {
          status: "streaming",
          result: {
            content: accumulatedContent,
            timestamp: Date.now(),
            model: "llama-3.3-70b-versatile",
          },
        });
      },
      signal
    );

    // If aborted, don't update to "done"
    if (signal.aborted) return;

    updateTabState(tabId, {
      status: "done",
      result: {
        content: accumulatedContent,
        timestamp: Date.now(),
        model: "llama-3.3-70b-versatile",
      },
    });
  } catch (err: unknown) {
    // If aborted, don't set error
    if (signal.aborted) return;

    const diagError = err as DiagnosisError;

    updateTabState(tabId, {
      status: "error",
      error: {
        message: diagError.message ?? "Unknown error",
        type: diagError.type ?? "unknown",
        retryAfter: diagError.retryAfter,
      },
      rateLimitInfo:
        diagError.type === "rate-limit" && diagError.retryAfter
          ? { remaining: 0, resetIn: diagError.retryAfter * 1000 }
          : null,
    });
  }
}

/**
 * Cancels the in-flight diagnosis request.
 */
export function cancelDiagnosis(): void {
  activeAbortController?.abort();
  activeAbortController = null;

  const tabId = activeTabId.value;
  updateTabState(tabId, {
    status: "idle",
    result: null,
    error: null,
    context: null,
  });
}

/**
 * Resets the diagnosis state for the active tab.
 */
export function clearDiagnosis(): void {
  const tabId = activeTabId.value;
  const next = new Map(diagnosisMap.value);
  next.delete(tabId);
  diagnosisMap.value = next;
}
