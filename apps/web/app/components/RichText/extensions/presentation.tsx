import { Node, mergeAttributes } from "@tiptap/core";
import { NodeViewWrapper, ReactNodeViewRenderer } from "@tiptap/react";
import { GripVertical, Presentation as PresentationIcon, X } from "lucide-react";

import Presentation from "~/components/Presentation/Presentation";
import { Button } from "~/components/ui/button";

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

const PresentationEditorView = ({ node, editor, getPos }: NodeViewProps) => {
  const attributes = normalizePresentationEmbedAttributes(node.attrs);

  if (!attributes.src) return null;

  const handleRemove = () => {
    const pos = getPos();

    editor
      .chain()
      .focus()
      .deleteRange({ from: pos, to: pos + node.nodeSize })
      .run();
  };

  return (
    <NodeViewWrapper className="presentation-node">
      <div className="inline-flex max-w-full items-center gap-2 rounded border border-dashed border-neutral-300 bg-neutral-50 px-3 py-2 text-sm text-primary-700">
        <Button
          type="button"
          size="xs"
          variant="ghost"
          className="rounded-full text-neutral-500 hover:bg-neutral-200"
          aria-label="Drag presentation embed"
          data-drag-handle
        >
          <GripVertical className="size-4" aria-hidden />
        </Button>
        <a
          {...getPresentationDataAttributes(attributes)}
          href={attributes.src}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-w-0 items-center gap-2 underline"
          contentEditable={false}
        >
          <PresentationIcon className="size-4 text-primary-700" aria-hidden />
          <span className="truncate">{attributes.src}</span>
        </a>
        <Button
          type="button"
          onClick={handleRemove}
          aria-label="Remove presentation embed"
          size="xs"
          variant="ghost"
        >
          <X className="size-3.5" aria-hidden />
        </Button>
      </div>
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
    ];
  },

  renderHTML({ HTMLAttributes }) {
    const { src, sourceType, provider, ...rest } = HTMLAttributes as Record<string, unknown>;

    const normalizedAttributes = normalizePresentationEmbedAttributes({
      src: typeof src === "string" ? src : null,
      sourceType: sourceType as PresentationSourceType,
      provider: provider as PresentationProvider,
    });

    return ["div", mergeAttributes(getPresentationDataAttributes(normalizedAttributes), rest)];
  },

  addCommands() {
    return {
      setPresentationEmbed:
        (attrs) =>
        ({ commands }) => {
          const normalizedAttributes = normalizePresentationEmbedAttributes(attrs);

          if (!normalizedAttributes.src) return false;

          return commands.insertContent({
            type: this.name,
            attrs: normalizedAttributes,
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
