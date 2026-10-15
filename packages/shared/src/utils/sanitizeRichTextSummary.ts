import sanitizeHtml from "sanitize-html";

export const sanitizeRichTextSummary = (content: string): string =>
  sanitizeHtml(content, {
    allowedTags: [
      "p",
      "br",
      "strong",
      "b",
      "em",
      "i",
      "u",
      "s",
      "sub",
      "sup",
      "code",
      "span",
      "ul",
      "ol",
      "li",
    ],
    allowedAttributes: {},
    nonTextTags: ["script", "style", "textarea", "option", "svg", "math"],
  });
