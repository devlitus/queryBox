import environmentIcon from "../../assets/icons/environment.svg?raw";
import Dropdown from "../shared/Dropdown";
import type { DropdownItem } from "../shared/Dropdown";
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
      icon={environmentIcon}
      buttonClass="hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 rounded hover:bg-pm-bg-elevated transition-colors text-sm text-pm-text-secondary hover:text-pm-text-primary font-medium max-w-[160px]"
      panelClass="right-0 left-auto min-w-[180px]"
      label="Select active environment"
    />
  );
}
