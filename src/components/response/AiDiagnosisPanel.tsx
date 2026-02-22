import {
  diagnosisStatus,
  diagnosisResult,
  diagnosisError,
  diagnosisContext,
  rateLimitInfo,
  startDiagnosis,
  cancelDiagnosis,
  clearDiagnosis,
  previewDiagnosis,
} from "../../stores/ai-diagnosis-store";
import { renderMarkdownLite } from "../../utils/markdown-lite";

/**
 * Panel that displays AI diagnosis output: preview, streaming, done, and error states.
 * Only renders when diagnosisStatus !== "idle".
 */
export default function AiDiagnosisPanel() {
  const status = diagnosisStatus.value;

  if (status === "idle") return null;

  return (
    <div
      class="border-t border-pm-border bg-pm-bg-secondary"
      role="region"
      aria-label="AI Diagnosis"
    >
      {status === "previewing" && <PreviewState />}
      {status === "loading" && <LoadingState />}
      {status === "streaming" && <StreamingState />}
      {status === "done" && <DoneState />}
      {status === "error" && <ErrorState />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-states
// ---------------------------------------------------------------------------

function PreviewState() {
  const context = diagnosisContext.value;

  return (
    <div class="p-4 max-h-64 overflow-y-auto">
      <div class="flex items-start gap-2 mb-3">
        <WarningIcon />
        <p class="text-xs text-pm-text-secondary leading-relaxed">
          Los siguientes datos se enviarán a la API de Groq para análisis.
          Revisa que no contengan información sensible.
        </p>
      </div>

      <pre class="bg-pm-bg-tertiary rounded p-3 text-xs font-pm-mono overflow-x-auto max-h-40 overflow-y-auto mb-3">
        <code>{JSON.stringify(context, null, 2)}</code>
      </pre>

      <div class="flex items-center gap-2">
        <button
          type="button"
          onClick={() => startDiagnosis()}
          class="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded
                 bg-pm-accent text-white hover:bg-pm-accent/90 transition-colors"
        >
          Enviar a Groq
        </button>
        <button
          type="button"
          onClick={() => cancelDiagnosis()}
          class="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded
                 bg-pm-bg-tertiary text-pm-text-secondary hover:text-pm-text-primary
                 transition-colors"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}

function LoadingState() {
  return (
    <div class="p-4 flex items-center gap-3" role="status" aria-live="polite">
      <div
        class="w-4 h-4 border-2 border-pm-border border-t-pm-accent rounded-full animate-spin"
        aria-hidden="true"
      />
      <span class="text-xs text-pm-text-secondary">
        Conectando con Groq AI...
      </span>
      <button
        type="button"
        onClick={() => cancelDiagnosis()}
        class="ml-auto text-xs text-pm-text-tertiary hover:text-pm-text-secondary transition-colors"
      >
        Cancelar
      </button>
    </div>
  );
}

function StreamingState() {
  const result = diagnosisResult.value;

  return (
    <div class="p-4 max-h-80 overflow-y-auto" aria-live="polite">
      <div class="flex items-center justify-between mb-2">
        <span class="text-xs text-pm-text-tertiary flex items-center gap-1.5">
          <div
            class="w-2 h-2 bg-pm-accent rounded-full animate-pulse"
            aria-hidden="true"
          />
          Generando diagnóstico...
        </span>
        <button
          type="button"
          onClick={() => cancelDiagnosis()}
          class="text-xs text-pm-text-tertiary hover:text-pm-text-secondary transition-colors"
        >
          Cancelar
        </button>
      </div>

      {result && (
        <div
          class="text-pm-text-primary"
          dangerouslySetInnerHTML={{
            __html: renderMarkdownLite(result.content),
          }}
        />
      )}
    </div>
  );
}

function DoneState() {
  const result = diagnosisResult.value;

  return (
    <div class="p-4 max-h-80 overflow-y-auto">
      <div class="flex items-center justify-between mb-2">
        <span class="text-xs text-pm-text-tertiary">
          {result
            ? `Modelo: ${result.model} · ${new Date(result.timestamp).toLocaleTimeString()}`
            : "Diagnóstico completo"}
        </span>
        <div class="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              clearDiagnosis();
              previewDiagnosis();
            }}
            class="text-xs text-pm-accent hover:text-pm-accent/80 transition-colors"
          >
            Diagnosticar de nuevo
          </button>
          <button
            type="button"
            onClick={() => clearDiagnosis()}
            class="text-xs text-pm-text-tertiary hover:text-pm-text-secondary transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>

      {result && (
        <div
          class="text-pm-text-primary"
          dangerouslySetInnerHTML={{
            __html: renderMarkdownLite(result.content),
          }}
        />
      )}
    </div>
  );
}

function ErrorState() {
  const error = diagnosisError.value;
  const rateLimit = rateLimitInfo.value;

  const isRateLimited = error?.type === "rate-limit";

  return (
    <div class="p-4">
      <div class="flex items-start gap-2 mb-3">
        <ErrorIcon />
        <div>
          <p class="text-xs text-pm-status-error font-medium mb-1">
            {isRateLimited
              ? "Límite de solicitudes alcanzado"
              : error?.type === "server"
              ? "Servicio de AI no disponible"
              : "Error al obtener diagnóstico"}
          </p>
          <p class="text-xs text-pm-text-secondary">
            {error?.message ?? "Error desconocido"}
          </p>
          {isRateLimited && rateLimit && (
            <p class="text-xs text-pm-text-tertiary mt-1">
              Intenta de nuevo en {Math.ceil(rateLimit.resetIn / 1000)}s
            </p>
          )}
          {error?.type === "server" && (
            <p class="text-xs text-pm-text-tertiary mt-1">
              El servicio de AI no está disponible. Intenta más tarde.
            </p>
          )}
        </div>
      </div>

      <div class="flex items-center gap-2">
        {!isRateLimited && (
          <button
            type="button"
            onClick={() => startDiagnosis()}
            class="text-xs text-pm-accent hover:text-pm-accent/80 transition-colors"
          >
            Reintentar
          </button>
        )}
        <button
          type="button"
          onClick={() => clearDiagnosis()}
          class="text-xs text-pm-text-tertiary hover:text-pm-text-secondary transition-colors"
        >
          Cerrar
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Icons
// ---------------------------------------------------------------------------

function WarningIcon() {
  return (
    <svg
      class="w-4 h-4 text-pm-status-redirect shrink-0 mt-0.5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

function ErrorIcon() {
  return (
    <svg
      class="w-4 h-4 text-pm-status-error shrink-0 mt-0.5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}
