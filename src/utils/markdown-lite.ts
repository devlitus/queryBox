/**
 * Lightweight markdown renderer for AI diagnosis output.
 * Renders a safe subset of markdown: paragraphs, code blocks, inline code,
 * bold, and lists. All text is HTML-escaped before processing to prevent XSS.
 *
 * @param text - Raw markdown text from the AI
 * @returns Safe HTML string ready for dangerouslySetInnerHTML
 */
export function renderMarkdownLite(text: string): string {
  if (!text) return "";

  // Split into blocks: code blocks vs. everything else
  const parts = splitCodeBlocks(text);

  return parts
    .map((part) => {
      if (part.type === "code") {
        return renderCodeBlock(part.content, part.language);
      }
      return renderTextBlock(part.content);
    })
    .join("");
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ContentPart {
  type: "text" | "code";
  content: string;
  language?: string;
}

// ---------------------------------------------------------------------------
// HTML escaping — MUST happen before any formatting
// ---------------------------------------------------------------------------

/** Escapes HTML special characters to prevent XSS. */
export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// ---------------------------------------------------------------------------
// Code blocks
// ---------------------------------------------------------------------------

/** Splits text into code blocks and text blocks. */
function splitCodeBlocks(text: string): ContentPart[] {
  const parts: ContentPart[] = [];
  const codeBlockRegex = /```(\w*)\n([\s\S]*?)```/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = codeBlockRegex.exec(text)) !== null) {
    // Text before the code block
    if (match.index > lastIndex) {
      parts.push({
        type: "text",
        content: text.substring(lastIndex, match.index),
      });
    }

    parts.push({
      type: "code",
      content: match[2],
      language: match[1] || undefined,
    });

    lastIndex = match.index + match[0].length;
  }

  // Remaining text after last code block
  if (lastIndex < text.length) {
    parts.push({ type: "text", content: text.substring(lastIndex) });
  }

  return parts;
}

/** Renders a fenced code block. */
function renderCodeBlock(content: string, language?: string): string {
  const escaped = escapeHtml(content.trimEnd());
  const langAttr = language ? ` data-language="${escapeHtml(language)}"` : "";
  return `<pre class="bg-pm-bg-tertiary rounded p-3 my-2 overflow-x-auto text-xs font-pm-mono"${langAttr}><code>${escaped}</code></pre>`;
}

// ---------------------------------------------------------------------------
// Text block rendering (paragraphs, lists, inline formatting)
// ---------------------------------------------------------------------------

function renderTextBlock(text: string): string {
  // Split into paragraphs by double newlines
  const paragraphs = text.split(/\n{2,}/);

  return paragraphs
    .map((p) => p.trim())
    .filter((p) => p.length > 0)
    .map((p) => {
      // Check if it's a list
      const lines = p.split("\n");
      if (isUnorderedList(lines)) {
        return renderUnorderedList(lines);
      }
      if (isOrderedList(lines)) {
        return renderOrderedList(lines);
      }
      // Check if it's a heading
      if (p.startsWith("# ")) {
        return `<h3 class="font-semibold text-sm text-pm-text-primary mt-3 mb-1">${applyInlineFormatting(escapeHtml(p.substring(2)))}</h3>`;
      }
      if (p.startsWith("## ")) {
        return `<h4 class="font-semibold text-sm text-pm-text-primary mt-3 mb-1">${applyInlineFormatting(escapeHtml(p.substring(3)))}</h4>`;
      }
      if (p.startsWith("### ")) {
        return `<h4 class="font-medium text-sm text-pm-text-primary mt-2 mb-1">${applyInlineFormatting(escapeHtml(p.substring(4)))}</h4>`;
      }

      // Regular paragraph — may contain multiple lines (soft breaks)
      const escaped = lines.map((l) => escapeHtml(l.trim())).join("<br />");
      return `<p class="my-1.5 text-sm leading-relaxed">${applyInlineFormatting(escaped)}</p>`;
    })
    .join("");
}

// ---------------------------------------------------------------------------
// List detection and rendering
// ---------------------------------------------------------------------------

function isUnorderedList(lines: string[]): boolean {
  return lines.some((l) => /^[\s]*[-*] /.test(l));
}

function isOrderedList(lines: string[]): boolean {
  return lines.some((l) => /^[\s]*\d+\. /.test(l));
}

function renderUnorderedList(lines: string[]): string {
  const items = lines
    .map((l) => l.replace(/^[\s]*[-*] /, "").trim())
    .filter((l) => l.length > 0)
    .map((l) => `<li class="ml-4 text-sm">${applyInlineFormatting(escapeHtml(l))}</li>`)
    .join("");
  return `<ul class="list-disc my-1.5 pl-2">${items}</ul>`;
}

function renderOrderedList(lines: string[]): string {
  const items = lines
    .map((l) => l.replace(/^[\s]*\d+\. /, "").trim())
    .filter((l) => l.length > 0)
    .map((l) => `<li class="ml-4 text-sm">${applyInlineFormatting(escapeHtml(l))}</li>`)
    .join("");
  return `<ol class="list-decimal my-1.5 pl-2">${items}</ol>`;
}

// ---------------------------------------------------------------------------
// Inline formatting (applied AFTER HTML escaping)
// ---------------------------------------------------------------------------

/** Applies inline formatting: bold, inline code. */
function applyInlineFormatting(escaped: string): string {
  let result = escaped;

  // Inline code: `code` → <code>
  result = result.replace(
    /`([^`]+)`/g,
    '<code class="bg-pm-bg-tertiary px-1 py-0.5 rounded text-xs font-pm-mono">$1</code>'
  );

  // Bold: **text** → <strong>
  result = result.replace(
    /\*\*([^*]+)\*\*/g,
    "<strong>$1</strong>"
  );

  return result;
}
