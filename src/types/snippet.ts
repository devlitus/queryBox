/**
 * Supported snippet generation targets.
 * Each value is a unique, descriptive ID for the language/tool.
 * Extensible: adding a new language = adding a value here + a function in snippet-generators.ts.
 */
export type SnippetLanguage =
  | "curl"
  | "javascript-fetch"
  | "python-requests"
  | "nodejs-axios";

/**
 * Metadata for a single snippet language option.
 * - id: the SnippetLanguage discriminant used in switches and maps
 * - label: human-readable display name for the UI
 * - language: syntax highlighting language hint (for future use)
 */
export interface SnippetOption {
  id: SnippetLanguage;
  label: string;
  /** Syntax highlighting language identifier (bash, javascript, python) */
  language: "bash" | "javascript" | "python";
}

/**
 * Registry of all available snippet options, ordered by prevalence.
 * Consumed by CodeSnippetModal to render the language selector.
 */
export const SNIPPET_OPTIONS: readonly SnippetOption[] = [
  { id: "curl", label: "cURL", language: "bash" },
  { id: "javascript-fetch", label: "JavaScript - fetch", language: "javascript" },
  { id: "python-requests", label: "Python - requests", language: "python" },
  { id: "nodejs-axios", label: "Node.js - axios", language: "javascript" },
] as const;
