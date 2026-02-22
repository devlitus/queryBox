export type DiagnosisStatus =
  | "idle"
  | "previewing"
  | "loading"
  | "streaming"
  | "done"
  | "error";

export interface DiagnosisResult {
  content: string;
  timestamp: number;
  model: string;
}

export interface DiagnosisError {
  message: string;
  type: "rate-limit" | "network" | "server" | "unknown";
  retryAfter?: number; // seconds until retry is allowed
}

export interface DiagnosisContext {
  method: string;
  url: string; // sanitized — without sensitive query params
  statusCode: number | null;
  statusText: string;
  errorType: string; // from HttpError.type
  errorMessage: string;
  responseBodyExcerpt: string; // first 2000 chars
  requestHeaders: Array<{ key: string; value: string }>; // filtered
  responseHeaders: Array<{ key: string; value: string }>;
  requestBodyExcerpt: string; // first 1000 chars, without secrets
  contentType: string;
}

export type DiagnosisApiRequest = DiagnosisContext;

export interface DiagnosisApiError {
  error: string;
  message: string;
  retryAfter?: number; // seconds
}

export interface RateLimitInfo {
  remaining: number;
  resetIn: number; // milliseconds
}

export interface TabDiagnosisState {
  status: DiagnosisStatus;
  result: DiagnosisResult | null;
  error: DiagnosisError | null;
  context: DiagnosisContext | null;
  rateLimitInfo: RateLimitInfo | null;
}
