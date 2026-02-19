import Dropdown from "../shared/Dropdown";
import { requestState } from "../../stores/http-store";
import { updateBodyMode, updateBodyContentType, updateBodyRaw } from "../../stores/http-store";
import type { BodyMode, ContentType } from "../../types/http";

const BODY_MODES: Array<{ label: string; value: BodyMode }> = [
  { label: "none", value: "none" },
  { label: "raw",  value: "raw" },
];

const CONTENT_TYPE_ITEMS = [
  { label: "JSON", value: "json" },
  { label: "Text", value: "text" },
  { label: "XML",  value: "xml" },
  { label: "HTML", value: "html" },
];

export default function BodyEditor() {
  const { mode, contentType, raw } = requestState.value.body;

  return (
    <div>
      {/* Body mode selector */}
      <div class="flex items-center gap-4 mb-4">
        {BODY_MODES.map((m) => (
          <label key={m.value} class="inline-flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="body-mode"
              value={m.value}
              checked={mode === m.value}
              class="accent-pm-accent"
              onChange={() => updateBodyMode(m.value)}
            />
            <span class="text-sm text-pm-text-primary">{m.label}</span>
          </label>
        ))}

        {/* Content type dropdown (only visible for raw mode) */}
        {mode === "raw" && (
          <div class="ml-auto">
            <Dropdown
              items={CONTENT_TYPE_ITEMS}
              selected={contentType}
              onSelect={(value) => updateBodyContentType(value as ContentType)}
              buttonClass="inline-flex items-center gap-2 px-3 py-1.5 bg-pm-bg-tertiary hover:bg-pm-bg-elevated transition-colors text-sm text-pm-text-primary rounded"
              panelClass="right-0 left-auto min-w-[100px]"
              label="Content Type"
            />
          </div>
        )}
      </div>

      {/* Body content */}
      {mode === "none" ? (
        <p class="text-sm text-pm-text-tertiary text-center py-8">
          This request does not have a body.
        </p>
      ) : (
        <div>
          <textarea
            class="w-full min-h-[200px] bg-pm-bg-tertiary rounded p-4 font-pm-mono text-sm text-pm-text-primary focus:outline-none focus:ring-1 focus:ring-pm-accent resize-y"
            value={raw}
            aria-label="Request body"
            placeholder={contentType === "json" ? '{\n  "key": "value"\n}' : "Enter request body"}
            onInput={(e) => updateBodyRaw((e.target as HTMLTextAreaElement).value)}
          />
        </div>
      )}
    </div>
  );
}
