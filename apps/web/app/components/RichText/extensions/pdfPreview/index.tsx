import { Node, mergeAttributes } from "@tiptap/core";
import { NodeViewWrapper, ReactNodeViewRenderer } from "@tiptap/react";
import { FileText, GripVertical, X } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "~/components/ui/button";

import { removeResourceNode, type RichTextResourceNodeOptions } from "../utils/resourceNode";

import { PDF_PREVIEW_NODE_TYPE } from "./constants";
import { PdfPreviewViewer } from "./PdfPreviewViewer";
import { getPdfPreviewDataAttributes, normalizePdfPreviewAttrs } from "./utils";

import type { NodeConfig } from "@tiptap/core";
import type { NodeViewProps } from "@tiptap/react";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    pdfPreview: {
      setPdfPreviewEmbed: (attrs: { src: string; name?: string | null }) => ReturnType;
    };
  }
}

const PdfPreviewEditorView = ({ node, editor, getPos }: NodeViewProps) => {
  const { t } = useTranslation();
  const attrs = normalizePdfPreviewAttrs(node.attrs);

  if (!attrs.src) return null;

  const handleRemove = () =>
    void removeResourceNode({
      editor,
      getPos,
      nodeSize: node.nodeSize,
    });

  return (
    <NodeViewWrapper className="pdf-preview-node block w-full">
      <div className="inline-flex max-w-full items-center gap-2 rounded border border-dashed border-neutral-300 bg-neutral-50 px-3 py-2 text-sm text-primary-700">
        <Button
          type="button"
          size="xs"
          variant="ghost"
          className="rounded-full text-neutral-500 hover:bg-neutral-200"
          aria-label={t("richText.pdfPreview.ariaLabel.drag")}
          data-drag-handle
        >
          <GripVertical className="size-4" aria-hidden />
        </Button>
        <a
          {...getPdfPreviewDataAttributes(attrs)}
          href={attrs.src}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-w-0 items-center gap-2 underline"
          contentEditable={false}
        >
          <FileText className="size-4 text-primary-700" aria-hidden />
          <span className="truncate">{attrs.name ?? attrs.src}</span>
        </a>
        <Button
          type="button"
          onClick={handleRemove}
          aria-label={t("richText.pdfPreview.ariaLabel.remove")}
          size="xs"
          variant="ghost"
        >
          <X className="size-3.5" aria-hidden />
        </Button>
      </div>
    </NodeViewWrapper>
  );
};

const PdfPreviewViewerView = ({ node }: NodeViewProps) => {
  const attrs = normalizePdfPreviewAttrs(node.attrs);

  if (!attrs.src) return null;

  return (
    <NodeViewWrapper className="pdf-preview-node block w-full">
      <PdfPreviewViewer src={attrs.src} name={attrs.name} />
    </NodeViewWrapper>
  );
};

const basePdfPreviewNodeConfig: NodeConfig = {
  name: "pdfPreview",
  group: "block",
  atom: true,
  selectable: true,
  draggable: true,

  addAttributes() {
    return {
      src: {
        default: null,
      },
      name: {
        default: null,
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: `div[data-node-type="${PDF_PREVIEW_NODE_TYPE}"]`,
        getAttrs: (el) => {
          const element = el as HTMLElement;
          const src = element.getAttribute("data-src") ?? null;
          const name = element.getAttribute("data-name") ?? null;
          if (!src) return false;
          return normalizePdfPreviewAttrs({ src, name });
        },
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    const { src, name, ...rest } = HTMLAttributes as Record<string, unknown>;

    const normalizedAttributes = normalizePdfPreviewAttrs({
      src: typeof src === "string" ? src : null,
      name: typeof name === "string" ? name : null,
    });

    return ["div", mergeAttributes(getPdfPreviewDataAttributes(normalizedAttributes), rest)];
  },

  addCommands() {
    return {
      setPdfPreviewEmbed:
        (attrs) =>
        ({ commands }) => {
          const normalizedAttributes = normalizePdfPreviewAttrs(attrs);

          if (!normalizedAttributes.src) return false;

          return commands.insertContent({
            type: this.name,
            attrs: normalizedAttributes,
          });
        },
    };
  },
};

export const PdfPreviewEmbedEditor = Node.create<RichTextResourceNodeOptions>({
  ...basePdfPreviewNodeConfig,
  addOptions() {
    return {};
  },
  addNodeView() {
    return ReactNodeViewRenderer(PdfPreviewEditorView);
  },
});

export const PdfPreviewEmbedViewer = Node.create({
  ...basePdfPreviewNodeConfig,
  addNodeView() {
    return ReactNodeViewRenderer(PdfPreviewViewerView);
  },
});
