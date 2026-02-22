import { describe, it, expect } from "vitest";
import { renderMarkdownLite, escapeHtml } from "../markdown-lite";

describe("escapeHtml", () => {
  it("escapes HTML special characters", () => {
    expect(escapeHtml("<script>alert('xss')</script>")).toBe(
      "&lt;script&gt;alert(&#39;xss&#39;)&lt;/script&gt;"
    );
  });

  it("escapes ampersands", () => {
    expect(escapeHtml("foo & bar")).toBe("foo &amp; bar");
  });

  it("escapes quotes", () => {
    expect(escapeHtml('"hello"')).toBe("&quot;hello&quot;");
  });

  it("returns empty string for empty input", () => {
    expect(escapeHtml("")).toBe("");
  });
});

describe("renderMarkdownLite", () => {
  it("returns empty string for empty input", () => {
    expect(renderMarkdownLite("")).toBe("");
  });

  it("wraps text in a paragraph", () => {
    const result = renderMarkdownLite("Hello world");
    expect(result).toContain("<p");
    expect(result).toContain("Hello world");
    expect(result).toContain("</p>");
  });

  it("renders bold text", () => {
    const result = renderMarkdownLite("This is **bold** text");
    expect(result).toContain("<strong>bold</strong>");
  });

  it("renders inline code", () => {
    const result = renderMarkdownLite("Use `fetch()` for requests");
    expect(result).toContain("<code");
    expect(result).toContain("fetch()");
    expect(result).toContain("</code>");
  });

  it("renders code blocks with triple backticks", () => {
    const result = renderMarkdownLite("```js\nconst x = 1;\n```");
    expect(result).toContain("<pre");
    expect(result).toContain("<code>");
    expect(result).toContain("const x = 1;");
    expect(result).toContain('data-language="js"');
  });

  it("renders code blocks without language", () => {
    const result = renderMarkdownLite("```\nsome code\n```");
    expect(result).toContain("<pre");
    expect(result).toContain("some code");
    expect(result).not.toContain("data-language");
  });

  it("renders unordered lists", () => {
    const result = renderMarkdownLite("- item one\n- item two\n- item three");
    expect(result).toContain("<ul");
    expect(result).toContain("<li");
    expect(result).toContain("item one");
    expect(result).toContain("item two");
    expect(result).toContain("item three");
  });

  it("renders ordered lists", () => {
    const result = renderMarkdownLite("1. first\n2. second\n3. third");
    expect(result).toContain("<ol");
    expect(result).toContain("<li");
    expect(result).toContain("first");
    expect(result).toContain("second");
  });

  it("renders headings", () => {
    const result = renderMarkdownLite("## Diagnosis\n\nSome text");
    expect(result).toContain("<h4");
    expect(result).toContain("Diagnosis");
  });

  it("separates paragraphs on double newlines", () => {
    const result = renderMarkdownLite("First paragraph.\n\nSecond paragraph.");
    const pCount = (result.match(/<p /g) || []).length;
    expect(pCount).toBe(2);
  });

  it("prevents XSS in regular text", () => {
    const result = renderMarkdownLite('<img src="x" onerror="alert(1)">');
    expect(result).not.toContain("<img");
    expect(result).toContain("&lt;img");
  });

  it("prevents XSS in code blocks", () => {
    const result = renderMarkdownLite("```\n<script>alert('xss')</script>\n```");
    expect(result).not.toContain("<script>");
    expect(result).toContain("&lt;script&gt;");
  });

  it("prevents XSS in inline code", () => {
    const result = renderMarkdownLite("Use `<script>alert(1)</script>` here");
    expect(result).not.toContain("<script>");
  });

  it("handles mixed content: text, code block, list", () => {
    const input = `This is an error.

\`\`\`json
{"error": "not found"}
\`\`\`

Try these steps:

- Check the URL
- Verify headers`;

    const result = renderMarkdownLite(input);
    expect(result).toContain("<p");
    expect(result).toContain("<pre");
    expect(result).toContain("<ul");
    expect(result).toContain("<li");
  });
});
