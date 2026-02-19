import { responseState } from "../../stores/http-store";

export default function ResponseHeaders() {
  const response = responseState.value;

  if (!response) return null;

  return (
    <div class="bg-pm-bg-tertiary rounded">
      {/* Header row */}
      <div class="grid grid-cols-2 gap-2 px-4 py-2 border-b border-pm-border-subtle">
        <div class="text-xs font-semibold text-pm-text-secondary uppercase">Key</div>
        <div class="text-xs font-semibold text-pm-text-secondary uppercase">Value</div>
      </div>

      {/* Header entries */}
      {response.headers.map((header) => (
        <div
          key={header.key}
          class="grid grid-cols-2 gap-2 px-4 py-2 hover:bg-pm-bg-secondary transition-colors"
        >
          <div class="text-sm text-pm-text-primary font-medium">{header.key}</div>
          <div class="text-sm text-pm-text-secondary font-pm-mono break-all">{header.value}</div>
        </div>
      ))}
    </div>
  );
}
