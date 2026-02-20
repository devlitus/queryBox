import { describe, it, expect, beforeEach, vi } from "vitest";
import { makeRequestState, makeKeyValuePair } from "../test/factories";

// Mock StorageService to prevent real localStorage interaction from the
// module-level effect() that auto-persists workbench state on every change.
vi.mock("../services/storage", () => ({
  StorageService: {
    getWorkbenchState: () => null,
    setWorkbenchState: vi.fn(),
    getHistory: () => [],
    setHistory: vi.fn(),
    getCollections: () => [],
    setCollections: vi.fn(),
  },
}));

// Use dynamic import + vi.resetModules() to get a fresh module instance
// per test, resetting module-level mutable state (isUpdatingFromParams flag, signals).
let httpStore: typeof import("./http-store");

beforeEach(async () => {
  vi.resetModules();
  // Re-apply mock after resetModules
  vi.mock("../services/storage", () => ({
    StorageService: {
      getWorkbenchState: () => null,
      setWorkbenchState: vi.fn(),
      getHistory: () => [],
      setHistory: vi.fn(),
      getCollections: () => [],
      setCollections: vi.fn(),
    },
  }));
  httpStore = await import("./http-store");
});

// ---------------------------------------------------------------------------
// updateMethod
// ---------------------------------------------------------------------------

describe("updateMethod", () => {
  it("updates the method field of requestState signal", () => {
    httpStore.updateMethod("POST");
    expect(httpStore.requestState.value.method).toBe("POST");
  });

  it("preserves other fields when updating method", () => {
    httpStore.updateUrl("https://api.example.com");
    httpStore.updateMethod("DELETE");
    expect(httpStore.requestState.value.url).toBe("https://api.example.com");
    expect(httpStore.requestState.value.method).toBe("DELETE");
  });
});

// ---------------------------------------------------------------------------
// updateUrl
// ---------------------------------------------------------------------------

describe("updateUrl", () => {
  it("updates the url field", () => {
    httpStore.updateUrl("https://new.example.com");
    expect(httpStore.requestState.value.url).toBe("https://new.example.com");
  });

  it("parses query params from the new URL", () => {
    httpStore.updateUrl("https://api.example.com?foo=bar&baz=qux");
    const params = httpStore.requestState.value.params;
    expect(params).toHaveLength(2);
    expect(params[0]).toMatchObject({ key: "foo", value: "bar", enabled: true });
    expect(params[1]).toMatchObject({ key: "baz", value: "qux", enabled: true });
  });

  it("replaces params signal with parsed params", () => {
    // First add a param manually to ensure replacement (not merge)
    httpStore.addParam();
    httpStore.updateUrl("https://api.example.com?only=this");
    expect(httpStore.requestState.value.params).toHaveLength(1);
    expect(httpStore.requestState.value.params[0]).toMatchObject({ key: "only", value: "this" });
  });

  it("sets params to empty array when URL has no query params", () => {
    httpStore.updateUrl("https://api.example.com?foo=bar");
    httpStore.updateUrl("https://api.example.com");
    expect(httpStore.requestState.value.params).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// addParam / updateParam / removeParam / toggleParam
// ---------------------------------------------------------------------------

describe("addParam", () => {
  it("appends a new empty KeyValuePair", () => {
    httpStore.addParam();
    const params = httpStore.requestState.value.params;
    expect(params).toHaveLength(1);
    expect(params[0]).toMatchObject({ key: "", value: "", enabled: true });
    expect(typeof params[0].id).toBe("string");
    expect(params[0].id.length).toBeGreaterThan(0);
  });

  it("appends multiple params", () => {
    httpStore.addParam();
    httpStore.addParam();
    expect(httpStore.requestState.value.params).toHaveLength(2);
  });
});

describe("updateParam", () => {
  it("updates the specified field of the matching param", () => {
    httpStore.addParam();
    const id = httpStore.requestState.value.params[0].id;
    httpStore.updateParam(id, "key", "myKey");
    expect(httpStore.requestState.value.params[0].key).toBe("myKey");
  });

  it("syncs URL when param key or value changes", () => {
    httpStore.updateUrl("https://api.example.com");
    httpStore.addParam();
    const id = httpStore.requestState.value.params[0].id;
    httpStore.updateParam(id, "key", "search");
    httpStore.updateParam(id, "value", "test");
    expect(httpStore.requestState.value.url).toContain("search=test");
  });

  it("does not affect other params", () => {
    httpStore.addParam();
    httpStore.addParam();
    const [p1, p2] = httpStore.requestState.value.params;
    httpStore.updateParam(p1.id, "key", "first");
    expect(httpStore.requestState.value.params[1].id).toBe(p2.id);
    expect(httpStore.requestState.value.params[1].key).toBe("");
  });
});

describe("removeParam", () => {
  it("removes param by id", () => {
    httpStore.addParam();
    const id = httpStore.requestState.value.params[0].id;
    httpStore.removeParam(id);
    expect(httpStore.requestState.value.params).toHaveLength(0);
  });

  it("syncs URL after removal", () => {
    httpStore.updateUrl("https://api.example.com?foo=bar");
    const id = httpStore.requestState.value.params[0].id;
    httpStore.removeParam(id);
    expect(httpStore.requestState.value.url).not.toContain("foo=bar");
  });

  it("does not affect other params", () => {
    httpStore.addParam();
    httpStore.addParam();
    const [p1, p2] = httpStore.requestState.value.params;
    httpStore.removeParam(p1.id);
    expect(httpStore.requestState.value.params).toHaveLength(1);
    expect(httpStore.requestState.value.params[0].id).toBe(p2.id);
  });
});

describe("toggleParam", () => {
  it("flips enabled state from true to false", () => {
    httpStore.addParam();
    const id = httpStore.requestState.value.params[0].id;
    expect(httpStore.requestState.value.params[0].enabled).toBe(true);
    httpStore.toggleParam(id);
    expect(httpStore.requestState.value.params[0].enabled).toBe(false);
  });

  it("flips enabled state from false to true", () => {
    httpStore.addParam();
    const id = httpStore.requestState.value.params[0].id;
    httpStore.toggleParam(id); // true -> false
    httpStore.toggleParam(id); // false -> true
    expect(httpStore.requestState.value.params[0].enabled).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// addHeader / updateHeader / removeHeader / toggleHeader
// ---------------------------------------------------------------------------

describe("addHeader", () => {
  it("appends a new empty KeyValuePair to headers", () => {
    httpStore.addHeader();
    const headers = httpStore.requestState.value.headers;
    expect(headers).toHaveLength(1);
    expect(headers[0]).toMatchObject({ key: "", value: "", enabled: true });
    expect(typeof headers[0].id).toBe("string");
  });
});

describe("updateHeader", () => {
  it("updates the specified field of the matching header", () => {
    httpStore.addHeader();
    const id = httpStore.requestState.value.headers[0].id;
    httpStore.updateHeader(id, "key", "Authorization");
    expect(httpStore.requestState.value.headers[0].key).toBe("Authorization");
  });

  it("does not sync URL when header changes (headers are independent of URL)", () => {
    httpStore.updateUrl("https://api.example.com");
    const urlBefore = httpStore.requestState.value.url;
    httpStore.addHeader();
    const id = httpStore.requestState.value.headers[0].id;
    httpStore.updateHeader(id, "key", "X-Custom-Header");
    expect(httpStore.requestState.value.url).toBe(urlBefore);
  });
});

describe("removeHeader", () => {
  it("removes header by id", () => {
    httpStore.addHeader();
    const id = httpStore.requestState.value.headers[0].id;
    httpStore.removeHeader(id);
    expect(httpStore.requestState.value.headers).toHaveLength(0);
  });

  it("does not affect params when removing a header", () => {
    httpStore.addParam();
    httpStore.addHeader();
    const headerId = httpStore.requestState.value.headers[0].id;
    httpStore.removeHeader(headerId);
    expect(httpStore.requestState.value.params).toHaveLength(1);
  });
});

describe("toggleHeader", () => {
  it("flips enabled state from true to false", () => {
    httpStore.addHeader();
    const id = httpStore.requestState.value.headers[0].id;
    httpStore.toggleHeader(id);
    expect(httpStore.requestState.value.headers[0].enabled).toBe(false);
  });

  it("flips enabled state from false to true", () => {
    httpStore.addHeader();
    const id = httpStore.requestState.value.headers[0].id;
    httpStore.toggleHeader(id); // -> false
    httpStore.toggleHeader(id); // -> true
    expect(httpStore.requestState.value.headers[0].enabled).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// updateBodyMode / updateBodyContentType / updateBodyRaw
// ---------------------------------------------------------------------------

describe("updateBodyMode", () => {
  it("updates the mode field in requestState.body", () => {
    httpStore.updateBodyMode("raw");
    expect(httpStore.requestState.value.body.mode).toBe("raw");
  });

  it("preserves other body fields when updating mode", () => {
    httpStore.updateBodyRaw("some content");
    httpStore.updateBodyMode("raw");
    expect(httpStore.requestState.value.body.raw).toBe("some content");
  });
});

describe("updateBodyContentType", () => {
  it("updates the contentType field in requestState.body", () => {
    httpStore.updateBodyContentType("xml");
    expect(httpStore.requestState.value.body.contentType).toBe("xml");
  });

  it("preserves other body fields when updating contentType", () => {
    httpStore.updateBodyMode("raw");
    httpStore.updateBodyContentType("text");
    expect(httpStore.requestState.value.body.mode).toBe("raw");
  });
});

describe("updateBodyRaw", () => {
  it("updates the raw field in requestState.body", () => {
    httpStore.updateBodyRaw('{"key":"value"}');
    expect(httpStore.requestState.value.body.raw).toBe('{"key":"value"}');
  });

  it("preserves other body fields when updating raw", () => {
    httpStore.updateBodyContentType("json");
    httpStore.updateBodyRaw("test body");
    expect(httpStore.requestState.value.body.contentType).toBe("json");
  });
});

// ---------------------------------------------------------------------------
// resetResponse
// ---------------------------------------------------------------------------

describe("resetResponse", () => {
  it("sets responseState to null", () => {
    httpStore.resetResponse();
    expect(httpStore.responseState.value).toBeNull();
  });

  it("sets requestStatus to 'idle'", () => {
    httpStore.resetResponse();
    expect(httpStore.requestStatus.value).toBe("idle");
  });

  it("sets requestError to null", () => {
    httpStore.resetResponse();
    expect(httpStore.requestError.value).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// enabledParams computed
// ---------------------------------------------------------------------------

describe("enabledParams computed", () => {
  it("returns empty array when there are no params", () => {
    expect(httpStore.enabledParams.value).toHaveLength(0);
  });

  it("returns only enabled params that have a non-empty key", () => {
    httpStore.addParam();
    const id1 = httpStore.requestState.value.params[0].id;
    httpStore.updateParam(id1, "key", "active");

    httpStore.addParam();
    const id2 = httpStore.requestState.value.params[1].id;
    httpStore.updateParam(id2, "key", "disabled-param");
    httpStore.toggleParam(id2); // disable it

    httpStore.addParam();
    // third param has empty key — should be excluded

    expect(httpStore.enabledParams.value).toHaveLength(1);
    expect(httpStore.enabledParams.value[0].key).toBe("active");
  });

  it("excludes params with empty key even if enabled", () => {
    httpStore.addParam(); // key = "", enabled = true by default
    expect(httpStore.enabledParams.value).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// enabledHeaders computed
// ---------------------------------------------------------------------------

describe("enabledHeaders computed", () => {
  it("returns empty array when there are no headers", () => {
    expect(httpStore.enabledHeaders.value).toHaveLength(0);
  });

  it("returns only enabled headers with non-empty key", () => {
    httpStore.addHeader();
    const id1 = httpStore.requestState.value.headers[0].id;
    httpStore.updateHeader(id1, "key", "Authorization");

    httpStore.addHeader();
    const id2 = httpStore.requestState.value.headers[1].id;
    httpStore.updateHeader(id2, "key", "X-Disabled");
    httpStore.toggleHeader(id2); // disable it

    httpStore.addHeader();
    // third header has empty key — should be excluded

    expect(httpStore.enabledHeaders.value).toHaveLength(1);
    expect(httpStore.enabledHeaders.value[0].key).toBe("Authorization");
  });
});

// ---------------------------------------------------------------------------
// formattedSize computed
// ---------------------------------------------------------------------------

describe("formattedSize computed", () => {
  it("returns empty string when responseState is null", () => {
    expect(httpStore.formattedSize.value).toBe("");
  });

  it("returns formatted size string when response has a size", () => {
    httpStore.responseState.value = {
      status: 200,
      statusText: "OK",
      headers: [],
      body: "",
      contentType: "application/json",
      time: 100,
      size: 2048,
    };
    expect(httpStore.formattedSize.value).toBe("2.00 KB");
  });
});

// ---------------------------------------------------------------------------
// statusColorClass computed
// ---------------------------------------------------------------------------

describe("statusColorClass computed", () => {
  it("returns default text class when responseState is null", () => {
    expect(httpStore.statusColorClass.value).toBe("text-pm-text-primary");
  });

  it("returns success class for 2xx status codes", () => {
    httpStore.responseState.value = {
      status: 200,
      statusText: "OK",
      headers: [],
      body: "",
      contentType: "application/json",
      time: 50,
      size: 0,
    };
    expect(httpStore.statusColorClass.value).toBe("text-pm-status-success");
  });

  it("returns success class for 201 Created", () => {
    httpStore.responseState.value = {
      status: 201,
      statusText: "Created",
      headers: [],
      body: "",
      contentType: "application/json",
      time: 50,
      size: 0,
    };
    expect(httpStore.statusColorClass.value).toBe("text-pm-status-success");
  });

  it("returns redirect class for 3xx status codes", () => {
    httpStore.responseState.value = {
      status: 301,
      statusText: "Moved Permanently",
      headers: [],
      body: "",
      contentType: "text/html",
      time: 30,
      size: 0,
    };
    expect(httpStore.statusColorClass.value).toBe("text-pm-status-redirect");
  });

  it("returns error class for 4xx status codes", () => {
    httpStore.responseState.value = {
      status: 404,
      statusText: "Not Found",
      headers: [],
      body: "",
      contentType: "application/json",
      time: 20,
      size: 0,
    };
    expect(httpStore.statusColorClass.value).toBe("text-pm-status-error");
  });

  it("returns error class for 5xx status codes", () => {
    httpStore.responseState.value = {
      status: 500,
      statusText: "Internal Server Error",
      headers: [],
      body: "",
      contentType: "application/json",
      time: 200,
      size: 0,
    };
    expect(httpStore.statusColorClass.value).toBe("text-pm-status-error");
  });
});

// ---------------------------------------------------------------------------
// loadRequest
// ---------------------------------------------------------------------------

describe("loadRequest", () => {
  it("loads a snapshot into requestState", () => {
    const snapshot = makeRequestState({ url: "https://loaded.com", method: "PUT" });
    httpStore.loadRequest(snapshot);
    expect(httpStore.requestState.value.url).toBe("https://loaded.com");
    expect(httpStore.requestState.value.method).toBe("PUT");
  });

  it("regenerates all param IDs to avoid key collisions", () => {
    const snapshot = makeRequestState({
      params: [
        makeKeyValuePair({ id: "original-param-id", key: "q", value: "test" }),
      ],
    });
    httpStore.loadRequest(snapshot);
    const loadedParam = httpStore.requestState.value.params[0];
    expect(loadedParam.id).not.toBe("original-param-id");
    expect(typeof loadedParam.id).toBe("string");
    expect(loadedParam.id.length).toBeGreaterThan(0);
  });

  it("regenerates all header IDs to avoid key collisions", () => {
    const snapshot = makeRequestState({
      headers: [
        makeKeyValuePair({ id: "original-header-id", key: "Authorization", value: "Bearer token" }),
      ],
    });
    httpStore.loadRequest(snapshot);
    const loadedHeader = httpStore.requestState.value.headers[0];
    expect(loadedHeader.id).not.toBe("original-header-id");
    expect(typeof loadedHeader.id).toBe("string");
  });

  it("preserves param key/value content while regenerating IDs", () => {
    const snapshot = makeRequestState({
      params: [makeKeyValuePair({ id: "old-id", key: "page", value: "2" })],
    });
    httpStore.loadRequest(snapshot);
    const param = httpStore.requestState.value.params[0];
    expect(param.key).toBe("page");
    expect(param.value).toBe("2");
  });

  it("calls resetResponse (clears responseState, status, error)", () => {
    const snapshot = makeRequestState();
    httpStore.loadRequest(snapshot);
    expect(httpStore.responseState.value).toBeNull();
    expect(httpStore.requestStatus.value).toBe("idle");
    expect(httpStore.requestError.value).toBeNull();
  });
});
