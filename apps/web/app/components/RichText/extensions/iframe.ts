import { isAllowedIframeUrl } from "@repo/shared";
import { Node, mergeAttributes } from "@tiptap/core";

const IFRAME_SANDBOX = "allow-scripts allow-presentation";

const toAllowedIframeUrl = (value: unknown) => (isAllowedIframeUrl(value) ? value : null);

/**
 * Minimal iframe node so embeds (e.g. videos) are preserved in read-only renders.
 * Keep the allowed attributes small to avoid leaking unwanted data.
 */
export const Iframe = Node.create({
  name: "iframe",
  group: "block",
  atom: true,
  selectable: true,

  parseHTML() {
    return [
      {
        tag: "iframe",
        getAttrs: (element) => isAllowedIframeUrl(element.getAttribute("src")) && null,
      },
    ];
  },

  addAttributes() {
    return {
      src: {
        default: null,
        parseHTML: (element) => toAllowedIframeUrl(element.getAttribute("src")),
        renderHTML: (attrs) => ({ src: toAllowedIframeUrl(attrs.src) }),
      },
      title: {
        default: null,
      },
      allow: {
        default: null,
      },
      allowfullscreen: {
        default: null,
        parseHTML: (element) =>
          element.getAttribute("allowfullscreen") ?? element.hasAttribute("allowfullscreen"),
        renderHTML: (attrs) => (attrs.allowfullscreen ? { allowfullscreen: "true" } : {}),
      },
      width: {
        default: "100%",
      },
      frameborder: {
        default: 0,
      },
      loading: {
        default: "lazy",
      },
      referrerpolicy: {
        default: null,
      },
    };
  },

  renderHTML({ HTMLAttributes }) {
    if (!isAllowedIframeUrl(HTMLAttributes.src)) return ["span"];

    return [
      "iframe",
      mergeAttributes(
        { class: "w-full aspect-video" },
        { ...HTMLAttributes, sandbox: IFRAME_SANDBOX },
      ),
    ];
  },
});
