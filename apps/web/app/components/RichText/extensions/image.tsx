import { Node, mergeAttributes } from "@tiptap/core";
import { NodeViewWrapper, ReactNodeViewRenderer } from "@tiptap/react";
import { GripVertical, Image as ImageIcon, X } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "~/components/ui/button";

import {
  IMAGE_NODE_TYPE,
  getImageEmbedAttrsFromElement,
  normalizeImageEmbedAttributes,
  type ImageEmbedAttrs,
} from "./utils/image";
import { removeResourceNode, type RichTextResourceNodeOptions } from "./utils/resourceNode";

import type { NodeConfig } from "@tiptap/core";
import type { NodeViewProps } from "@tiptap/react";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    image: {
      setImageEmbed: (attrs: Partial<ImageEmbedAttrs> & { src: string }) => ReturnType;
    };
  }
}

const getImageDataAttributes = (attrs: ImageEmbedAttrs) => ({
  "data-node-type": IMAGE_NODE_TYPE,
  "data-src": attrs.src ?? "",
  "data-alt": attrs.alt ?? "",
  ...(attrs.assetId ? { "data-authoring-asset-id": attrs.assetId } : {}),
  ...(attrs.resourceId ? { "data-resource-id": attrs.resourceId } : {}),
});

const ImageEditorView = ({ node, editor, getPos }: NodeViewProps) => {
  const { t } = useTranslation();

  const attrs = normalizeImageEmbedAttributes(node.attrs);

  if (!attrs.src && !attrs.assetId) return null;

  const imageLabel = attrs.alt || attrs.src || t("courseAuthoring.review.generatedImage");
  const imageContent = (
    <>
      <ImageIcon className="size-4 shrink-0 text-primary-700" aria-hidden />
      <span className="truncate" title={imageLabel}>
        {imageLabel}
      </span>
    </>
  );

  const handleRemove = () =>
    void removeResourceNode({
      editor,
      getPos,
      nodeSize: node.nodeSize,
    });

  return (
    <NodeViewWrapper className="image-node">
      <div
        role={!attrs.src ? "status" : undefined}
        aria-busy={!attrs.src || undefined}
        className="inline-flex max-w-full items-center gap-2 rounded border border-dashed border-neutral-300 bg-neutral-50 px-3 py-2 text-sm text-primary-700"
      >
        {editor.isEditable && (
          <Button
            type="button"
            size="xs"
            variant="ghost"
            className="rounded-full text-neutral-500 hover:bg-neutral-200"
            aria-label={t("richText.image.ariaLabel.drag")}
            data-drag-handle
          >
            <GripVertical className="size-4" aria-hidden />
          </Button>
        )}
        {attrs.src ? (
          <a
            {...getImageDataAttributes(attrs)}
            href={attrs.src}
            data-read-only-allow={!editor.isEditable || undefined}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-w-0 items-center gap-2 underline"
            contentEditable={false}
          >
            {imageContent}
          </a>
        ) : (
          <span
            className="inline-flex min-w-0 items-center gap-2 underline"
            contentEditable={false}
          >
            {imageContent}
          </span>
        )}
        {editor.isEditable && (
          <Button
            type="button"
            onClick={handleRemove}
            aria-label={t("richText.image.ariaLabel.remove")}
            size="xs"
            variant="ghost"
          >
            <X className="size-3.5" aria-hidden />
          </Button>
        )}
      </div>
    </NodeViewWrapper>
  );
};

const ImageViewerView = (props: NodeViewProps) => {
  const { node } = props;
  const attrs = normalizeImageEmbedAttributes(node.attrs);

  if (!attrs.src) return <ImageEditorView {...props} />;

  return (
    <NodeViewWrapper className="image-node">
      <img
        {...getImageDataAttributes(attrs)}
        src={attrs.src}
        alt={attrs.alt ?? ""}
        className="m-0 h-auto max-w-full"
      />
    </NodeViewWrapper>
  );
};

const baseImageNodeConfig: NodeConfig = {
  name: "image",
  group: "block",
  atom: true,
  selectable: true,
  draggable: true,

  addAttributes() {
    return {
      src: {
        default: null,
      },
      alt: {
        default: null,
      },
      resourceId: {
        default: null,
      },
      assetId: {
        default: null,
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: `div[data-node-type="${IMAGE_NODE_TYPE}"]`,
        getAttrs: (el) => getImageEmbedAttrsFromElement(el as HTMLElement),
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    const { src, alt, resourceId, assetId, ...rest } = HTMLAttributes as Record<string, unknown>;

    const normalizedAttributes = normalizeImageEmbedAttributes({
      assetId: typeof assetId === "string" ? assetId : null,
      src: typeof src === "string" ? src : null,
      alt: typeof alt === "string" ? alt : null,
      resourceId: typeof resourceId === "string" ? resourceId : null,
    });

    return ["div", mergeAttributes(getImageDataAttributes(normalizedAttributes), rest)];
  },

  addCommands() {
    return {
      setImageEmbed:
        (attrs) =>
        ({ commands }) => {
          const normalizedAttributes = normalizeImageEmbedAttributes(attrs);

          if (!normalizedAttributes.src) return false;

          return commands.insertContent({
            type: this.name,
            attrs: normalizedAttributes,
          });
        },
    };
  },
};

export const ImageEmbedEditor = Node.create<RichTextResourceNodeOptions>({
  ...baseImageNodeConfig,
  addOptions() {
    return {};
  },
  addNodeView() {
    return ReactNodeViewRenderer(ImageEditorView);
  },
});

export const ImageEmbedViewer = Node.create({
  ...baseImageNodeConfig,
  addNodeView() {
    return ReactNodeViewRenderer(ImageViewerView);
  },
});
