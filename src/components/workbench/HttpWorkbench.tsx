import RequestPanel from "../request/RequestPanel";
import ResponsePanel from "../response/ResponsePanel";

export default function HttpWorkbench() {
  return (
    <div class="flex-1 flex flex-col overflow-hidden">
      {/* Request panel */}
      <div class="flex-1 overflow-y-auto">
        <RequestPanel />
      </div>

      {/* Visual resize handle (static for MVP) */}
      <div
        class="h-1 bg-pm-bg-secondary hover:bg-pm-accent/30 cursor-row-resize flex items-center justify-center transition-colors"
        aria-label="Resize handle"
        aria-hidden="true"
      >
        <div class="flex gap-1">
          <div class="w-1 h-1 rounded-full bg-pm-text-tertiary" />
          <div class="w-1 h-1 rounded-full bg-pm-text-tertiary" />
          <div class="w-1 h-1 rounded-full bg-pm-text-tertiary" />
        </div>
      </div>

      {/* Response panel */}
      <div class="flex-1 overflow-y-auto">
        <ResponsePanel />
      </div>
    </div>
  );
}
