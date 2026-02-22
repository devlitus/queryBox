import {
  diagnosisStatus,
  rateLimitInfo,
  previewDiagnosis,
  cancelDiagnosis,
  clearDiagnosis,
} from "../../stores/ai-diagnosis-store";
import { useEffect, useState } from "preact/hooks";

/**
 * Button that triggers AI-powered error diagnosis.
 * Shows different states: idle, loading/streaming (cancel), done (retry), rate-limited (countdown).
 */
export default function AiDiagnoseButton() {
  const status = diagnosisStatus.value;
  const rateLimit = rateLimitInfo.value;

  // Countdown timer for rate-limit state
  const [countdown, setCountdown] = useState(0);

  useEffect(() => {
    if (status === "error" && rateLimit && rateLimit.resetIn > 0) {
      setCountdown(Math.ceil(rateLimit.resetIn / 1000));

      const interval = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(interval);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(interval);
    }
    setCountdown(0);
  }, [status, rateLimit?.resetIn]);

  const isInProgress =
    status === "previewing" || status === "loading" || status === "streaming";

  const isRateLimited = status === "error" && rateLimit && countdown > 0;

  function handleClick() {
    if (isInProgress) {
      cancelDiagnosis();
    } else if (status === "done") {
      clearDiagnosis();
      previewDiagnosis();
    } else {
      previewDiagnosis();
    }
  }

  // Rate limited — disabled with countdown
  if (isRateLimited) {
    return (
      <button
        type="button"
        disabled
        class="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded
               bg-pm-bg-tertiary text-pm-text-tertiary cursor-not-allowed"
        aria-label={`Rate limited. Retry in ${countdown} seconds`}
      >
        <SparklesIcon />
        Reintentar en {countdown}s
      </button>
    );
  }

  // In progress — show cancel button
  if (isInProgress) {
    return (
      <button
        type="button"
        onClick={handleClick}
        class="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded
               bg-pm-status-error/10 text-pm-status-error hover:bg-pm-status-error/20
               transition-colors"
        aria-label="Cancel diagnosis"
        aria-busy="true"
      >
        <CancelIcon />
        Cancelar diagnóstico
      </button>
    );
  }

  // Done — show retry button
  if (status === "done") {
    return (
      <button
        type="button"
        onClick={handleClick}
        class="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded
               bg-pm-accent/10 text-pm-accent hover:bg-pm-accent/20
               transition-colors"
        aria-label="Diagnose again with AI"
      >
        <SparklesIcon />
        Diagnosticar de nuevo
      </button>
    );
  }

  // Default — idle or error (non-rate-limit)
  return (
    <button
      type="button"
      onClick={handleClick}
      class="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded
             bg-pm-accent/10 text-pm-accent hover:bg-pm-accent/20
             transition-colors"
      aria-label="Diagnose error with AI"
    >
      <SparklesIcon />
      Diagnosticar con AI
    </button>
  );
}

// ---------------------------------------------------------------------------
// Icons (inline SVG)
// ---------------------------------------------------------------------------

function SparklesIcon() {
  return (
    <svg
      class="w-3.5 h-3.5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <path d="M12 3l1.912 5.813a2 2 0 001.275 1.275L21 12l-5.813 1.912a2 2 0 00-1.275 1.275L12 21l-1.912-5.813a2 2 0 00-1.275-1.275L3 12l5.813-1.912a2 2 0 001.275-1.275L12 3z" />
    </svg>
  );
}

function CancelIcon() {
  return (
    <svg
      class="w-3.5 h-3.5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="15" y1="9" x2="9" y2="15" />
      <line x1="9" y1="9" x2="15" y2="15" />
    </svg>
  );
}
