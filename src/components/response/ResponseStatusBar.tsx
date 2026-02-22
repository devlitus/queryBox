import { responseState, formattedSize, statusColorClass } from "../../stores/http-store";
import { canDiagnose } from "../../stores/ai-diagnosis-store";
import AiDiagnoseButton from "./AiDiagnoseButton";

export default function ResponseStatusBar() {
  const response = responseState.value;

  if (!response) return null;

  const showDiagnosis = canDiagnose.value;

  return (
    <div class="flex items-center gap-6 px-4 py-2 bg-pm-bg-secondary border-b border-pm-border text-xs">
      <div class="flex items-center gap-2">
        <span class="text-pm-text-secondary">Status:</span>
        <span class={`font-semibold ${statusColorClass.value}`}>
          {response.status} {response.statusText}
        </span>
      </div>
      <div class="h-4 w-px bg-pm-border" />
      <div class="flex items-center gap-2">
        <span class="text-pm-text-secondary">Time:</span>
        <span class="text-pm-text-primary font-medium">{response.time}ms</span>
      </div>
      <div class="h-4 w-px bg-pm-border" />
      <div class="flex items-center gap-2">
        <span class="text-pm-text-secondary">Size:</span>
        <span class="text-pm-text-primary font-medium">{formattedSize.value}</span>
      </div>
      {showDiagnosis && (
        <>
          <div class="h-4 w-px bg-pm-border" />
          <AiDiagnoseButton />
        </>
      )}
    </div>
  );
}
