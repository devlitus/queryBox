/**
 * Types for the server-side proxy endpoint.
 * The proxy eliminates CORS restrictions by forwarding client requests
 * server-to-server to external APIs.
 */

/** Request payload sent from the client to /api/proxy */
export interface ProxyRequest {
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: string;
  timeout?: number;
}

/** Successful response from the proxy wrapping the external API's response */
export interface ProxySuccessResponse {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: string;
  contentType: string;
}

/** Error response from the proxy itself */
export interface ProxyErrorResponse {
  error: string;
  message: string;
  retryAfter?: number;
}
