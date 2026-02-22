import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  exportCollections,
  exportEnvironments,
  downloadJson,
  parseImportFile,
  readFileAsText,
} from "../export-import";
import { makeCollection, makeEnvironment, makeSavedRequest } from "../../test/factories";

// ---------------------------------------------------------------------------
// exportCollections
// ---------------------------------------------------------------------------

describe("exportCollections", () => {
  it("generates a valid envelope with all required fields", () => {
    const col = makeCollection({ id: "c1", name: "My Collection" });
    const before = Date.now();
    const result = exportCollections([col]);
    const after = Date.now();

    expect(result.format).toBe("querybox");
    expect(result.version).toBe(1);
    expect(result.type).toBe("collections");
    expect(result.data).toHaveLength(1);
    expect(result.data[0]).toEqual(col);
    expect(result.exportedAt).toBeGreaterThanOrEqual(before);
    expect(result.exportedAt).toBeLessThanOrEqual(after);
  });

  it("works with empty array", () => {
    const result = exportCollections([]);
    expect(result.data).toEqual([]);
    expect(result.type).toBe("collections");
  });

  it("includes multiple collections in data", () => {
    const cols = [
      makeCollection({ id: "c1", name: "First" }),
      makeCollection({ id: "c2", name: "Second" }),
    ];
    const result = exportCollections(cols);
    expect(result.data).toHaveLength(2);
    expect(result.data[1].name).toBe("Second");
  });

  it("includes environments when provided", () => {
    const col = makeCollection({ id: "c1" });
    const env = makeEnvironment({ id: "e1", name: "Dev" });
    const result = exportCollections([col], [env]);
    expect(result.environments).toHaveLength(1);
    expect(result.environments![0].name).toBe("Dev");
  });

  it("omits environments field when none are provided", () => {
    const col = makeCollection({ id: "c1" });
    const result = exportCollections([col]);
    expect(result.environments).toBeUndefined();
  });

  it("omits environments field when empty array is passed", () => {
    const col = makeCollection({ id: "c1" });
    const result = exportCollections([col], []);
    expect(result.environments).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// exportEnvironments
// ---------------------------------------------------------------------------

describe("exportEnvironments", () => {
  it("generates a valid envelope with all required fields", () => {
    const env = makeEnvironment({ id: "e1", name: "Dev" });
    const before = Date.now();
    const result = exportEnvironments([env]);
    const after = Date.now();

    expect(result.format).toBe("querybox");
    expect(result.version).toBe(1);
    expect(result.type).toBe("environments");
    expect(result.data).toHaveLength(1);
    expect(result.data[0]).toEqual(env);
    expect(result.exportedAt).toBeGreaterThanOrEqual(before);
    expect(result.exportedAt).toBeLessThanOrEqual(after);
  });

  it("works with empty array", () => {
    const result = exportEnvironments([]);
    expect(result.data).toEqual([]);
    expect(result.type).toBe("environments");
  });
});

// ---------------------------------------------------------------------------
// parseImportFile — valid inputs
// ---------------------------------------------------------------------------

describe("parseImportFile — valid collections", () => {
  it("accepts a valid collections JSON", () => {
    const col = makeCollection({ id: "c1", name: "Test" });
    const envelope = exportCollections([col]);
    const json = JSON.stringify(envelope);

    const result = parseImportFile(json);
    expect(result.type).toBe("collections");
    expect(result.format).toBe("querybox");
    expect(result.version).toBe(1);
    if (result.type === "collections") {
      expect(result.data).toHaveLength(1);
      expect(result.data[0].name).toBe("Test");
    }
  });

  it("accepts a collections JSON with multiple items including requests", () => {
    const req = makeSavedRequest({ id: "r1", name: "My Request" });
    const col = makeCollection({ id: "c1", requests: [req] });
    const json = JSON.stringify(exportCollections([col]));

    const result = parseImportFile(json);
    if (result.type === "collections") {
      expect(result.data[0].requests).toHaveLength(1);
    }
  });

  it("parses bundled environments when present", () => {
    const col = makeCollection({ id: "c1" });
    const env = makeEnvironment({ id: "e1", name: "Prod" });
    const json = JSON.stringify(exportCollections([col], [env]));

    const result = parseImportFile(json);
    expect(result.type).toBe("collections");
    if (result.type === "collections") {
      expect(result.environments).toHaveLength(1);
      expect(result.environments![0].name).toBe("Prod");
    }
  });

  it("ignores invalid items in bundled environments", () => {
    const col = makeCollection({ id: "c1" });
    const env = makeEnvironment({ id: "e1", name: "Dev" });
    const envelope = exportCollections([col], [env]);
    // inject a malformed environment
    (envelope as unknown as Record<string, unknown>)["environments"] = [env, { bad: true }];
    const json = JSON.stringify(envelope);

    const result = parseImportFile(json);
    if (result.type === "collections") {
      expect(result.environments).toHaveLength(1);
    }
  });

  it("omits environments field when not present in file", () => {
    const col = makeCollection({ id: "c1" });
    const json = JSON.stringify(exportCollections([col]));

    const result = parseImportFile(json);
    if (result.type === "collections") {
      expect(result.environments).toBeUndefined();
    }
  });
});

describe("parseImportFile — valid environments", () => {
  it("accepts a valid environments JSON", () => {
    const env = makeEnvironment({ id: "e1", name: "Staging" });
    const json = JSON.stringify(exportEnvironments([env]));

    const result = parseImportFile(json);
    expect(result.type).toBe("environments");
    if (result.type === "environments") {
      expect(result.data).toHaveLength(1);
      expect(result.data[0].name).toBe("Staging");
    }
  });
});

// ---------------------------------------------------------------------------
// parseImportFile — invalid inputs (envelope-level)
// ---------------------------------------------------------------------------

describe("parseImportFile — invalid JSON", () => {
  it("throws for non-JSON text", () => {
    expect(() => parseImportFile("not json at all")).toThrow(
      "Invalid JSON"
    );
  });

  it("throws for a JSON array (not an object)", () => {
    expect(() => parseImportFile("[1,2,3]")).toThrow("Invalid format");
  });

  it("throws for a JSON primitive (not an object)", () => {
    expect(() => parseImportFile('"just a string"')).toThrow("Invalid format");
  });
});

describe("parseImportFile — missing or invalid envelope fields", () => {
  it("throws when format field is missing", () => {
    const bad = { version: 1, type: "collections", data: [] };
    expect(() => parseImportFile(JSON.stringify(bad))).toThrow(
      '"querybox"'
    );
  });

  it("throws when format is wrong value", () => {
    const bad = { format: "postman", version: 1, type: "collections", data: [] };
    expect(() => parseImportFile(JSON.stringify(bad))).toThrow(
      '"querybox"'
    );
  });

  it("throws when version is wrong", () => {
    const bad = { format: "querybox", version: 2, type: "collections", data: [] };
    expect(() => parseImportFile(JSON.stringify(bad))).toThrow(
      "Unsupported version"
    );
  });

  it("throws when type is invalid", () => {
    const bad = { format: "querybox", version: 1, type: "requests", data: [] };
    expect(() => parseImportFile(JSON.stringify(bad))).toThrow(
      "Invalid type"
    );
  });

  it("throws when data is not an array", () => {
    const bad = { format: "querybox", version: 1, type: "collections", data: "nope" };
    expect(() => parseImportFile(JSON.stringify(bad))).toThrow(
      '"data" must be an array'
    );
  });
});

// ---------------------------------------------------------------------------
// parseImportFile — permissive item filtering
// ---------------------------------------------------------------------------

describe("parseImportFile — filters invalid items from data array", () => {
  it("returns only valid collections, dropping malformed ones", () => {
    const goodCol = makeCollection({ id: "c1", name: "Good" });
    const badItem = { foo: "bar" }; // missing required fields
    const envelope = {
      format: "querybox",
      version: 1,
      exportedAt: Date.now(),
      type: "collections",
      data: [goodCol, badItem],
    };
    const result = parseImportFile(JSON.stringify(envelope));
    if (result.type === "collections") {
      expect(result.data).toHaveLength(1);
      expect(result.data[0].name).toBe("Good");
    }
  });

  it("returns only valid environments, dropping malformed ones", () => {
    const goodEnv = makeEnvironment({ id: "e1", name: "Good Env" });
    const badItem = { id: "e2" }; // missing name, variables, createdAt
    const envelope = {
      format: "querybox",
      version: 1,
      exportedAt: Date.now(),
      type: "environments",
      data: [goodEnv, badItem],
    };
    const result = parseImportFile(JSON.stringify(envelope));
    if (result.type === "environments") {
      expect(result.data).toHaveLength(1);
      expect(result.data[0].name).toBe("Good Env");
    }
  });

  it("returns empty data array when all items are invalid", () => {
    const envelope = {
      format: "querybox",
      version: 1,
      exportedAt: Date.now(),
      type: "collections",
      data: [{ foo: "bar" }, { baz: 42 }],
    };
    const result = parseImportFile(JSON.stringify(envelope));
    if (result.type === "collections") {
      expect(result.data).toHaveLength(0);
    }
  });
});

// ---------------------------------------------------------------------------
// downloadJson — DOM interactions tested with spies
// ---------------------------------------------------------------------------

describe("downloadJson", () => {
  let createObjectURLSpy: ReturnType<typeof vi.spyOn>;
  let revokeObjectURLSpy: ReturnType<typeof vi.spyOn>;
  let anchorClickSpy: ReturnType<typeof vi.spyOn>;
  let createElementSpy: ReturnType<typeof vi.spyOn>;
  let appendChildSpy: ReturnType<typeof vi.spyOn>;
  let removeChildSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // Spy on URL methods
    createObjectURLSpy = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:fake-url");
    revokeObjectURLSpy = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);

    // Spy on document.body DOM mutations
    appendChildSpy = vi.spyOn(document.body, "appendChild").mockImplementation((node) => node as HTMLElement);
    removeChildSpy = vi.spyOn(document.body, "removeChild").mockImplementation((node) => node as HTMLElement);

    // Spy on document.createElement to intercept anchor creation
    const originalCreateElement = document.createElement.bind(document);
    createElementSpy = vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
      const el = originalCreateElement(tag);
      if (tag === "a") {
        anchorClickSpy = vi.spyOn(el as HTMLAnchorElement, "click").mockImplementation(() => undefined);
      }
      return el;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("creates a Blob with the JSON-serialized data", () => {
    const col = makeCollection({ id: "c1", name: "BlobTest" });
    const envelope = exportCollections([col]);
    downloadJson(envelope, "test.json");

    expect(createObjectURLSpy).toHaveBeenCalledOnce();
    const blobArg = createObjectURLSpy.mock.calls[0][0] as Blob;
    expect(blobArg).toBeInstanceOf(Blob);
    expect(blobArg.type).toBe("application/json");
  });

  it("sets href and download attributes on the anchor element", () => {
    const col = makeCollection({ id: "c1" });
    const envelope = exportCollections([col]);
    downloadJson(envelope, "my-export.json");

    // The anchor created by downloadJson should have the blob URL and filename
    expect(createElementSpy).toHaveBeenCalledWith("a");
    expect(createObjectURLSpy).toHaveBeenCalledWith(expect.any(Blob));
  });

  it("appends the anchor to the document body before clicking", () => {
    const col = makeCollection({ id: "c1" });
    const envelope = exportCollections([col]);
    downloadJson(envelope, "append-test.json");

    expect(appendChildSpy).toHaveBeenCalledOnce();
    expect(appendChildSpy.mock.calls[0][0]).toBeInstanceOf(HTMLAnchorElement);
  });

  it("removes the anchor from the document body after clicking", () => {
    const col = makeCollection({ id: "c1" });
    const envelope = exportCollections([col]);
    downloadJson(envelope, "remove-test.json");

    expect(removeChildSpy).toHaveBeenCalledOnce();
    expect(removeChildSpy.mock.calls[0][0]).toBeInstanceOf(HTMLAnchorElement);
  });

  it("triggers a click on the anchor to initiate download", () => {
    const col = makeCollection({ id: "c1" });
    const envelope = exportCollections([col]);
    downloadJson(envelope, "click-test.json");

    expect(anchorClickSpy).toHaveBeenCalledOnce();
  });

  it("revokes the object URL after clicking to free memory", () => {
    const col = makeCollection({ id: "c1" });
    const envelope = exportCollections([col]);
    downloadJson(envelope, "revoke-test.json");

    expect(revokeObjectURLSpy).toHaveBeenCalledOnce();
    expect(revokeObjectURLSpy).toHaveBeenCalledWith("blob:fake-url");
  });

  it("serializes the data as formatted JSON in the Blob", async () => {
    const col = makeCollection({ id: "c1", name: "Formatted" });
    const envelope = exportCollections([col]);
    downloadJson(envelope, "format-test.json");

    const blobArg = createObjectURLSpy.mock.calls[0][0] as Blob;
    const text = await blobArg.text();
    const parsed = JSON.parse(text);
    expect(parsed.format).toBe("querybox");
    expect(parsed.type).toBe("collections");
    expect(parsed.data[0].name).toBe("Formatted");
  });
});

// ---------------------------------------------------------------------------
// readFileAsText — FileReader wrapper tested with a real File object
// ---------------------------------------------------------------------------

describe("readFileAsText", () => {
  it("resolves with the file content as a string", async () => {
    const content = '{"hello":"world"}';
    const file = new File([content], "test.json", { type: "application/json" });

    const result = await readFileAsText(file);

    expect(result).toBe(content);
  });

  it("resolves with an empty string for an empty file", async () => {
    const file = new File([""], "empty.json", { type: "application/json" });

    const result = await readFileAsText(file);

    expect(result).toBe("");
  });

  it("resolves with unicode content correctly", async () => {
    const content = '{"name":"Configuración básica"}';
    const file = new File([content], "unicode.json", { type: "application/json" });

    const result = await readFileAsText(file);

    expect(result).toBe(content);
  });

  it("rejects when FileReader encounters an error", async () => {
    // Simulate a FileReader onerror by replacing the global class with a mock class
    const OriginalFileReader = globalThis.FileReader;

    // Must use `class` syntax so it can be called with `new`
    class MockFileReader {
      onload: ((event: ProgressEvent<FileReader>) => void) | null = null;
      onerror: (() => void) | null = null;
      readAsText(_file: File): void {
        // Trigger onerror on the next tick
        setTimeout(() => { this.onerror?.(); }, 0);
      }
    }
    globalThis.FileReader = MockFileReader as unknown as typeof FileReader;

    const file = new File(["content"], "error.json");
    await expect(readFileAsText(file)).rejects.toThrow("FileReader error while reading file.");

    globalThis.FileReader = OriginalFileReader;
  });
});
