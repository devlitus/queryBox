export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export interface KeyValuePair {
  id: string;        // unique ID for list rendering keys
  key: string;
  value: string;
  description?: string;
  enabled: boolean;
}

export type BodyMode = "none" | "raw";
export type ContentType = "json" | "text" | "xml" | "html";

export interface RequestState {
  method: HttpMethod;
  url: string;
  params: KeyValuePair[];
  headers: KeyValuePair[];
  body: {
    mode: BodyMode;
    contentType: ContentType;
    raw: string;
  };
  auth: import("./auth").AuthConfig;
}

export interface ResponseState {
  status: number;
  statusText: string;
  headers: Array<{ key: string; value: string }>;
  body: string;
  contentType: string;
  time: number;    // ms
  size: number;    // bytes
}

export type RequestStatus = "idle" | "loading" | "success" | "error";

export interface HttpError {
  message: string;
  type: "network" | "cors" | "timeout" | "abort" | "unknown";
}

export interface Tab {
  id: string;                    // crypto.randomUUID()
  name: string;                  // Display name, default "New Request"
  request: RequestState;         // Full request state for this tab
  response: ResponseState | null;
  requestStatus: RequestStatus;
  requestError: HttpError | null;
  isDirty: boolean;              // Whether the tab has unsaved modifications
}
