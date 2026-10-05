import { sanitizeRichText } from "@repo/shared";

import { SanitizeRichTextPipe } from "./sanitize-rich-text.pipe";

describe("rich-text boundaries", () => {
  it("removes executable markup and unsafe Tiptap-promoted URLs", () => {
    const result = sanitizeRichText(
      '<p style="color: red; background-image: url(javascript:alert(1))">Hello<script>alert(1)</script><img src="javascript:alert(1)" onerror="alert(1)" data-src="javascript:alert(2)"><a href="javascript:alert(1)" data-url="javascript:alert(2)" target="_blank">link</a></p>',
    );
    expect(result).toContain("Hello");
    expect(result).not.toMatch(/<script|onerror|javascript:|background-image/i);
    expect(result).toContain('rel="noopener noreferrer"');
  });

  it("allows exact HTTPS provider paths only and forces a restrictive sandbox", () => {
    const valid = sanitizeRichText(
      '<iframe src="https://www.youtube.com/embed/Ab_12-3" sandbox="allow-same-origin allow-top-navigation"></iframe>',
    );
    expect(valid).toContain('sandbox="allow-scripts allow-presentation"');
    expect(valid).toContain("youtube.com/embed/Ab_12-3");
    for (const src of [
      "//www.youtube.com/embed/abc",
      "https://youtube.com.evil.com/embed/abc",
      "https://user@youtube.com/embed/abc",
      "https://youtube.com:8443/embed/abc",
      "http://youtube.com/embed/abc",
      "https://youtube.com/watch/abc",
    ]) {
      expect(sanitizeRichText(`<iframe src="${src}"></iframe>`)).not.toContain("<iframe");
    }
  });

  it("preserves only lowercase UUID blank markers without attributes across passes", () => {
    const marker = "<blank-answer-12345678-1234-1234-1234-123456789abc>";
    const result = sanitizeRichText(
      `<p>${marker.replace(">", ' onclick="alert(1)">')}<blank-answer-not-a-uuid></p>`,
    );
    expect(result).toContain(marker);
    expect(result).not.toMatch(/onclick|blank-answer-not-a-uuid/);
    expect(sanitizeRichText(result)).toBe(result);
  });

  it("rejects non-checkbox inputs and unsafe promoted data URL schemes", () => {
    const result = sanitizeRichText(
      '<input type="text" value="secret"><input type="checkbox" onclick="x"><div data-src="vbscript:msgbox(1)" data-url="ftp://evil">x</div>',
    );
    expect(result).not.toContain('type="text"');
    expect(result).not.toContain("vbscript:");
    expect(result).not.toContain("ftp:");
    expect(result).toContain('type="checkbox"');
    expect(result).toContain("disabled");
  });

  it("drops CSS expressions and out-of-range RGB values", () => {
    const result = sanitizeRichText(
      '<span style="color: rgb(999, 1, 1); background-color: rgba(5, 6, 7, 9); width: -4px; text-align: center">x</span>',
    );
    expect(result).not.toMatch(/999|rgba|width:/);
    expect(result).toContain("text-align:center");
  });

  it("sanitizes a named body field even when extracted as a scalar", () => {
    const result = new SanitizeRichTextPipe().transform('<img src=x onerror="alert(1)">safe', {
      type: "body",
      data: "description",
    } as never);
    expect(result).toBe('<img src="x" />safe');
  });

  it("sanitizes localized body fields and question titles, not ordinary titles or files", () => {
    const file = Buffer.from("untouched");
    const body = {
      title: "<script>ordinary</script>",
      description: { en: "<script>bad</script><b>safe</b>" },
      questions: [
        {
          title: "<img src=x onerror=alert(1)>Question",
          solutionExplanation: "<script>x</script>Yes",
        },
      ],
      file,
    };
    const result = new SanitizeRichTextPipe().transform(body, { type: "body" } as never);
    expect(result.title).toBe(body.title);
    expect(result.description.en).toBe("<b>safe</b>");
    expect(result.questions[0].title).not.toContain("onerror");
    expect(result.questions[0].solutionExplanation).toBe("Yes");
    expect(result.file).toBe(file);
  });
});
