import type { HttpMethod } from "../../types/http";
import MethodBadge from "../shared/MethodBadge";

interface Props {
  id: string;
  name: string;
  method: HttpMethod;
  isActive: boolean;
  isDirty: boolean;
  onSwitch: (id: string) => void;
  onClose: (id: string) => void;
}

export default function TabBarItem({ id, name, method, isActive, isDirty, onSwitch, onClose }: Props) {
  function handleMouseDown(e: MouseEvent): void {
    // Middle-click to close (button 1)
    if (e.button === 1) {
      e.preventDefault();
      onClose(id);
    }
  }

  function handleCloseClick(e: MouseEvent): void {
    e.stopPropagation();
    onClose(id);
  }

  function handleKeyDown(e: KeyboardEvent): void {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onSwitch(id);
    }
  }

  const baseClass =
    "flex items-center gap-2 px-3 py-2 border-r border-pm-border cursor-pointer transition-colors min-w-0 flex-shrink-0 max-w-[200px]";
  const stateClass = isActive
    ? "bg-pm-bg-primary border-b-2 border-b-pm-accent"
    : "bg-pm-bg-secondary hover:bg-pm-bg-elevated";

  return (
    <div
      role="tab"
      aria-selected={isActive}
      tabIndex={0}
      class={`${baseClass} ${stateClass}`}
      onClick={() => onSwitch(id)}
      onMouseDown={handleMouseDown}
      onKeyDown={handleKeyDown}
    >
      <MethodBadge method={method} />
      <span class="text-sm text-pm-text-primary truncate">{name}</span>
      {isDirty && (
        <div
          class="w-1.5 h-1.5 rounded-full bg-pm-accent flex-shrink-0"
          aria-label="Modified"
        />
      )}
      <button
        type="button"
        class="w-4 h-4 ml-1 flex-shrink-0 text-pm-text-secondary hover:text-pm-text-primary transition-colors"
        aria-label={`Close tab ${name}`}
        onClick={handleCloseClick}
      >
        {/* Close icon (inline SVG — same pattern as rest of codebase) */}
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
  );
}
