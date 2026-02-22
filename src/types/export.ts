import type { Collection } from "./persistence";
import type { Environment } from "./environment";

// ---------------------------------------------------------------------------
// Export envelope types
// ---------------------------------------------------------------------------

export interface ExportEnvelope<T extends "collections" | "environments"> {
  format: "querybox";
  version: 1;
  exportedAt: number;
  type: T;
  data: T extends "collections" ? Collection[] : Environment[];
}

export type CollectionExport = ExportEnvelope<"collections">;
export type EnvironmentExport = ExportEnvelope<"environments">;
export type ExportFile = CollectionExport | EnvironmentExport;

export type ImportStrategy = "merge" | "replace";
