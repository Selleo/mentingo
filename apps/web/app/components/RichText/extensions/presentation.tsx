import { Node, mergeAttributes } from "@tiptap/core";
import { NodeViewWrapper, ReactNodeViewRenderer } from "@tiptap/react";

import Presentation from "~/components/Presentation/Presentation";

import type { NodeViewProps } from "@tiptap/react";

const PresentationView = ({ node }: NodeViewProps) => {
  const url = node.attrs.url as string | null;
  const isExternalUrl = Boolean(node.attrs.isExternalUrl);

  return (
    <NodeViewWrapper className="presentation-node">
      {url ? <Presentation url={url} isExternalUrl={isExternalUrl} /> : null}
    </NodeViewWrapper>
  );
};

export const PresentationNode = Node.create({
  name: "presentation",
  group: "block",
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      url: {
        default: null,
      },
      isExternalUrl: {
        default: false,
        parseHTML: (element) => element.getAttribute("data-external") === "true",
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-type="presentation"]',
        getAttrs: (el) => {
          const element = el as HTMLElement;
          const url = element.getAttribute("data-url");

          if (!url) return false;

          return {
            url,
            isExternalUrl: element.getAttribute("data-external") === "true",
          };
        },
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    const { url, isExternalUrl, ...rest } = HTMLAttributes as Record<string, unknown>;

    return [
      "div",
      mergeAttributes(
        {
          "data-type": "presentation",
          "data-url": typeof url === "string" ? url : "",
          "data-external": isExternalUrl ? "true" : "false",
        },
        rest,
      ),
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(PresentationView);
  },
});
