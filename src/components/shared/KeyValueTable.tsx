import type { KeyValuePair } from "../../types/http";

interface Props {
  items: KeyValuePair[];
  showDescription: boolean;
  onAdd: () => void;
  onUpdate: (id: string, field: keyof Omit<KeyValuePair, "id">, value: string | boolean) => void;
  onRemove: (id: string) => void;
  onToggle: (id: string) => void;
}

export default function KeyValueTable({ items, showDescription, onAdd, onUpdate, onRemove, onToggle }: Props) {
  const gridClass = showDescription
    ? "grid-cols-[auto_2fr_2fr_3fr_auto]"
    : "grid-cols-[auto_1fr_1fr_auto]";

  return (
    <div class="bg-pm-bg-tertiary rounded">
      {/* Header */}
      <div class={`grid gap-2 px-2 py-2 border-b border-pm-border-subtle ${gridClass}`}>
        <div></div>
        <div class="text-xs font-semibold text-pm-text-secondary uppercase px-1">Key</div>
        <div class="text-xs font-semibold text-pm-text-secondary uppercase px-1">Value</div>
        {showDescription && (
          <div class="text-xs font-semibold text-pm-text-secondary uppercase px-1">Description</div>
        )}
        <div></div>
      </div>

      {/* Existing rows */}
      {items.map((item) => (
        <div
          key={item.id}
          class={`grid gap-2 py-2 px-2 ${gridClass} hover:bg-pm-bg-secondary transition-colors`}
        >
          <input
            type="checkbox"
            checked={item.enabled}
            class="mt-1 accent-pm-accent"
            aria-label="Enable row"
            onChange={() => onToggle(item.id)}
          />
          <input
            type="text"
            value={item.key}
            placeholder="Key"
            class="bg-transparent border-b border-pm-border-subtle focus:border-pm-accent focus:outline-none text-sm text-pm-text-primary placeholder:text-pm-text-tertiary px-1"
            aria-label="Key"
            onInput={(e) => onUpdate(item.id, "key", (e.target as HTMLInputElement).value)}
          />
          <input
            type="text"
            value={item.value}
            placeholder="Value"
            class="bg-transparent border-b border-pm-border-subtle focus:border-pm-accent focus:outline-none text-sm text-pm-text-primary placeholder:text-pm-text-tertiary px-1"
            aria-label="Value"
            onInput={(e) => onUpdate(item.id, "value", (e.target as HTMLInputElement).value)}
          />
          {showDescription && (
            <input
              type="text"
              value={item.description ?? ""}
              placeholder="Description"
              class="bg-transparent border-b border-pm-border-subtle focus:border-pm-accent focus:outline-none text-sm text-pm-text-secondary placeholder:text-pm-text-tertiary px-1"
              aria-label="Description"
              onInput={(e) => onUpdate(item.id, "description", (e.target as HTMLInputElement).value)}
            />
          )}
          <button
            type="button"
            class="text-pm-text-tertiary hover:text-pm-status-error transition-colors px-1"
            aria-label="Remove row"
            onClick={() => onRemove(item.id)}
          >
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      ))}

      {/* Placeholder row — click or type to add */}
      <div class={`grid gap-2 py-2 px-2 ${gridClass} hover:bg-pm-bg-secondary transition-colors`}>
        <input
          type="checkbox"
          disabled
          class="mt-1 accent-pm-accent opacity-40"
          aria-label="Enable new row"
        />
        <input
          type="text"
          placeholder="New key"
          class="bg-transparent border-b border-pm-border-subtle focus:border-pm-accent focus:outline-none text-sm text-pm-text-primary placeholder:text-pm-text-tertiary px-1"
          aria-label="New key"
          onFocus={onAdd}
        />
        <input
          type="text"
          placeholder="New value"
          class="bg-transparent border-b border-pm-border-subtle focus:border-pm-accent focus:outline-none text-sm text-pm-text-primary placeholder:text-pm-text-tertiary px-1"
          aria-label="New value"
          onFocus={onAdd}
        />
        {showDescription && (
          <input
            type="text"
            placeholder="New description"
            class="bg-transparent border-b border-pm-border-subtle focus:border-pm-accent focus:outline-none text-sm text-pm-text-secondary placeholder:text-pm-text-tertiary px-1"
            aria-label="New description"
            onFocus={onAdd}
          />
        )}
        <div></div>
      </div>
    </div>
  );
}
