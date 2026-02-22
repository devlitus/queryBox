import ResponseStatusBar from "./ResponseStatusBar";
import ResponseTabs from "./ResponseTabs";
import AiDiagnoseButton from "./AiDiagnoseButton";
import AiDiagnosisPanel from "./AiDiagnosisPanel";
import { requestStatus, requestError } from "../../stores/http-store";
import { canDiagnose, diagnosisStatus } from "../../stores/ai-diagnosis-store";

export default function ResponsePanel() {
  const status = requestStatus.value;
  const error = requestError.value;
  const showDiagnosis = canDiagnose.value;
  const dxStatus = diagnosisStatus.value;
  const showPanel = dxStatus !== "idle";

  return (
    <div class="flex flex-col border-t-2 border-pm-border flex-1">
      {status === "idle" && (
        <div
          class="flex-1 flex flex-col items-center justify-center p-8 text-center"
          aria-live="polite"
        >
          <svg
            class="w-16 h-16 text-pm-text-tertiary mb-4 opacity-40"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1"
            aria-hidden="true"
          >
            <line x1="22" y1="2" x2="11" y2="13" />
            <polygon points="22 2 15 22 11 13 2 9 22 2" />
          </svg>
          <p class="text-pm-text-secondary text-sm font-medium mb-1">No response yet</p>
          <p class="text-pm-text-tertiary text-xs">
            Enter a URL and click Send to get a response.
          </p>
          <p class="text-pm-text-tertiary text-xs mt-2">
            Try: <span class="font-pm-mono">https://jsonplaceholder.typicode.com/todos/1</span>
          </p>
        </div>
      )}

      {status === "loading" && (
        <div
          class="flex-1 flex flex-col items-center justify-center p-8"
          role="status"
          aria-live="polite"
          aria-label="Sending request"
        >
          <div
            class="w-10 h-10 border-4 border-pm-border border-t-pm-accent rounded-full animate-spin mb-4"
            aria-hidden="true"
          />
          <p class="text-pm-text-secondary text-sm">Sending request...</p>
        </div>
      )}

      {status === "error" && error && (
        <div
          class="flex-1 flex flex-col items-center justify-center p-8 text-center"
          role="alert"
          aria-live="assertive"
        >
          <svg
            class="w-12 h-12 text-pm-status-error mb-4 opacity-70"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <p class="text-pm-status-error text-sm font-semibold mb-2">
            {error.type === "cors"
              ? "CORS Error"
              : error.type === "abort"
              ? "Request Cancelled"
              : error.type === "network"
              ? "Network Error"
              : "Request Failed"}
          </p>
          <p class="text-pm-text-secondary text-xs max-w-md leading-relaxed">{error.message}</p>
          {showDiagnosis && (
            <div class="mt-4">
              <AiDiagnoseButton />
            </div>
          )}
        </div>
      )}

      {status === "success" && (
        <>
          <ResponseStatusBar />
          <ResponseTabs />
        </>
      )}

      {showPanel && <AiDiagnosisPanel />}
    </div>
  );
}
