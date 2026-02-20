import { historyEntries, clearHistory, removeHistoryEntry } from "../../stores/history-store";
import { loadRequest } from "../../stores/http-store";
import MethodBadge from "../shared/MethodBadge";
import type { HistoryEntry } from "../../types/persistence";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getRelativeTime(timestamp: number): string {
  const diffMs = Date.now() - timestamp;
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 2) return "Yesterday";
  return `${diffDays}d ago`;
}

function getDayGroup(timestamp: number): "Today" | "Yesterday" | "Older" {
  const now = new Date();
  const date = new Date(timestamp);

  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  const entryDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  if (entryDay.getTime() === today.getTime()) return "Today";
  if (entryDay.getTime() === yesterday.getTime()) return "Yesterday";
  return "Older";
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function HistoryPanel() {
  const entries = historyEntries.value;

  if (entries.length === 0) {
    return (
      <div class="py-4 px-3 text-sm text-pm-text-tertiary text-center">
        No history yet.
      </div>
    );
  }

  // Group entries by day — entries are already sorted newest first
  const groups: Array<{ label: string; entries: HistoryEntry[] }> = [];
  const groupMap = new Map<string, HistoryEntry[]>();

  for (const entry of entries) {
    const label = getDayGroup(entry.timestamp);
    if (!groupMap.has(label)) {
      groupMap.set(label, []);
      groups.push({ label, entries: groupMap.get(label)! });
    }
    groupMap.get(label)!.push(entry);
  }

  return (
    <div class="flex flex-col gap-0">
      {/* Clear history button */}
      <div class="flex justify-end px-2 py-1">
        <button
          type="button"
          class="text-xs text-pm-text-tertiary hover:text-pm-status-error transition-colors"
          onClick={clearHistory}
          aria-label="Clear all history"
        >
          Clear History
        </button>
      </div>

      {/* Grouped entries */}
      <ul role="list" class="flex flex-col gap-0">
        {groups.map(({ label, entries: groupEntries }) => (
          <li key={label} role="listitem">
            {/* Day group header */}
            <div class="px-3 py-1 text-xs font-semibold text-pm-text-tertiary uppercase tracking-wide">
              {label}
            </div>
            <ul role="list">
              {groupEntries.map((entry) => (
                <li key={entry.id} role="listitem" class="group flex items-center hover:bg-pm-bg-elevated rounded transition-colors">
                  {/* Load request button — covers the main clickable area */}
                  <button
                    type="button"
                    class="flex items-center gap-2 flex-1 min-w-0 px-3 py-1.5 text-left"
                    onClick={() => loadRequest(entry.requestSnapshot)}
                    title={entry.url}
                  >
                    <MethodBadge method={entry.method} />
                    <div class="flex-1 min-w-0">
                      <div class="text-sm text-pm-text-primary truncate">
                        {entry.url}
                      </div>
                      <div class="text-xs text-pm-text-tertiary">
                        {getRelativeTime(entry.timestamp)} &bull; {entry.status}
                      </div>
                    </div>
                  </button>
                  {/* Delete button — sibling, not nested */}
                  <button
                    type="button"
                    class="shrink-0 mr-2 text-pm-text-tertiary hover:text-pm-status-error transition-colors p-0.5 opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
                    aria-label={`Remove ${entry.method} ${entry.url} from history`}
                    onClick={() => removeHistoryEntry(entry.id)}
                  >
                    <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </div>
  );
}
