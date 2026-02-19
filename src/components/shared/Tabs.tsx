import type { ComponentChildren } from "preact";
import { useRef } from "preact/hooks";

export interface TabItem {
  id: string;
  label: string;
  count?: number;
}

interface Props {
  tabs: TabItem[];
  activeTab: string;
  onTabChange: (id: string) => void;
  children?: ComponentChildren;
  /** Prefix for tab panel IDs to ensure uniqueness when multiple Tabs instances exist in the DOM. */
  idPrefix?: string;
}

export default function Tabs({ tabs, activeTab, onTabChange, children, idPrefix = "" }: Props) {
  const tablistRef = useRef<HTMLDivElement>(null);

  function handleKeyDown(e: KeyboardEvent, currentId: string) {
    const currentIndex = tabs.findIndex((t) => t.id === currentId);
    let nextIndex = currentIndex;

    switch (e.key) {
      case "ArrowRight":
        e.preventDefault();
        nextIndex = (currentIndex + 1) % tabs.length;
        break;
      case "ArrowLeft":
        e.preventDefault();
        nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
        break;
      case "Home":
        e.preventDefault();
        nextIndex = 0;
        break;
      case "End":
        e.preventDefault();
        nextIndex = tabs.length - 1;
        break;
      default:
        return;
    }

    const nextTab = tabs[nextIndex];
    onTabChange(nextTab.id);

    // Move focus to the new active tab button
    const buttons = tablistRef.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]');
    buttons?.[nextIndex]?.focus();
  }

  return (
    <div class="block">
      <div class="flex items-center border-b border-pm-border px-4" role="tablist" ref={tablistRef}>
        {tabs.map((tab) => {
          const isActive = tab.id === activeTab;
          return (
            <button
              key={tab.id}
              type="button"
              class={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                isActive
                  ? "text-pm-text-primary border-pm-accent"
                  : "text-pm-text-secondary hover:text-pm-text-primary border-transparent"
              }`}
              role="tab"
              aria-selected={isActive}
              aria-controls={`${idPrefix}tabpanel-${tab.id}`}
              tabIndex={isActive ? 0 : -1}
              onClick={() => onTabChange(tab.id)}
              onKeyDown={(e) => handleKeyDown(e, tab.id)}
            >
              {tab.label}
              {tab.count !== undefined && tab.count > 0 && (
                <span class="ml-1 text-xs text-pm-text-tertiary">({tab.count})</span>
              )}
            </button>
          );
        })}
      </div>
      {children}
    </div>
  );
}
