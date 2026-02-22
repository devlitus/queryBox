import { signal } from "@preact/signals";

// Transient UI state — never persisted to localStorage

export const showSaveModal = signal<boolean>(false);

/** Controls visibility of the Code Snippet Generator modal. */
export const showCodeSnippetModal = signal<boolean>(false);

/**
 * When set to true, RequestBar will focus the URL input.
 * Reset to false immediately after focusing to allow repeated triggers.
 * Set by tab-store when a new tab is created.
 */
export const shouldFocusUrl = signal<boolean>(false);

// ---------------------------------------------------------------------------
// Import modal state
// ---------------------------------------------------------------------------

export type ImportModalState = {
  target: "collections" | "environments";
};

/**
 * Controls visibility of the Import modal.
 * When null, the modal is closed.
 * When set, indicates which type of data is being imported.
 */
export const showImportModal = signal<ImportModalState | null>(null);
