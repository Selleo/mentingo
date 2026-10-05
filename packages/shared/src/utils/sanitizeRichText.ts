import sanitizeHtml from "sanitize-html";

export const BLANK_ANSWER_MARKER_REGEX = /<blank-answer-([^>]+)>/g;
const UUID = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/;
const TAGS = [
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
];
const ID = "[\\w-]+";
const PROVIDERS: Record<string, RegExp> = {
  "youtube.com": /^\/embed\/[\w-]+\/?$/,
  "www.youtube.com": /^\/embed\/[\w-]+\/?$/,
  "youtube-nocookie.com": /^\/embed\/[\w-]+\/?$/,
  "www.youtube-nocookie.com": /^\/embed\/[\w-]+\/?$/,
  "player.vimeo.com": /^\/video\/\d+\/?$/,
  "iframe.mediadelivery.net": /^\/embed\/\d+\/[\w-]+\/?$/,
  "docs.google.com": new RegExp(
    `^/(?:presentation/d/(?:e/)?${ID}/(?:embed|pubembed|preview)|presentation/(?:pubembed|preview))/?$`,
  ),
  "canva.com": new RegExp(`^/design/${ID}/(?:${ID}/)?view/?$`),
  "www.canva.com": new RegExp(`^/design/${ID}/(?:${ID}/)?view/?$`),
};

export function isAllowedIframeUrl(value: string): boolean {
  if (!/^https:\/\//i.test(value)) return false;
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      !url.port &&
      Boolean(PROVIDERS[url.hostname]?.test(url.pathname))
    );
  } catch {
    return false;
  }
}

const CHANNEL = "(?:25[0-5]|2[0-4]\\d|1?\\d?\\d)";
const COLOR = new RegExp(
  `^(?:#[a-f\\d]{3,8}|[a-z]+|rgb\\(\\s*${CHANNEL}\\s*,\\s*${CHANNEL}\\s*,\\s*${CHANNEL}\\s*\\)|rgba\\(\\s*${CHANNEL}\\s*,\\s*${CHANNEL}\\s*,\\s*${CHANNEL}\\s*,\\s*(?:0(?:\\.\\d+)?|1(?:\\.0+)?)\\s*\\))$`,
  "i",
);
const SIZE = /^\d+(?:\.\d+)?(?:px|%)$/;

export function sanitizeRichText(value: string): string {
  const markers = new Set<string>();
  for (const match of value.matchAll(/<blank-answer-([0-9a-f-]{36})(?=\s|\/?>)/g)) {
    if (UUID.test(match[1])) markers.add(`blank-answer-${match[1]}`);
  }
  const result = sanitizeHtml(value, {
    allowedTags: [...TAGS, ...markers],
    selfClosing: ["img", "br", "hr", "input", ...markers],
    allowedAttributes: {
      "*": ["class", "id", "title", "data-*", "style"],
      a: ["href", "target", "rel", "download"],
      img: ["src", "alt", "width", "height"],
      ol: ["start"],
      th: ["colspan", "rowspan", "colwidth"],
      td: ["colspan", "rowspan", "colwidth"],
      col: ["span", "width"],
      button: ["type"],
      input: ["type", "checked", "disabled"],
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
      ...Object.fromEntries([...markers].map((tag) => [tag, []])),
    },
    allowedSchemes: ["http", "https", "mailto", "tel"],
    allowProtocolRelative: false,
    allowedStyles: {
      "*": {
        color: [COLOR],
        "background-color": [COLOR],
        "text-align": [/^(?:left|right|center|justify)$/],
        width: [SIZE],
        "min-width": [SIZE],
      },
    },
    exclusiveFilter: (frame) => frame.tag === "discard",
    // Tiptap extensions promote these data attributes to live URLs when parsed.
    transformTags: {
      "*": (tagName, attrs) => {
        for (const key of ["data-src", "data-url"]) {
          const url = attrs[key];
          if (
            url &&
            (/^\s*\/\//.test(url) ||
              (/^\s*[a-z][\w+.-]*:/i.test(url) && !/^\s*(?:https?|mailto|tel):/i.test(url)))
          )
            delete attrs[key];
        }
        if (markers.has(tagName)) return { tagName, attribs: {} };
        if (tagName === "a") return { tagName, attribs: { ...attrs, rel: "noopener noreferrer" } };
        if (tagName === "button") return { tagName, attribs: { ...attrs, type: "button" } };
        if (tagName === "input")
          return attrs.type === "checkbox"
            ? { tagName, attribs: { ...attrs, type: "checkbox", disabled: "disabled" } }
            : { tagName: "discard", attribs: {} };
        if (tagName === "iframe")
          return isAllowedIframeUrl(attrs.src ?? "")
            ? { tagName, attribs: { ...attrs, sandbox: "allow-scripts allow-presentation" } }
            : { tagName: "discard", attribs: {} };
        return { tagName, attribs: attrs };
      },
    },
  });
  return result.replace(/<blank-answer-([0-9a-f-]+)\s*\/>/g, "<blank-answer-$1>");
}
