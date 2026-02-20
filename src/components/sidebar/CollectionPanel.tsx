import { useState } from "preact/hooks";
import {
  collections,
  createCollection,
  deleteCollection,
  removeRequestFromCollection,
} from "../../stores/collection-store";
import { loadRequest } from "../../stores/http-store";
import MethodBadge from "../shared/MethodBadge";
import type { Collection } from "../../types/persistence";

// ---------------------------------------------------------------------------
// CollectionGroup — a single collapsible collection
// ---------------------------------------------------------------------------

interface CollectionGroupProps {
  collection: Collection;
  expanded: boolean;
  onToggle: () => void;
}

function CollectionGroup({ collection, expanded, onToggle }: CollectionGroupProps) {
  return (
    <li role="treeitem" aria-level={1} aria-expanded={expanded} data-collection-id={collection.id} class="mb-1">
      {/* Collection header */}
      <div class="flex items-center gap-1 group">
        <button
          type="button"
          class="flex items-center gap-2 flex-1 px-3 py-1.5 hover:bg-pm-bg-elevated cursor-pointer transition-colors rounded text-left"
          onClick={onToggle}
          aria-label={`${expanded ? "Collapse" : "Expand"} collection ${collection.name}`}
        >
          {/* Chevron */}
          <svg
            class={`w-3 h-3 text-pm-text-secondary transition-transform shrink-0 ${expanded ? "rotate-90" : ""}`}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            aria-hidden="true"
          >
            <polyline points="9 18 15 12 9 6" />
          </svg>
          {/* Collection icon */}
          <svg class="w-4 h-4 text-pm-text-secondary shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
          </svg>
          <span class="text-sm font-medium text-pm-text-primary truncate">
            {collection.name}
          </span>
        </button>

        {/* Delete collection button */}
        <button
          type="button"
          class="shrink-0 mr-2 text-pm-text-tertiary hover:text-pm-status-error transition-colors p-1 opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
          aria-label={`Delete collection ${collection.name}`}
          onClick={() => deleteCollection(collection.id)}
        >
          <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
            <path d="M10 11v6M14 11v6" />
            <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
          </svg>
        </button>
      </div>

      {/* Requests list */}
      {expanded && (
        <ul role="group" class="ml-4 flex flex-col gap-0">
          {collection.requests.length === 0 ? (
            <li class="px-3 py-1 text-xs text-pm-text-tertiary italic">
              No requests saved.
            </li>
          ) : (
            collection.requests.map((req) => (
              <li key={req.id} role="treeitem" aria-level={2} class="group/req flex items-center hover:bg-pm-bg-elevated rounded transition-colors">
                <button
                  type="button"
                  class="flex items-center gap-2 flex-1 min-w-0 px-3 py-1.5 text-left"
                  onClick={() => loadRequest(req.requestSnapshot)}
                  title={req.url}
                >
                  <MethodBadge method={req.method} />
                  <span class="text-sm text-pm-text-primary truncate">
                    {req.name}
                  </span>
                </button>
                <button
                  type="button"
                  class="shrink-0 mr-2 text-pm-text-tertiary hover:text-pm-status-error transition-colors p-1 opacity-0 group-hover/req:opacity-100 focus-visible:opacity-100"
                  aria-label={`Delete request ${req.name}`}
                  onClick={() => removeRequestFromCollection(collection.id, req.id)}
                >
                  <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </li>
  );
}

// ---------------------------------------------------------------------------
// CollectionPanel — top-level island
// ---------------------------------------------------------------------------

export default function CollectionPanel() {
  const allCollections = collections.value;
  const [showNewInput, setShowNewInput] = useState(false);
  const [newName, setNewName] = useState("");
  const [nameError, setNameError] = useState("");

  // Expanded state keyed by collection id — lifted here so the keyboard
  // handler can read and toggle it without prop-drilling through CollectionGroup.
  const [expandedIds, setExpandedIds] = useState<ReadonlySet<string>>(
    () => new Set(allCollections.map((c) => c.id))
  );

  function toggleExpanded(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function handleCreateCollection() {
    const trimmed = newName.trim();
    if (!trimmed) {
      setNameError("Name is required.");
      return;
    }
    const newCol = createCollection(trimmed);
    // Auto-expand newly created collection
    setExpandedIds((prev) => new Set([...prev, newCol.id]));
    setNewName("");
    setNameError("");
    setShowNewInput(false);
  }

  function handleNewInputKeyDown(e: KeyboardEvent) {
    if (e.key === "Enter") handleCreateCollection();
    if (e.key === "Escape") {
      setShowNewInput(false);
      setNewName("");
      setNameError("");
    }
  }

  /**
   * WAI-ARIA Treeview keyboard navigation (WCAG 2.1 criterion 2.1.1).
   *
   * Focus model: `document.activeElement` is always a <button>, never the <li>.
   * We query the primary action button inside each treeitem (first-of-type),
   * find the focused one by index, then walk up to the parent <li> via
   * closest('[role="treeitem"]') to read aria-level and data-collection-id.
   *
   * ArrowDown / ArrowUp  — move focus between primary action buttons of visible treeitems.
   * ArrowRight           — expand a collapsed collection (aria-level=1); no-op on leaves.
   * ArrowLeft            — collapse an expanded collection (aria-level=1); no-op on leaves.
   */
  function handleTreeKeyDown(e: KeyboardEvent) {
    if (!["ArrowDown", "ArrowUp", "ArrowRight", "ArrowLeft"].includes(e.key)) return;

    const tree = e.currentTarget as HTMLElement;
    // Each treeitem's primary button: the expand/collapse button for collections,
    // the load button for requests. querySelectorAll returns them in DOM order,
    // and collapsed children are not in the DOM, so hidden items are excluded.
    const primaryButtons = Array.from(
      tree.querySelectorAll<HTMLElement>('[role="treeitem"] button:first-of-type')
    );
    const focused = document.activeElement as HTMLElement;
    const idx = primaryButtons.indexOf(focused);

    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (idx < primaryButtons.length - 1) primaryButtons[idx + 1].focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (idx > 0) primaryButtons[idx - 1].focus();
    } else if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      e.preventDefault();
      // Walk up from the focused button to its treeitem <li>
      const treeitem = focused.closest<HTMLElement>('[role="treeitem"]');
      if (!treeitem || treeitem.getAttribute("aria-level") !== "1") return;

      const colId = treeitem.dataset["collectionId"];
      if (!colId) return;

      const isExpanded = expandedIds.has(colId);
      if (e.key === "ArrowRight" && !isExpanded) toggleExpanded(colId);
      if (e.key === "ArrowLeft" && isExpanded) toggleExpanded(colId);
    }
  }

  return (
    <div class="flex flex-col gap-0">
      {/* New collection button */}
      <div class="flex items-center justify-between px-2 py-1">
        <span class="text-xs text-pm-text-tertiary font-semibold uppercase tracking-wide">
          Collections
        </span>
        <button
          type="button"
          class="text-xs text-pm-text-secondary hover:text-pm-text-primary transition-colors p-1 rounded hover:bg-pm-bg-elevated"
          aria-label="Create new collection"
          title="New Collection"
          onClick={() => {
            setShowNewInput((v) => !v);
            setNewName("");
            setNameError("");
          }}
        >
          <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>
      </div>

      {/* Inline new collection input */}
      {showNewInput && (
        <div class="px-2 pb-2 flex flex-col gap-1">
          <input
            autoFocus
            type="text"
            placeholder="Collection name"
            value={newName}
            class="w-full px-2 py-1.5 bg-pm-bg-tertiary border border-pm-border rounded text-sm text-pm-text-primary placeholder:text-pm-text-tertiary focus:outline-none focus:border-pm-accent"
            onInput={(e) => {
              setNewName((e.target as HTMLInputElement).value);
              setNameError("");
            }}
            onKeyDown={handleNewInputKeyDown}
          />
          {nameError && (
            <span class="text-xs text-pm-status-error" role="alert">
              {nameError}
            </span>
          )}
          <div class="flex gap-1">
            <button
              type="button"
              class="flex-1 px-2 py-1 text-xs font-semibold text-white bg-pm-accent hover:bg-pm-accent-hover rounded transition-colors"
              onClick={handleCreateCollection}
            >
              Create
            </button>
            <button
              type="button"
              class="flex-1 px-2 py-1 text-xs text-pm-text-secondary hover:text-pm-text-primary bg-pm-bg-elevated hover:bg-pm-bg-tertiary rounded transition-colors"
              onClick={() => {
                setShowNewInput(false);
                setNewName("");
                setNameError("");
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Collections tree */}
      {allCollections.length === 0 && !showNewInput ? (
        <div class="py-4 px-3 text-sm text-pm-text-tertiary text-center">
          No collections yet.
        </div>
      ) : (
        <ul
          role="tree"
          aria-label="Collections"
          class="flex flex-col gap-0"
          onKeyDown={handleTreeKeyDown}
        >
          {allCollections.map((col) => (
            <CollectionGroup
              key={col.id}
              collection={col}
              expanded={expandedIds.has(col.id)}
              onToggle={() => toggleExpanded(col.id)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
