import { useState, useEffect, useRef } from "preact/hooks";
import { showImportModal } from "../../stores/ui-store";
import { importCollections } from "../../stores/collection-store";
import { importEnvironments } from "../../stores/environment-store";
import { parseImportFile, readFileAsText } from "../../utils/export-import";
import type { ExportFile, ImportStrategy } from "../../types/export";
import type { Collection } from "../../types/persistence";
import type { Environment } from "../../types/environment";

// ---------------------------------------------------------------------------
// Summary helpers
// ---------------------------------------------------------------------------

function getCollectionsSummary(data: Collection[]): string {
  const totalRequests = data.reduce((sum, c) => sum + c.requests.length, 0);
  return `Found ${data.length} collection${data.length !== 1 ? "s" : ""} with ${totalRequests} total request${totalRequests !== 1 ? "s" : ""}.`;
}

function getEnvironmentsSummary(data: Environment[]): string {
  return `Found ${data.length} environment${data.length !== 1 ? "s" : ""}.`;
}

// ---------------------------------------------------------------------------
// ImportModal component
// ---------------------------------------------------------------------------

export default function ImportModal() {
  const modalState = showImportModal.value;
  const isOpen = modalState !== null;

  // Local state — reset on each open
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [parseResult, setParseResult] = useState<ExportFile | null>(null);
  const [parseError, setParseError] = useState<string>("");
  const [strategy, setStrategy] = useState<ImportStrategy>("merge");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const selectFileButtonRef = useRef<HTMLButtonElement>(null);
  const triggerButtonRef = useRef<HTMLButtonElement | null>(null);

  // Focus management — save trigger, auto-focus select-file button on open
  useEffect(() => {
    if (isOpen) {
      triggerButtonRef.current = document.activeElement as HTMLButtonElement | null;
      // Reset all state when modal opens
      setSelectedFile(null);
      setParseResult(null);
      setParseError("");
      setStrategy("merge");
      requestAnimationFrame(() => selectFileButtonRef.current?.focus());
    } else {
      triggerButtonRef.current?.focus();
    }
  }, [isOpen]);

  function close() {
    showImportModal.value = null;
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

  function handleSelectFileClick() {
    fileInputRef.current?.click();
  }

  async function handleFileChange(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    if (!file) return;

    setSelectedFile(file);
    setParseResult(null);
    setParseError("");

    try {
      const text = await readFileAsText(file);
      const result = parseImportFile(text);

      // Cross-type validation: ensure the file type matches the intended target
      if (result.type !== modalState?.target) {
        setParseError(
          `This file contains ${result.type}, but you are importing ${modalState?.target}.`
        );
        setParseResult(null);
        return;
      }

      setParseResult(result);
    } catch (err) {
      setParseError(
        err instanceof Error ? err.message : "An unknown error occurred while reading the file."
      );
    }
  }

  function handleImport() {
    if (!parseResult || !modalState) return;

    if (parseResult.type === "collections") {
      importCollections(parseResult.data, strategy);
    } else {
      importEnvironments(parseResult.data, strategy);
    }

    close();
  }

  if (!isOpen || !modalState) return null;

  const { target } = modalState;
  const title = target === "collections" ? "Import Collections" : "Import Environments";
  const canImport = parseResult !== null && parseError === "";

  // Build summary string when we have a valid parse result
  let summary: string | null = null;
  if (parseResult) {
    if (parseResult.type === "collections") {
      summary = getCollectionsSummary(parseResult.data as Collection[]);
    } else {
      summary = getEnvironmentsSummary(parseResult.data as Environment[]);
    }
  }

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
        aria-labelledby="import-modal-title"
        class="bg-pm-bg-secondary border border-pm-border rounded-lg shadow-xl w-full max-w-md mx-4 flex flex-col"
        onKeyDown={handleDialogKeyDown}
      >
        {/* Header */}
        <div class="flex items-center justify-between px-6 py-4 border-b border-pm-border">
          <h2
            id="import-modal-title"
            class="text-base font-semibold text-pm-text-primary"
          >
            {title}
          </h2>
          <button
            type="button"
            class="text-pm-text-secondary hover:text-pm-text-primary transition-colors p-1 rounded hover:bg-pm-bg-elevated"
            aria-label="Close import modal"
            onClick={close}
          >
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div class="px-6 py-4 flex flex-col gap-4">
          {/* File selection */}
          <div class="flex flex-col gap-2">
            <label class="text-sm font-medium text-pm-text-secondary">
              JSON file
            </label>
            <div class="flex items-center gap-3">
              {/* Hidden file input */}
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                class="hidden"
                onChange={handleFileChange}
              />
              {/* Styled trigger button */}
              <button
                ref={selectFileButtonRef}
                type="button"
                class="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-semibold text-pm-text-primary bg-pm-bg-tertiary border border-pm-border rounded hover:bg-pm-bg-elevated transition-colors"
                onClick={handleSelectFileClick}
              >
                <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
                Select File
              </button>
              {/* Selected file name */}
              {selectedFile ? (
                <span class="text-sm text-pm-text-primary truncate max-w-[180px]" title={selectedFile.name}>
                  {selectedFile.name}
                </span>
              ) : (
                <span class="text-sm text-pm-text-tertiary">
                  No file selected
                </span>
              )}
            </div>
          </div>

          {/* Parse error */}
          {parseError && (
            <p
              class="text-sm text-pm-status-error bg-pm-bg-tertiary border border-pm-border rounded px-3 py-2"
              role="alert"
            >
              {parseError}
            </p>
          )}

          {/* File summary */}
          {summary && (
            <p class="text-sm text-pm-text-secondary bg-pm-bg-tertiary rounded px-3 py-2">
              {summary}
            </p>
          )}

          {/* Strategy selector */}
          <div class="flex flex-col gap-2">
            <span class="text-sm font-medium text-pm-text-secondary">
              Import strategy
            </span>
            <div class="flex flex-col gap-2">
              {/* Merge option */}
              <label class="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="radio"
                  name="import-strategy"
                  value="merge"
                  checked={strategy === "merge"}
                  onChange={() => setStrategy("merge")}
                  class="mt-0.5 w-4 h-4 accent-pm-accent cursor-pointer"
                />
                <div class="flex flex-col">
                  <span class="text-sm font-medium text-pm-text-primary">Merge</span>
                  <span class="text-xs text-pm-text-tertiary">
                    Add new items, keep existing ones
                  </span>
                </div>
              </label>

              {/* Replace option */}
              <label class="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="radio"
                  name="import-strategy"
                  value="replace"
                  checked={strategy === "replace"}
                  onChange={() => setStrategy("replace")}
                  class="mt-0.5 w-4 h-4 accent-pm-accent cursor-pointer"
                />
                <div class="flex flex-col">
                  <span class="text-sm font-medium text-pm-text-primary">Replace</span>
                  <span class="text-xs text-pm-text-tertiary">
                    Remove all existing items and import these
                  </span>
                </div>
              </label>

              {/* Replace warning */}
              {strategy === "replace" && (
                <p class="text-xs text-pm-status-error ml-6" role="alert">
                  This will permanently delete all existing {target}.
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div class="flex items-center justify-end gap-2 px-6 py-4 border-t border-pm-border">
          <button
            type="button"
            class="px-4 py-2 text-sm font-semibold text-pm-text-secondary hover:text-pm-text-primary bg-pm-bg-elevated hover:bg-pm-bg-tertiary rounded transition-colors"
            onClick={close}
          >
            Cancel
          </button>
          <button
            type="button"
            class="px-4 py-2 text-sm font-semibold text-white bg-pm-accent hover:bg-pm-accent-hover rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={!canImport}
            onClick={handleImport}
          >
            Import
          </button>
        </div>
      </div>
    </div>
  );
}
