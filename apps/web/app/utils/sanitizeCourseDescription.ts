import sanitizeHtml from "sanitize-html";

/** Course descriptions allow formatting, but never active embeds or executable attributes. */
export const sanitizeCourseDescription = (description: string): string =>
  sanitizeHtml(description, {
    allowedTags: sanitizeHtml.defaults.allowedTags.filter((tag) => tag !== "iframe"),
    allowedAttributes: {
      a: ["href", "title", "target", "rel"],
    },
    allowedSchemes: ["http", "https", "mailto"],
  });
