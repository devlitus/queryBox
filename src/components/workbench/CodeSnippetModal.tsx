import { useEffect, useRef } from "preact/hooks";
import { useSignal } from "@preact/signals";
import { showCodeSnippetModal } from "../../stores/ui-store";
import { requestState } from "../../stores/http-store";
import { activeEnvironmentId, activeVariablesMap } from "../../stores/environment-store";
import { interpolateRequest } from "../../utils/interpolation";
import { generateSnippet } from "../../utils/snippet-generators";
import { SNIPPET_OPTIONS } from "../../types/snippet";
import type { SnippetLanguage } from "../../types/snippet";
import Dropdown from "../shared/Dropdown";
import type { DropdownItem } from "../shared/Dropdown";

// Build the dropdown items array from SNIPPET_OPTIONS once (stable reference)
const LANGUAGE_ITEMS: DropdownItem[] = SNIPPET_OPTIONS.map((opt) => ({
  label: opt.label,
  value: opt.id,
}));

export default function CodeSnippetModal() {
  const isOpen = showCodeSnippetModal.value;

  const selectedLanguage = useSignal<SnippetLanguage>("curl");
  const interpolateVars = useSignal<boolean>(true);
  const copied = useSignal<boolean>(false);

  const firstFocusRef = useRef<HTMLDivElement>(null);
  const triggerButtonRef = useRef<HTMLButtonElement | null>(null);

  // Track timeoutId for cleanup
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Focus management — mirrors SaveToCollectionModal pattern
  useEffect(() => {
    if (isOpen) {
      triggerButtonRef.current = document.activeElement as HTMLButtonElement | null;
      requestAnimationFrame(() => firstFocusRef.current?.focus());
    } else {
      triggerButtonRef.current?.focus();
      // Reset state on close
      copied.value = false;
    }
  }, [isOpen]);

  // Cleanup copy timeout on unmount
  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current !== null) {
        clearTimeout(copyTimeoutRef.current);
      }
    };
  }, []);

  function close() {
    showCodeSnippetModal.value = false;
  }

  function handleOverlayClick(e: MouseEvent) {
    if (e.target === e.currentTarget) close();
  }

  function handleOverlayKeyDown(e: KeyboardEvent) {
    if (e.key === "Escape") close();
  }

  function handleDialogKeyDown(e: KeyboardEvent) {
    if (e.key === "Escape") close();
  }

  // Compute the processed request (interpolated or raw)
  const hasActiveEnv = activeEnvironmentId.value !== null;
  const currentRequest = requestState.value;
  const processedRequest =
    hasActiveEnv && interpolateVars.value
      ? interpolateRequest(currentRequest, activeVariablesMap.value)
      : currentRequest;

  // Generate the snippet — cost is negligible; declared before handleCopy to avoid TDZ reference
  const snippet = generateSnippet(selectedLanguage.value, processedRequest);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(snippet);
      copied.value = true;
      if (copyTimeoutRef.current !== null) {
        clearTimeout(copyTimeoutRef.current);
      }
      copyTimeoutRef.current = setTimeout(() => {
        copied.value = false;
        copyTimeoutRef.current = null;
      }, 2000);
    } catch {
      // Fallback: select text in the pre element for manual copying
      const pre = document.getElementById("snippet-preview");
      if (pre) {
        const selection = window.getSelection();
        const range = document.createRange();
        range.selectNodeContents(pre);
        selection?.removeAllRanges();
        selection?.addRange(range);
      }
    }
  }

  if (!isOpen) return null;

  return (
    // Overlay
    <div
      class="fixed inset-0 z-60 flex items-center justify-center bg-black/50"
      role="presentation"
      onClick={handleOverlayClick}
      onKeyDown={handleOverlayKeyDown}
    >
      {/* Dialog card */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="code-snippet-modal-title"
        class="bg-pm-bg-secondary border border-pm-border rounded-lg shadow-xl w-full max-w-2xl mx-4 flex flex-col max-h-[80vh]"
        onKeyDown={handleDialogKeyDown}
      >
        {/* Header */}
        <div class="flex items-center justify-between px-6 py-4 border-b border-pm-border flex-shrink-0">
          <h2
            id="code-snippet-modal-title"
            class="text-base font-semibold text-pm-text-primary"
          >
            Code Snippet
          </h2>
          <button
            type="button"
            class="text-pm-text-secondary hover:text-pm-text-primary transition-colors p-1 rounded hover:bg-pm-bg-elevated"
            aria-label="Close code snippet modal"
            onClick={close}
          >
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Controls bar */}
        <div
          class="flex items-center gap-3 px-6 py-3 border-b border-pm-border flex-shrink-0 flex-wrap"
          ref={firstFocusRef}
          tabIndex={-1}
        >
          {/* Language selector */}
          <Dropdown
            items={LANGUAGE_ITEMS}
            selected={selectedLanguage.value}
            onSelect={(value) => { selectedLanguage.value = value as SnippetLanguage; }}
            buttonClass="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-semibold text-pm-text-primary bg-pm-bg-tertiary border border-pm-border rounded hover:bg-pm-bg-elevated transition-colors"
            panelClass="min-w-[200px]"
            label="Select language"
          />

          {/* Toggle "Resolve variables" — only shown when an environment is active */}
          {hasActiveEnv && (
            <label class="inline-flex items-center gap-2 text-sm text-pm-text-secondary cursor-pointer select-none">
              <input
                type="checkbox"
                class="w-4 h-4 accent-pm-accent cursor-pointer"
                checked={interpolateVars.value}
                onChange={(e) => { interpolateVars.value = (e.target as HTMLInputElement).checked; }}
              />
              Resolve variables
            </label>
          )}

          {/* Spacer */}
          <div class="flex-1" />

          {/* Copy button */}
          <button
            type="button"
            class="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold rounded transition-colors bg-pm-accent hover:bg-pm-accent-hover text-white"
            onClick={handleCopy}
          >
            {copied.value ? (
              <>
                {/* Checkmark icon */}
                <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                Copied!
              </>
            ) : (
              <>
                {/* Clipboard icon */}
                <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </svg>
                Copy
              </>
            )}
          </button>
        </div>

        {/* Snippet preview */}
        <div class="overflow-y-auto flex-1">
          <div class="bg-pm-bg-tertiary overflow-x-auto font-pm-mono text-sm">
            <pre id="snippet-preview" class="p-6 text-pm-text-primary whitespace-pre"><code>{snippet}</code></pre>
          </div>
        </div>
      </div>
    </div>
  );
}
