import type { Collection } from "../types/persistence";
import type { Environment } from "../types/environment";
import type { CollectionExport, EnvironmentExport, ExportFile } from "../types/export";
import { isCollection, isEnvironment } from "../services/storage";

// ---------------------------------------------------------------------------
// Export builders
// ---------------------------------------------------------------------------

/**
 * Constructs the export envelope for a set of collections.
 */
export function exportCollections(collections: Collection[]): CollectionExport {
  return {
    format: "querybox",
    version: 1,
    exportedAt: Date.now(),
    type: "collections",
    data: collections,
  };
}

/**
 * Constructs the export envelope for a set of environments.
 */
export function exportEnvironments(environments: Environment[]): EnvironmentExport {
  return {
    format: "querybox",
    version: 1,
    exportedAt: Date.now(),
    type: "environments",
    data: environments,
  };
}

// ---------------------------------------------------------------------------
// Browser download helper
// ---------------------------------------------------------------------------

/**
 * Triggers a browser file download for a JSON export.
 * Creates a Blob, builds a temporary Object URL, clicks a hidden anchor,
 * then revokes the URL to free memory.
 */
export function downloadJson(data: ExportFile, filename: string): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------------------
// Import parser
// ---------------------------------------------------------------------------

/**
 * Parses and validates an import file's text content.
 *
 * Validates the envelope structure first (fail-fast), then filters each item
 * in the data array using the appropriate type guard — items that fail the
 * guard are silently dropped (permissive import: import what you can).
 *
 * @throws {Error} with a descriptive message if the envelope is structurally invalid.
 */
export function parseImportFile(text: string): ExportFile {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("Invalid JSON: the file could not be parsed.");
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error("Invalid format: file must be a JSON object.");
  }

  const obj = parsed as Record<string, unknown>;

  if (obj["format"] !== "querybox") {
    throw new Error(
      `Invalid format: expected "querybox" but got "${String(obj["format"])}".`
    );
  }

  if (obj["version"] !== 1) {
    throw new Error(
      `Unsupported version: expected 1 but got "${String(obj["version"])}".`
    );
  }

  if (obj["type"] !== "collections" && obj["type"] !== "environments") {
    throw new Error(
      `Invalid type: expected "collections" or "environments" but got "${String(obj["type"])}".`
    );
  }

  if (!Array.isArray(obj["data"])) {
    throw new Error('Invalid format: "data" must be an array.');
  }

  const type = obj["type"] as "collections" | "environments";
  const rawData = obj["data"] as unknown[];

  if (type === "collections") {
    const validItems = rawData.filter(isCollection);
    return {
      format: "querybox",
      version: 1,
      exportedAt: typeof obj["exportedAt"] === "number" ? obj["exportedAt"] : Date.now(),
      type: "collections",
      data: validItems,
    };
  } else {
    const validItems = rawData.filter(isEnvironment);
    return {
      format: "querybox",
      version: 1,
      exportedAt: typeof obj["exportedAt"] === "number" ? obj["exportedAt"] : Date.now(),
      type: "environments",
      data: validItems,
    };
  }
}

// ---------------------------------------------------------------------------
// File reader helper
// ---------------------------------------------------------------------------

/**
 * Reads a File as text and returns a Promise with the file content.
 * Wraps the callback-based FileReader API into a Promise.
 */
export function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result;
      if (typeof result === "string") {
        resolve(result);
      } else {
        reject(new Error("Failed to read file as text."));
      }
    };
    reader.onerror = () => reject(new Error("FileReader error while reading file."));
    reader.readAsText(file);
  });
}
