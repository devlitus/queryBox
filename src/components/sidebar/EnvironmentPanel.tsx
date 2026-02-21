import { useState } from "preact/hooks";
import {
  environments,
  activeEnvironmentId,
  createEnvironment,
  deleteEnvironment,
  renameEnvironment,
  duplicateEnvironment,
  setActiveEnvironment,
  addVariable,
  updateVariable,
  removeVariable,
  toggleVariable,
} from "../../stores/environment-store";
import KeyValueTable from "../shared/KeyValueTable";
import type { Environment, EnvironmentVariable } from "../../types/environment";
import type { KeyValuePair } from "../../types/http";

// ---------------------------------------------------------------------------
// EnvironmentGroup — a single expandable environment row
// ---------------------------------------------------------------------------

interface EnvironmentGroupProps {
  environment: Environment;
  isActive: boolean;
  expanded: boolean;
  onToggle: () => void;
}

function EnvironmentGroup({ environment, isActive, expanded, onToggle }: EnvironmentGroupProps) {
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameName, setRenameName] = useState(environment.name);

  function handleRenameSubmit() {
    const trimmed = renameName.trim();
    if (trimmed) {
      renameEnvironment(environment.id, trimmed);
    } else {
      setRenameName(environment.name);
    }
    setIsRenaming(false);
  }

  function handleRenameKeyDown(e: KeyboardEvent) {
    if (e.key === "Enter") handleRenameSubmit();
    if (e.key === "Escape") {
      setRenameName(environment.name);
      setIsRenaming(false);
    }
  }

  // Map EnvironmentVariable[] to KeyValuePair[] for KeyValueTable compatibility
  function toKeyValuePairs(vars: EnvironmentVariable[]): KeyValuePair[] {
    return vars.map((v) => ({
      id: v.id,
      key: v.key,
      value: v.value,
      enabled: v.enabled,
    }));
  }

  function handleTableUpdate(id: string, field: keyof Omit<KeyValuePair, "id">, value: string | boolean) {
    // Map KeyValuePair fields back to EnvironmentVariable fields (excluding description)
    if (field === "description") return;
    updateVariable(environment.id, id, field as keyof Omit<EnvironmentVariable, "id">, value);
  }

  return (
    <li
      role="treeitem"
      aria-level={1}
      aria-expanded={expanded}
      data-environment-id={environment.id}
      class="mb-1"
    >
      {/* Environment header row */}
      <div class="flex items-center gap-1 group">
        <button
          type="button"
          class="flex items-center gap-2 flex-1 min-w-0 px-3 py-1.5 hover:bg-pm-bg-elevated cursor-pointer transition-colors rounded text-left"
          onClick={onToggle}
          aria-label={`${expanded ? "Collapse" : "Expand"} environment ${environment.name}`}
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

          {/* Active indicator (green dot) */}
          <div
            class={`w-2 h-2 rounded-full shrink-0 transition-colors ${isActive ? "bg-pm-status-success" : "bg-transparent"}`}
            aria-label={isActive ? "Active environment" : undefined}
          />

          {/* Environment name or rename input */}
          {isRenaming ? (
            <input
              autoFocus
              type="text"
              value={renameName}
              class="flex-1 min-w-0 px-1 py-0.5 bg-pm-bg-tertiary border border-pm-accent rounded text-sm text-pm-text-primary focus:outline-none"
              aria-label="Rename environment"
              onInput={(e) => setRenameName((e.target as HTMLInputElement).value)}
              onKeyDown={handleRenameKeyDown}
              onBlur={handleRenameSubmit}
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <span class="text-sm font-medium text-pm-text-primary truncate flex-1 min-w-0">
              {environment.name}
            </span>
          )}
        </button>

        {/* Set active button */}
        <button
          type="button"
          class={`shrink-0 text-xs transition-colors px-1.5 py-1 rounded opacity-0 group-hover:opacity-100 focus-visible:opacity-100 ${
            isActive
              ? "text-pm-status-success"
              : "text-pm-text-tertiary hover:text-pm-status-success"
          }`}
          aria-label={isActive ? "Active environment" : `Set ${environment.name} as active environment`}
          title={isActive ? "Active" : "Set as active"}
          onClick={() => setActiveEnvironment(isActive ? null : environment.id)}
        >
          <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
          </svg>
        </button>

        {/* Rename button */}
        <button
          type="button"
          class="shrink-0 text-pm-text-tertiary hover:text-pm-text-primary transition-colors p-1 opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
          aria-label={`Rename environment ${environment.name}`}
          title="Rename"
          onClick={() => {
            setRenameName(environment.name);
            setIsRenaming(true);
          }}
        >
          <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
          </svg>
        </button>

        {/* Duplicate button */}
        <button
          type="button"
          class="shrink-0 text-pm-text-tertiary hover:text-pm-text-primary transition-colors p-1 opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
          aria-label={`Duplicate environment ${environment.name}`}
          title="Duplicate"
          onClick={() => duplicateEnvironment(environment.id)}
        >
          <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
          </svg>
        </button>

        {/* Delete button */}
        <button
          type="button"
          class="shrink-0 mr-2 text-pm-text-tertiary hover:text-pm-status-error transition-colors p-1 opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
          aria-label={`Delete environment ${environment.name}`}
          title="Delete"
          onClick={() => deleteEnvironment(environment.id)}
        >
          <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
            <path d="M10 11v6M14 11v6" />
            <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
          </svg>
        </button>
      </div>

      {/* Variable editor (expanded) */}
      {expanded && (
        <div class="ml-4 mt-1 mb-2">
          <KeyValueTable
            items={toKeyValuePairs(environment.variables)}
            showDescription={false}
            onAdd={() => addVariable(environment.id)}
            onUpdate={handleTableUpdate}
            onRemove={(id) => removeVariable(environment.id, id)}
            onToggle={(id) => toggleVariable(environment.id, id)}
          />
        </div>
      )}
    </li>
  );
}

// ---------------------------------------------------------------------------
// EnvironmentPanel — top-level island
// ---------------------------------------------------------------------------

export default function EnvironmentPanel() {
  const allEnvironments = environments.value;
  const currentActiveId = activeEnvironmentId.value;

  const [showNewInput, setShowNewInput] = useState(false);
  const [newName, setNewName] = useState("");
  const [nameError, setNameError] = useState("");

  const [expandedIds, setExpandedIds] = useState<ReadonlySet<string>>(
    () => new Set<string>()
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

  function handleCreateEnvironment() {
    const trimmed = newName.trim();
    if (!trimmed) {
      setNameError("Name is required.");
      return;
    }
    const newEnv = createEnvironment(trimmed);
    // Auto-expand newly created environment
    setExpandedIds((prev) => new Set([...prev, newEnv.id]));
    setNewName("");
    setNameError("");
    setShowNewInput(false);
  }

  function handleNewInputKeyDown(e: KeyboardEvent) {
    if (e.key === "Enter") handleCreateEnvironment();
    if (e.key === "Escape") {
      setShowNewInput(false);
      setNewName("");
      setNameError("");
    }
  }

  /**
   * WAI-ARIA Treeview keyboard navigation.
   * ArrowDown/Up — move focus between primary action buttons of visible treeitems.
   * ArrowRight   — expand a collapsed environment.
   * ArrowLeft    — collapse an expanded environment.
   */
  function handleTreeKeyDown(e: KeyboardEvent) {
    if (!["ArrowDown", "ArrowUp", "ArrowRight", "ArrowLeft"].includes(e.key)) return;

    const tree = e.currentTarget as HTMLElement;
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
      const treeitem = focused.closest<HTMLElement>('[role="treeitem"]');
      if (!treeitem || treeitem.getAttribute("aria-level") !== "1") return;

      const envId = treeitem.dataset["environmentId"];
      if (!envId) return;

      const isExpanded = expandedIds.has(envId);
      if (e.key === "ArrowRight" && !isExpanded) toggleExpanded(envId);
      if (e.key === "ArrowLeft" && isExpanded) toggleExpanded(envId);
    }
  }

  return (
    <div class="flex flex-col gap-0">
      {/* Header: title + new button */}
      <div class="flex items-center justify-between px-2 py-1">
        <span class="text-xs text-pm-text-tertiary font-semibold uppercase tracking-wide">
          Environments
        </span>
        <button
          type="button"
          class="text-xs text-pm-text-secondary hover:text-pm-text-primary transition-colors p-1 rounded hover:bg-pm-bg-elevated"
          aria-label="Create new environment"
          title="New Environment"
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

      {/* Inline new environment input */}
      {showNewInput && (
        <div class="px-2 pb-2 flex flex-col gap-1">
          <input
            autoFocus
            type="text"
            placeholder="Environment name"
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
              onClick={handleCreateEnvironment}
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

      {/* Environments tree */}
      {allEnvironments.length === 0 && !showNewInput ? (
        <div class="py-4 px-3 text-sm text-pm-text-tertiary text-center">
          No environments yet.
        </div>
      ) : (
        <ul
          role="tree"
          aria-label="Environments"
          class="flex flex-col gap-0"
          onKeyDown={handleTreeKeyDown}
        >
          {allEnvironments.map((env) => (
            <EnvironmentGroup
              key={env.id}
              environment={env}
              isActive={env.id === currentActiveId}
              expanded={expandedIds.has(env.id)}
              onToggle={() => toggleExpanded(env.id)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
