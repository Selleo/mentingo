import { Node, mergeAttributes } from "@tiptap/core";
import { NodeViewWrapper, ReactNodeViewRenderer } from "@tiptap/react";
import { Presentation as PresentationIcon } from "lucide-react";

import Presentation from "~/components/Presentation/Presentation";

import {
  PRESENTATION_NODE_TYPE,
  getPresentationEmbedAttrsFromElement,
  normalizePresentationEmbedAttributes,
  type PresentationEmbedAttrs,
  type PresentationProvider,
  type PresentationSourceType,
} from "./utils/presentation";

import type { NodeConfig } from "@tiptap/core";
import type { NodeViewProps } from "@tiptap/react";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    presentation: {
      setPresentationEmbed: (
        attrs: Partial<PresentationEmbedAttrs> & {
          src: string;
          sourceType?: PresentationSourceType;
        },
      ) => ReturnType;
    };
  }
}

const getPresentationDataAttributes = (attrs: PresentationEmbedAttrs) => ({
  "data-node-type": PRESENTATION_NODE_TYPE,
  "data-source-type": attrs.sourceType,
  "data-provider": attrs.provider,
  "data-src": attrs.src ?? "",
});

const PresentationEditorView = ({ node }: NodeViewProps) => {
  const attrs = normalizePresentationEmbedAttributes(node.attrs);

  if (!attrs.src) return null;

  return (
    <NodeViewWrapper className="presentation-node">
      <a
        {...getPresentationDataAttributes(attrs)}
        href={attrs.src}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex max-w-full items-center gap-2 rounded border border-dashed border-neutral-300 px-3 py-2 text-sm text-primary-700 underline"
        contentEditable={false}
      >
        <PresentationIcon className="size-4 text-primary-700" aria-hidden />
        <span className="truncate">{attrs.src}</span>
      </a>
    </NodeViewWrapper>
  );
};

const PresentationViewerView = ({ node }: NodeViewProps) => {
  const attrs = normalizePresentationEmbedAttributes(node.attrs);

  if (!attrs.src) return null;

  return (
    <NodeViewWrapper className="presentation-node">
      <Presentation
        url={attrs.src}
        isExternalUrl={attrs.sourceType === "external"}
        provider={attrs.provider}
      />
    </NodeViewWrapper>
  );
};

const basePresentationNodeConfig: NodeConfig = {
  name: "presentation",
  group: "block",
  atom: true,
  selectable: true,
  draggable: true,

  addAttributes() {
    return {
      src: {
        default: null,
      },
      sourceType: {
        default: "external",
      },
      provider: {
        default: "unknown",
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-node-type="presentation"]',
        getAttrs: (el) => getPresentationEmbedAttrsFromElement(el as HTMLElement),
      },
      {
        tag: 'a[data-node-type="presentation"]',
        getAttrs: (el) => getPresentationEmbedAttrsFromElement(el as HTMLElement),
      },
      {
        tag: 'div[data-type="presentation"]',
        getAttrs: (el) => getPresentationEmbedAttrsFromElement(el as HTMLElement),
      },
      {
        tag: "iframe",
        getAttrs: (el) => getPresentationEmbedAttrsFromElement(el as HTMLElement),
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    const { src, sourceType, provider, ...rest } = HTMLAttributes as Record<string, unknown>;
    const normalized = normalizePresentationEmbedAttributes({
      src: typeof src === "string" ? src : null,
      sourceType: sourceType as PresentationSourceType,
      provider: provider as PresentationProvider,
    });

    return ["div", mergeAttributes(getPresentationDataAttributes(normalized), rest)];
  },

  addCommands() {
    return {
      setPresentationEmbed:
        (attrs) =>
        ({ commands }) => {
          const normalized = normalizePresentationEmbedAttributes(attrs);
          if (!normalized.src) return false;

          return commands.insertContent({
            type: this.name,
            attrs: normalized,
          });
        },
    };
  },
};

export const PresentationEmbedEditor = Node.create({
  ...basePresentationNodeConfig,
  addNodeView() {
    return ReactNodeViewRenderer(PresentationEditorView);
  },
});

export const PresentationEmbedViewer = Node.create({
  ...basePresentationNodeConfig,
  addNodeView() {
    return ReactNodeViewRenderer(PresentationViewerView);
  },
});
