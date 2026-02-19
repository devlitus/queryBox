import { useMemo } from "preact/hooks";
import { useSignal } from "@preact/signals";
import CodeViewer from "../shared/CodeViewer";
import { responseState } from "../../stores/http-store";

/** Threshold above which we skip JSON pretty-printing (100 KB) */
const PRETTY_PRINT_LIMIT = 100 * 1024;

type ViewMode = "pretty" | "raw";

export default function ResponseBody() {
  const response = responseState.value;
  const viewMode = useSignal<ViewMode>("pretty");

  const isJson = useMemo(() => {
    if (!response) return false;
    const ct = response.contentType.toLowerCase();
    return ct.includes("json");
  }, [response?.contentType]);

  const prettyBody = useMemo(() => {
    if (!response) return "";
    if (!isJson) return response.body;
    if (response.body.length > PRETTY_PRINT_LIMIT) return response.body;

    try {
      return JSON.stringify(JSON.parse(response.body), null, 2);
    } catch {
      return response.body;
    }
  }, [response?.body, isJson]);

  const displayBody = viewMode.value === "pretty" ? prettyBody : (response?.body ?? "");
  const language = isJson && viewMode.value === "pretty" ? "json" : "text";

  async function copyBody() {
    if (!response) return;
    try {
      await navigator.clipboard.writeText(response.body);
    } catch {
      // Clipboard API unavailable — silently fail for MVP
    }
  }

  if (!response) return null;

  return (
    <div>
      {/* View mode controls */}
      <div class="flex items-center justify-between mb-4">
        <div class="flex items-center gap-3">
          <label class="inline-flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="view-mode"
              value="pretty"
              checked={viewMode.value === "pretty"}
              class="accent-pm-accent"
              onChange={() => { viewMode.value = "pretty"; }}
            />
            <span class="text-sm text-pm-text-primary">Pretty</span>
          </label>
          <label class="inline-flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="view-mode"
              value="raw"
              checked={viewMode.value === "raw"}
              class="accent-pm-accent"
              onChange={() => { viewMode.value = "raw"; }}
            />
            <span class="text-sm text-pm-text-primary">Raw</span>
          </label>
        </div>

        <button
          type="button"
          class="px-3 py-1.5 text-xs bg-pm-bg-tertiary hover:bg-pm-bg-elevated transition-colors text-pm-text-primary rounded"
          onClick={copyBody}
        >
          Copy
        </button>
      </div>

      {/* Response body viewer */}
      <CodeViewer code={displayBody} language={language} />
    </div>
  );
}
