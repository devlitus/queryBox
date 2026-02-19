import Dropdown from "../shared/Dropdown";
import { requestState } from "../../stores/http-store";
import { updateMethod } from "../../stores/http-store";
import type { HttpMethod } from "../../types/http";

const METHOD_ITEMS = [
  { label: "GET",    value: "GET",    colorClass: "text-pm-method-get" },
  { label: "POST",   value: "POST",   colorClass: "text-pm-method-post" },
  { label: "PUT",    value: "PUT",    colorClass: "text-pm-method-put" },
  { label: "PATCH",  value: "PATCH",  colorClass: "text-pm-method-patch" },
  { label: "DELETE", value: "DELETE", colorClass: "text-pm-method-delete" },
];

export default function MethodSelector() {
  const method = requestState.value.method;
  const selectedItem = METHOD_ITEMS.find((m) => m.value === method) ?? METHOD_ITEMS[0];

  return (
    <Dropdown
      items={METHOD_ITEMS}
      selected={method}
      onSelect={(value) => updateMethod(value as HttpMethod)}
      buttonClass={`inline-flex items-center gap-2 px-3 py-2 bg-pm-bg-tertiary hover:bg-pm-bg-elevated transition-colors font-semibold text-sm rounded-l ${selectedItem.colorClass}`}
      label="HTTP Method"
    />
  );
}
