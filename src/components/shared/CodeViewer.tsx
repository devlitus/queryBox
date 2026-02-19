import { useMemo } from "preact/hooks";

interface Props {
  code: string;
  language: "json" | "javascript" | "text";
}

/**
 * Escapes HTML special characters to prevent XSS when inserting
 * API response content into the DOM via dangerouslySetInnerHTML.
 */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Applies basic regex-based syntax highlighting for JSON.
 * HTML is escaped first so that API response content cannot inject
 * arbitrary markup or script tags via dangerouslySetInnerHTML.
 */
function highlightJson(jsonString: string): string {
  // Always escape HTML entities before applying highlighting regex patterns.
  const escaped = escapeHtml(jsonString);
  try {
    return escaped
      // Keys (property names)
      .replace(/"([^"]+)"(\s*:)/g, '<span class="text-pm-syntax-key">"$1"</span>$2')
      // String values
      .replace(/:\s*"([^"]*)"/g, ': <span class="text-pm-syntax-string">"$1"</span>')
      // Numbers
      .replace(/:\s*(-?\d+\.?\d*)/g, ': <span class="text-pm-syntax-number">$1</span>')
      // Booleans
      .replace(/:\s*(true|false)/g, ': <span class="text-pm-syntax-boolean">$1</span>')
      // Null
      .replace(/:\s*(null)/g, ': <span class="text-pm-syntax-null">$1</span>');
  } catch {
    return escaped;
  }
}

export default function CodeViewer({ code, language }: Props) {
  const highlighted = useMemo(() => {
    if (language === "json") return highlightJson(code);
    // Escape all non-JSON content to prevent XSS from raw API responses.
    return escapeHtml(code);
  }, [code, language]);

  return (
    <div class="bg-pm-bg-tertiary rounded overflow-x-auto font-pm-mono text-sm">
      <pre class="p-4"><code dangerouslySetInnerHTML={{ __html: highlighted }} /></pre>
    </div>
  );
}
