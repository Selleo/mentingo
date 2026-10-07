import sanitizeHtml from "sanitize-html";

/** Preserve title formatting without links, embeds, styles, or executable attributes.
 * Apply at persistence and rendering boundaries so older stored titles are safe too.
 */
export const sanitizeQuizQuestionTitle = (title: string): string =>
  sanitizeHtml(title, {
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
