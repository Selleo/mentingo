import sanitizeHtml from "sanitize-html";

const ESCAPED_TEXT_CHARACTERS: ReadonlyMap<string, string> = new Map([
  ["&lt;", "<"],
  ["&gt;", ">"],
  ["&amp;", "&"],
]);

/**
 * Returns the readable text of an HTML fragment by parsing it, so unclosed tags and script or
 * style contents are dropped and entities are decoded. The result is plain text: render it as
 * text, never as HTML.
 */
export const stripHtmlTags = (html: string): string =>
  sanitizeHtml(html, { allowedTags: [], allowedAttributes: {} }).replace(
    /&(?:lt|gt|amp);/g,
    (entity) => ESCAPED_TEXT_CHARACTERS.get(entity) ?? entity,
  );
