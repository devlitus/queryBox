import { useRef } from "preact/hooks";
import { tabs, activeTabId, createTab, closeTab, switchTab } from "../../stores/tab-store";
import TabBarItem from "./TabBarItem";

export default function TabBar() {
  const scrollRef = useRef<HTMLDivElement>(null);

  function handleKeyDown(e: KeyboardEvent): void {
    const currentTabs = tabs.value;
    const currentIdx = currentTabs.findIndex((t) => t.id === activeTabId.value);

    if (e.key === "ArrowRight") {
      e.preventDefault();
      const nextIdx = (currentIdx + 1) % currentTabs.length;
      switchTab(currentTabs[nextIdx].id);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      const prevIdx = (currentIdx - 1 + currentTabs.length) % currentTabs.length;
      switchTab(currentTabs[prevIdx].id);
    }
  }

  return (
    <div
      class="bg-pm-bg-secondary border-b border-pm-border flex items-center"
      role="tablist"
      aria-label="Request tabs"
    >
      {/* Horizontally scrollable tab container */}
      <div
        ref={scrollRef}
        class="flex overflow-x-auto min-w-0"
        style="scrollbar-width: none"
        onKeyDown={handleKeyDown}
      >
        {tabs.value.map((tab) => (
          <TabBarItem
            key={tab.id}
            id={tab.id}
            name={tab.name}
            method={tab.request.method}
            isActive={tab.id === activeTabId.value}
            isDirty={tab.isDirty}
            onSwitch={switchTab}
            onClose={closeTab}
          />
        ))}
      </div>

      {/* Plus button — fixed outside scroll area so it's always visible */}
      <button
        type="button"
        class="px-3 py-2 flex-shrink-0 text-pm-text-secondary hover:text-pm-text-primary transition-colors"
        aria-label="New tab"
        onClick={() => createTab()}
      >
        {/* Plus icon (inline SVG) */}
        <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </button>
    </div>
  );
}
