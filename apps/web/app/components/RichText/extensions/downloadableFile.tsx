import { Node, mergeAttributes } from "@tiptap/core";
import { NodeViewWrapper, ReactNodeViewRenderer } from "@tiptap/react";
import { Download, X } from "lucide-react";

import { Button } from "~/components/ui/button";

import type { NodeConfig } from "@tiptap/core";
import type { NodeViewProps } from "@tiptap/react";

type DownloadableFileAttrs = {
  src: string | null;
  name: string | null;
};

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    downloadableFile: {
      setDownloadableFile: (attrs: { src: string; name: string }) => ReturnType;
    };
  }
}

const DOWNLOADABLE_FILE_NODE_TYPE = "downloadable-file";

const normalizeDownloadableFileAttrs = (attrs: {
  src?: string | null;
  name?: string | null;
}): DownloadableFileAttrs => ({
  src: typeof attrs.src === "string" ? attrs.src : null,
  name: typeof attrs.name === "string" ? attrs.name : null,
});

const getDownloadableFileDataAttributes = (attrs: DownloadableFileAttrs) => ({
  "data-node-type": DOWNLOADABLE_FILE_NODE_TYPE,
  "data-src": attrs.src ?? "",
  "data-name": attrs.name ?? "",
});

const DownloadableFileEditorView = ({ node, editor, getPos }: NodeViewProps) => {
  const attrs = normalizeDownloadableFileAttrs(node.attrs);
  if (!attrs.src) return null;

  const handleRemove = () => {
    const pos = getPos();

    editor
      .chain()
      .focus()
      .deleteRange({ from: pos, to: pos + node.nodeSize })
      .run();
  };

  return (
    <NodeViewWrapper className="downloadable-file-node">
      <div className="inline-flex max-w-full items-center gap-2 rounded-md border border-dashed border-neutral-300 bg-neutral-50 px-3 py-2 text-sm text-neutral-900">
        <a
          {...getDownloadableFileDataAttributes(attrs)}
          href={attrs.src}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-w-0 items-center gap-2"
          contentEditable={false}
        >
          <Download className="size-4 text-neutral-700" aria-hidden />
          <span className="truncate">{attrs.name ?? attrs.src}</span>
        </a>
        <Button
          type="button"
          onClick={handleRemove}
          aria-label="Remove downloadable file embed"
          size="xs"
          variant="ghost"
        >
          <X className="size-3.5" aria-hidden />
        </Button>
      </div>
    </NodeViewWrapper>
  );
};

const DownloadableFileViewerView = ({ node }: NodeViewProps) => {
  const attrs = normalizeDownloadableFileAttrs(node.attrs);
  if (!attrs.src) return null;

  return (
    <NodeViewWrapper className="downloadable-file-node">
      <a
        {...getDownloadableFileDataAttributes(attrs)}
        href={attrs.src}
        download={attrs.name ?? undefined}
        className="flex w-full items-center gap-3 rounded-lg border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-900 shadow-sm transition hover:border-neutral-300"
      >
        <Download className="size-4" />
        <span className="truncate">{attrs.name ?? attrs.src}</span>
      </a>
    </NodeViewWrapper>
  );
};

const baseDownloadableFileNodeConfig: NodeConfig = {
  name: "downloadableFile",
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
        tag: `div[data-node-type="${DOWNLOADABLE_FILE_NODE_TYPE}"]`,
        getAttrs: (el) => {
          const element = el as HTMLElement;
          const src = element.getAttribute("data-src") ?? null;
          const name = element.getAttribute("data-name") ?? null;
          if (!src) return false;
          return normalizeDownloadableFileAttrs({ src, name });
        },
      },
      {
        tag: "a[download][href]",
        getAttrs: (el) => {
          const element = el as HTMLAnchorElement;
          const src = element.getAttribute("href");
          if (!src) return false;
          return normalizeDownloadableFileAttrs({
            src,
            name: element.textContent?.trim() ?? null,
          });
        },
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    const { src, name, ...rest } = HTMLAttributes as Record<string, unknown>;
    const normalized = normalizeDownloadableFileAttrs({
      src: typeof src === "string" ? src : null,
      name: typeof name === "string" ? name : null,
    });

    return ["div", mergeAttributes(getDownloadableFileDataAttributes(normalized), rest)];
  },

  addCommands() {
    return {
      setDownloadableFile:
        (attrs) =>
        ({ commands }) => {
          const normalized = normalizeDownloadableFileAttrs(attrs);
          if (!normalized.src) return false;

          return commands.insertContent({
            type: this.name,
            attrs: normalized,
          });
        },
    };
  },
};

export const DownloadableFileEmbedEditor = Node.create({
  ...baseDownloadableFileNodeConfig,
  addNodeView() {
    return ReactNodeViewRenderer(DownloadableFileEditorView);
  },
});

export const DownloadableFileEmbedViewer = Node.create({
  ...baseDownloadableFileNodeConfig,
  addNodeView() {
    return ReactNodeViewRenderer(DownloadableFileViewerView);
  },
});
