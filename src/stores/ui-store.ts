import { signal } from "@preact/signals";

// Transient UI state — never persisted to localStorage

export const showSaveModal = signal<boolean>(false);

/**
 * When set to true, RequestBar will focus the URL input.
 * Reset to false immediately after focusing to allow repeated triggers.
 * Set by tab-store when a new tab is created.
 */
export const shouldFocusUrl = signal<boolean>(false);
