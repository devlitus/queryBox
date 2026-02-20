import { signal } from "@preact/signals";
import { StorageService } from "../services/storage";
import type { HistoryEntry } from "../types/persistence";

const MAX_HISTORY = 50;

export const historyEntries = signal<HistoryEntry[]>(StorageService.getHistory());

export function addHistoryEntry(
  entry: Omit<HistoryEntry, "id" | "timestamp">
): void {
  const newEntry: HistoryEntry = {
    ...entry,
    id: crypto.randomUUID(),
    timestamp: Date.now(),
  };
  historyEntries.value = [newEntry, ...historyEntries.value].slice(
    0,
    MAX_HISTORY
  );
  StorageService.setHistory(historyEntries.value);
}

export function clearHistory(): void {
  historyEntries.value = [];
  StorageService.setHistory([]);
}

export function removeHistoryEntry(id: string): void {
  historyEntries.value = historyEntries.value.filter((e) => e.id !== id);
  StorageService.setHistory(historyEntries.value);
}
