import KeyValueTable from "../shared/KeyValueTable";
import { requestState } from "../../stores/http-store";
import { addHeader, updateHeader, removeHeader, toggleHeader } from "../../stores/http-store";
import type { KeyValuePair } from "../../types/http";

export default function HeadersTable() {
  const headers = requestState.value.headers;

  return (
    <KeyValueTable
      items={headers}
      showDescription={false}
      onAdd={addHeader}
      onUpdate={(id, field, value) => updateHeader(id, field as keyof Omit<KeyValuePair, "id">, value)}
      onRemove={removeHeader}
      onToggle={toggleHeader}
    />
  );
}
