import { useSignal } from "@preact/signals";
import { useEffect, useRef } from "preact/hooks";

export interface DropdownItem {
  label: string;
  value: string;
  colorClass?: string;
}

interface Props {
  items: DropdownItem[];
  selected: string;
  onSelect: (value: string) => void;
  buttonClass?: string;
  panelClass?: string;
  label?: string;
  icon?: string;
}

export default function Dropdown({ items, selected, onSelect, buttonClass = "", panelClass = "", label, icon }: Props) {
  const isOpen = useSignal(false);
  const focusedIndex = useSignal(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const selectedItem = items.find((i) => i.value === selected) ?? items[0];

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        isOpen.value = false;
        focusedIndex.value = -1;
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function open() {
    isOpen.value = true;
    focusedIndex.value = items.findIndex((i) => i.value === selected);
  }

  function close() {
    isOpen.value = false;
    focusedIndex.value = -1;
  }

  function select(value: string) {
    onSelect(value);
    close();
  }

  function handleButtonKeyDown(e: KeyboardEvent) {
    switch (e.key) {
      case "Enter":
      case " ":
      case "ArrowDown":
        e.preventDefault();
        open();
        break;
      case "ArrowUp":
        e.preventDefault();
        open();
        focusedIndex.value = items.length - 1;
        break;
    }
  }

  function handleListKeyDown(e: KeyboardEvent) {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        focusedIndex.value = Math.min(focusedIndex.value + 1, items.length - 1);
        break;
      case "ArrowUp":
        e.preventDefault();
        focusedIndex.value = Math.max(focusedIndex.value - 1, 0);
        break;
      case "Home":
        e.preventDefault();
        focusedIndex.value = 0;
        break;
      case "End":
        e.preventDefault();
        focusedIndex.value = items.length - 1;
        break;
      case "Enter":
      case " ":
        e.preventDefault();
        if (focusedIndex.value >= 0) {
          select(items[focusedIndex.value].value);
        }
        break;
      case "Escape":
        e.preventDefault();
        close();
        break;
      case "Tab":
        close();
        break;
    }
  }

  return (
    <div class="relative inline-block" ref={containerRef}>
      <button
        type="button"
        class={buttonClass}
        aria-haspopup="listbox"
        aria-expanded={isOpen.value}
        aria-label={label}
        onClick={() => (isOpen.value ? close() : open())}
        onKeyDown={handleButtonKeyDown}
      >
        {icon && (
          <span class="w-4 h-4 flex-shrink-0" aria-hidden="true" dangerouslySetInnerHTML={{ __html: icon }} />
        )}
        <span class={selectedItem?.colorClass}>{selectedItem?.label}</span>
        <svg class="w-4 h-4 text-pm-text-secondary" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {isOpen.value && (
        <div
          class={`absolute top-full left-0 mt-1 bg-pm-bg-elevated border border-pm-border rounded shadow-lg z-50 min-w-[120px] ${panelClass}`}
          role="listbox"
          aria-label={label}
          ref={listRef}
          tabIndex={-1}
          onKeyDown={handleListKeyDown}
        >
          {items.map((item, index) => (
            <button
              key={item.value}
              type="button"
              class={`w-full text-left px-4 py-2 hover:bg-pm-bg-tertiary transition-colors font-semibold text-sm ${item.colorClass ?? "text-pm-text-primary"} ${
                focusedIndex.value === index ? "bg-pm-bg-tertiary" : ""
              }`}
              role="option"
              aria-selected={item.value === selected}
              onClick={() => select(item.value)}
              onMouseEnter={() => { focusedIndex.value = index; }}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
