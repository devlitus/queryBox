import { signal } from "@preact/signals";

// Transient UI state — never persisted to localStorage

export const showSaveModal = signal<boolean>(false);
