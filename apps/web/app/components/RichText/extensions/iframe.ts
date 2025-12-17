import { Node, mergeAttributes } from "@tiptap/core";

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
      },
    ];
  },

  addAttributes() {
    return {
      src: {
        default: null,
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
    return [
      "iframe",
      mergeAttributes(
        {
          class: "w-full aspect-video",
        },
        HTMLAttributes,
      ),
    ];
  },
});
