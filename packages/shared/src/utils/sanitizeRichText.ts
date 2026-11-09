import sanitizeHtml from "sanitize-html";

import { BLANK_ANSWER_MARKER_REGEX } from "./blankAnswerMarkers";
import { isAllowedIframeUrl } from "./iframeUrls";

const BLANK_ANSWER_ID_REGEX = /^[a-z0-9-]+$/;
const BLANK_ANSWER_TAG_PREFIX = "blank-answer-";
const IFRAME_SANDBOX = "allow-scripts allow-presentation";
const ALLOWED_URL_SCHEMES = ["http", "https", "mailto", "tel"];
const CSS_COLOR_VALUES = [/^#[0-9a-f]{3,8}$/i, /^[a-z]+$/i, /^rgba?\([\d.,%\s]+\)$/i];
const CSS_LENGTH_VALUES = [/^\d+(\.\d+)?(px|%)$/];

const getBlankAnswerTags = (html: string) =>
  new Set(
    [...html.matchAll(BLANK_ANSWER_MARKER_REGEX)]
      .map((match) => match[1].split(/\s/, 1)[0])
      .filter((answerId) => BLANK_ANSWER_ID_REGEX.test(answerId))
      .map((answerId) => `${BLANK_ANSWER_TAG_PREFIX}${answerId}`),
  );

const restoreBlankAnswerMarkers = (html: string, blankAnswerTags: Set<string>) =>
  html.replace(BLANK_ANSWER_MARKER_REGEX, (marker) => {
    const tag = marker.slice(1, -3);

    return marker.endsWith(" />") && blankAnswerTags.has(tag) ? `<${tag}>` : marker;
  });

/**
 * Shared HTML boundary for persisted rich text, previews and Tiptap parsing. Fill-in-the-blank
 * markers (`<blank-answer-{id}>`) are kept without attributes so quiz answers stay linked.
 */
export const sanitizeRichText = (html: string): string => {
  const blankAnswerTags = getBlankAnswerTags(html);

  const sanitized = sanitizeHtml(html, {
    selfClosing: [...sanitizeHtml.defaults.selfClosing, ...blankAnswerTags],
    allowedTags: [
      ...blankAnswerTags,
      "p",
      "br",
      "div",
      "span",
      "h1",
      "h2",
      "h3",
      "h4",
      "h5",
      "h6",
      "strong",
      "b",
      "em",
      "i",
      "u",
      "s",
      "strike",
      "mark",
      "sub",
      "sup",
      "blockquote",
      "pre",
      "code",
      "hr",
      "ul",
      "ol",
      "li",
      "a",
      "img",
      "audio",
      "table",
      "thead",
      "tbody",
      "tfoot",
      "tr",
      "th",
      "td",
      "colgroup",
      "col",
      "iframe",
      "label",
      "input",
      "button",
    ],
    allowedAttributes: {
      "*": ["class", "id", "title", "data-*", "style"],
      a: ["href", "target", "rel", "download"],
      img: ["src", "alt", "width", "height"],
      audio: ["src", "controls", "preload"],
      ol: ["start"],
      th: ["colspan", "rowspan", "colwidth"],
      td: ["colspan", "rowspan", "colwidth"],
      col: ["span", "width"],
      button: [{ name: "type", values: ["button"] }],
      input: [{ name: "type", values: ["checkbox"] }, "checked", "disabled"],
      iframe: [
        "src",
        "title",
        "width",
        "height",
        "allowfullscreen",
        "frameborder",
        "loading",
        "sandbox",
      ],
    },
    allowedStyles: {
      "*": {
        color: CSS_COLOR_VALUES,
        "background-color": CSS_COLOR_VALUES,
        "text-align": [/^(left|right|center|justify)$/],
        width: CSS_LENGTH_VALUES,
        "min-width": CSS_LENGTH_VALUES,
      },
    },
    allowedSchemes: ALLOWED_URL_SCHEMES,
    allowedSchemesByTag: { iframe: ["https"], div: [...ALLOWED_URL_SCHEMES, "blob"] },
    exclusiveFilter: (frame) => frame.tag === "iframe" && !isAllowedIframeUrl(frame.attribs.src),
    allowedSchemesAppliedToAttributes: [
      ...sanitizeHtml.defaults.allowedSchemesAppliedToAttributes,
      "data-src",
      "data-url",
    ],
    allowProtocolRelative: false,
    transformTags: {
      "*": (tagName, attribs) => ({
        tagName,
        attribs: blankAnswerTags.has(tagName) ? {} : attribs,
      }),
      a: sanitizeHtml.simpleTransform("a", { rel: "noopener noreferrer" }),
      iframe: sanitizeHtml.simpleTransform("iframe", { sandbox: IFRAME_SANDBOX }),
      button: sanitizeHtml.simpleTransform("button", { type: "button" }),
      input: sanitizeHtml.simpleTransform("input", { type: "checkbox", disabled: "" }),
    },
  });

  return restoreBlankAnswerMarkers(sanitized, blankAnswerTags);
};
