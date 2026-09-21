import { describe, expect, it } from "vitest";

import { normalizeMarkdownCode } from "./viewer.utils";

describe("normalizeMarkdownCode", () => {
  it("converts fenced Markdown into selectable HTML code blocks", () => {
    const content = "Before\n\n```typescript\nconst answer = 42;\n```\n\nAfter";

    expect(normalizeMarkdownCode(content)).toBe(
      'Before\n\n<pre><code class="language-typescript">const answer = 42;</code></pre>\n\nAfter',
    );
  });

  it("escapes HTML inside code blocks", () => {
    expect(normalizeMarkdownCode("~~~html\n<div>safe</div>\n~~~")).toBe(
      '<pre><code class="language-html">&lt;div&gt;safe&lt;/div&gt;</code></pre>',
    );
  });

  it("leaves ordinary content unchanged", () => {
    expect(normalizeMarkdownCode("Use ordinary content here.")).toBe("Use ordinary content here.");
  });

  it("converts inline Markdown code into a code element without backticks", () => {
    expect(normalizeMarkdownCode("Use `Testingo` here.")).toBe("Use <code>Testingo</code> here.");
  });
});
