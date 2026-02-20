import { useEffect, useRef, useState } from "preact/hooks";
import { showSaveModal } from "../../stores/ui-store";
import { collections, createCollection, saveRequestToCollection } from "../../stores/collection-store";
import { requestState } from "../../stores/http-store";

export default function SaveToCollectionModal() {
  const isOpen = showSaveModal.value;

  // Derive a default request name from the URL path
  const currentState = requestState.value;
  const defaultName = (() => {
    try {
      const path = new URL(currentState.url).pathname;
      const segments = path.split("/").filter(Boolean);
      return segments.length > 0 ? segments[segments.length - 1] : currentState.url || "Untitled Request";
    } catch {
      return currentState.url || "Untitled Request";
    }
  })();

  const [requestName, setRequestName] = useState(defaultName);
  const [selectedCollectionId, setSelectedCollectionId] = useState<string>("__new__");
  const [newCollectionName, setNewCollectionName] = useState("");
  const [nameError, setNameError] = useState("");
  const [collectionError, setCollectionError] = useState("");

  const firstInputRef = useRef<HTMLInputElement>(null);
  const triggerButtonRef = useRef<HTMLButtonElement | null>(null);

  // Reset form state whenever the modal opens
  useEffect(() => {
    if (isOpen) {
      // Recalculate default name when modal opens
      const state = requestState.value;
      let name = "Untitled Request";
      try {
        const path = new URL(state.url).pathname;
        const segments = path.split("/").filter(Boolean);
        name = segments.length > 0 ? segments[segments.length - 1] : state.url || "Untitled Request";
      } catch {
        name = state.url || "Untitled Request";
      }
      setRequestName(name);
      setSelectedCollectionId(collections.value.length > 0 ? collections.value[0].id : "__new__");
      setNewCollectionName("");
      setNameError("");
      setCollectionError("");

      // Store the currently focused element so we can restore focus on close
      triggerButtonRef.current = document.activeElement as HTMLButtonElement | null;

      // Focus the first input on next frame
      requestAnimationFrame(() => firstInputRef.current?.focus());
    } else {
      // Restore focus to the trigger button
      triggerButtonRef.current?.focus();
    }
  }, [isOpen]);

  function close() {
    showSaveModal.value = false;
  }

  function handleOverlayKeyDown(e: KeyboardEvent) {
    if (e.key === "Escape") close();
  }

  function handleOverlayClick(e: MouseEvent) {
    if (e.target === e.currentTarget) close();
  }

  function handleSave() {
    // Validate request name
    const trimmedName = requestName.trim();
    if (!trimmedName) {
      setNameError("Request name is required.");
      firstInputRef.current?.focus();
      return;
    }
    setNameError("");

    let collectionId: string;

    if (selectedCollectionId === "__new__") {
      const trimmedColName = newCollectionName.trim();
      if (!trimmedColName) {
        setCollectionError("Collection name is required.");
        return;
      }
      setCollectionError("");
      const newCol = createCollection(trimmedColName);
      collectionId = newCol.id;
    } else {
      collectionId = selectedCollectionId;
    }

    saveRequestToCollection(collectionId, trimmedName, structuredClone(requestState.value));
    close();
  }

  function handleDialogKeyDown(e: KeyboardEvent) {
    if (e.key === "Escape") close();
  }

  if (!isOpen) return null;

  const allCollections = collections.value;

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
        aria-labelledby="save-modal-title"
        class="bg-pm-bg-secondary border border-pm-border rounded-lg shadow-xl w-full max-w-md mx-4 p-6 flex flex-col gap-4"
        onKeyDown={handleDialogKeyDown}
      >
        <h2 id="save-modal-title" class="text-base font-semibold text-pm-text-primary">
          Save Request
        </h2>

        {/* Request name */}
        <div class="flex flex-col gap-1">
          <label for="save-request-name" class="text-sm text-pm-text-secondary">
            Request name
          </label>
          <input
            ref={firstInputRef}
            id="save-request-name"
            type="text"
            value={requestName}
            placeholder="e.g. Get Users"
            class="px-3 py-2 bg-pm-bg-tertiary border border-pm-border rounded text-sm text-pm-text-primary placeholder:text-pm-text-tertiary focus:outline-none focus:border-pm-accent"
            onInput={(e) => {
              setRequestName((e.target as HTMLInputElement).value);
              setNameError("");
            }}
          />
          {nameError && (
            <span class="text-xs text-pm-status-error" role="alert">
              {nameError}
            </span>
          )}
        </div>

        {/* Collection selector */}
        <div class="flex flex-col gap-1">
          <label for="save-collection-select" class="text-sm text-pm-text-secondary">
            Collection
          </label>
          <select
            id="save-collection-select"
            value={selectedCollectionId}
            class="px-3 py-2 bg-pm-bg-tertiary border border-pm-border rounded text-sm text-pm-text-primary focus:outline-none focus:border-pm-accent"
            onChange={(e) => {
              setSelectedCollectionId((e.target as HTMLSelectElement).value);
              setCollectionError("");
            }}
          >
            {allCollections.map((col) => (
              <option key={col.id} value={col.id}>
                {col.name}
              </option>
            ))}
            <option value="__new__">+ New Collection</option>
          </select>
        </div>

        {/* New collection name input — shown when "+ New Collection" is selected */}
        {selectedCollectionId === "__new__" && (
          <div class="flex flex-col gap-1">
            <label for="save-new-collection-name" class="text-sm text-pm-text-secondary">
              New collection name
            </label>
            <input
              id="save-new-collection-name"
              type="text"
              value={newCollectionName}
              placeholder="e.g. My APIs"
              class="px-3 py-2 bg-pm-bg-tertiary border border-pm-border rounded text-sm text-pm-text-primary placeholder:text-pm-text-tertiary focus:outline-none focus:border-pm-accent"
              onInput={(e) => {
                setNewCollectionName((e.target as HTMLInputElement).value);
                setCollectionError("");
              }}
            />
            {collectionError && (
              <span class="text-xs text-pm-status-error" role="alert">
                {collectionError}
              </span>
            )}
          </div>
        )}

        {/* Actions */}
        <div class="flex justify-end gap-2 pt-2">
          <button
            type="button"
            class="px-4 py-2 text-sm text-pm-text-secondary hover:text-pm-text-primary bg-pm-bg-tertiary hover:bg-pm-bg-elevated border border-pm-border rounded transition-colors"
            onClick={close}
          >
            Cancel
          </button>
          <button
            type="button"
            class="px-4 py-2 text-sm font-semibold text-white bg-pm-accent hover:bg-pm-accent-hover rounded transition-colors"
            onClick={handleSave}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
