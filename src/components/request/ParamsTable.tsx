import KeyValueTable from "../shared/KeyValueTable";
import { requestState } from "../../stores/http-store";
import { addParam, updateParam, removeParam, toggleParam } from "../../stores/http-store";
import type { KeyValuePair } from "../../types/http";

export default function ParamsTable() {
  const params = requestState.value.params;

  return (
    <KeyValueTable
      items={params}
      showDescription={true}
      onAdd={addParam}
      onUpdate={(id, field, value) => updateParam(id, field as keyof Omit<KeyValuePair, "id">, value)}
      onRemove={removeParam}
      onToggle={toggleParam}
    />
  );
}
