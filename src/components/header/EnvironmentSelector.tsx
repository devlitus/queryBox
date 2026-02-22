import Dropdown from "../shared/Dropdown";
import type { DropdownItem } from "../shared/Dropdown";

/**
 * Inline SVG icon for the environment selector.
 * Defined as a Preact component to avoid dangerouslySetInnerHTML with raw strings.
 */
function EnvironmentIcon({ class: className }: { class?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      class={className}
      aria-hidden="true"
    >
      <circle cx="10" cy="10" r="8" />
      <path d="M2 10h16M10 2c2 3 2 7 0 16m0-16c-2 3-2 7 0 16" />
    </svg>
  );
}
import {
  environments,
  activeEnvironmentId,
  setActiveEnvironment,
} from "../../stores/environment-store";

const NO_ENV_VALUE = "__none__";

export default function EnvironmentSelector() {
  const items: DropdownItem[] = [
    { label: "No Environment", value: NO_ENV_VALUE },
    ...environments.value.map((e) => ({ label: e.name, value: e.id })),
  ];

  const selected = activeEnvironmentId.value ?? NO_ENV_VALUE;

  function handleSelect(value: string) {
    setActiveEnvironment(value === NO_ENV_VALUE ? null : value);
  }

  return (
    <Dropdown
      items={items}
      selected={selected}
      onSelect={handleSelect}
      icon={EnvironmentIcon}
      buttonClass="hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 rounded hover:bg-pm-bg-elevated transition-colors text-sm text-pm-text-secondary hover:text-pm-text-primary font-medium max-w-[160px]"
      panelClass="right-0 left-auto min-w-[180px]"
      label="Select active environment"
    />
  );
}
