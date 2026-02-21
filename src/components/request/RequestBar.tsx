import { useEffect, useRef } from "preact/hooks";
import MethodSelector from "./MethodSelector";
import { requestState, requestStatus } from "../../stores/http-store";
import { updateUrl } from "../../stores/http-store";
import { sendRequest, cancelRequest } from "../../services/http-client";
import { showSaveModal, shouldFocusUrl } from "../../stores/ui-store";

export default function RequestBar() {
  const status = requestStatus.value;
  const isLoading = status === "loading";
  const url = requestState.value.url;
  const urlInputRef = useRef<HTMLInputElement>(null);

  // Auto-focus the URL input when a new tab is created
  useEffect(() => {
    if (shouldFocusUrl.value) {
      urlInputRef.current?.focus();
      shouldFocusUrl.value = false;
    }
  }, [shouldFocusUrl.value]);

  return (
    <div class="p-4 flex flex-col md:flex-row md:items-center gap-2 md:gap-0">
      {/* Method selector + URL input */}
      <div class="flex items-center gap-0 flex-1">
        <MethodSelector />
        <input
          ref={urlInputRef}
          type="url"
          placeholder="Enter a URL (e.g., https://jsonplaceholder.typicode.com/todos/1)"
          value={url}
          class="flex-1 px-4 py-2 bg-pm-bg-tertiary border-y border-pm-border md:border-r-0 text-sm text-pm-text-primary placeholder:text-pm-text-tertiary focus:outline-none focus:border-pm-accent rounded-r md:rounded-r-none"
          aria-label="Request URL"
          onInput={(e) => updateUrl((e.target as HTMLInputElement).value)}
        />
      </div>

      {/* Action buttons */}
      <div class="flex gap-2">
        {/* Save to collection button */}
        <button
          type="button"
          disabled={!url}
          class={`inline-flex items-center justify-center gap-1.5 px-3 py-2 text-sm rounded transition-colors ${
            url
              ? "text-pm-text-secondary hover:text-pm-text-primary hover:bg-pm-bg-elevated"
              : "text-pm-text-tertiary cursor-not-allowed opacity-50"
          }`}
          aria-label="Save request to collection"
          title="Save to collection"
          onClick={() => { showSaveModal.value = true; }}
        >
          {/* Bookmark icon */}
          <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
          </svg>
          <span class="hidden md:inline">Save</span>
        </button>

        {isLoading && (
          <button
            type="button"
            class="w-full md:w-auto inline-flex items-center justify-center gap-2 px-4 py-2 bg-pm-bg-elevated hover:bg-pm-bg-tertiary transition-colors text-pm-text-primary font-semibold text-sm rounded md:rounded-none"
            onClick={cancelRequest}
          >
            Cancel
          </button>
        )}
        <button
          type="button"
          disabled={isLoading}
          class={`w-full md:w-auto inline-flex items-center justify-center gap-2 px-6 py-2 font-semibold text-sm rounded md:rounded-l-none md:rounded-r transition-colors ${
            isLoading
              ? "bg-pm-accent/60 text-white cursor-not-allowed"
              : "bg-pm-accent hover:bg-pm-accent-hover text-white"
          }`}
          onClick={sendRequest}
        >
          {isLoading ? (
            <>
              <span
                class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"
                aria-hidden="true"
              />
              <span>Sending...</span>
            </>
          ) : (
            <>
              <span>Send</span>
              <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
