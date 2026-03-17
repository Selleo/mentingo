import { Node, mergeAttributes } from "@tiptap/core";
import { NodeViewWrapper, ReactNodeViewRenderer } from "@tiptap/react";
import { ChevronLeft, ChevronRight, FileText, GripVertical, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "~/components/ui/button";

import type { NodeConfig } from "@tiptap/core";
import type { NodeViewProps } from "@tiptap/react";

type ReactPdfModule = typeof import("react-pdf");

type PdfPreviewAttrs = {
  src: string | null;
  name: string | null;
};

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    pdfPreview: {
      setPdfPreviewEmbed: (attrs: { src: string; name?: string | null }) => ReturnType;
    };
  }
}

const PDF_PREVIEW_NODE_TYPE = "pdf-preview";

const normalizePdfPreviewAttrs = (attrs: {
  src?: string | null;
  name?: string | null;
}): PdfPreviewAttrs => ({
  src: typeof attrs.src === "string" ? attrs.src : null,
  name: typeof attrs.name === "string" ? attrs.name : null,
});

const getPdfPreviewDataAttributes = (attrs: PdfPreviewAttrs) => ({
  "data-node-type": PDF_PREVIEW_NODE_TYPE,
  "data-src": attrs.src ?? "",
  "data-name": attrs.name ?? "",
});

const PdfPreviewEditorView = ({ node, editor, getPos }: NodeViewProps) => {
  const { t } = useTranslation();
  const attrs = normalizePdfPreviewAttrs(node.attrs);

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
  const { t } = useTranslation();
  const attrs = normalizePdfPreviewAttrs(node.attrs);
  const [pageCount, setPageCount] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [visiblePage, setVisiblePage] = useState(1);
  const [isPageRendering, setIsPageRendering] = useState(false);
  const [reactPdf, setReactPdf] = useState<ReactPdfModule | null>(null);
  const [viewerWidth, setViewerWidth] = useState<number | null>(null);
  const viewerContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!attrs.src) return;

    const canRenderPdf = typeof window !== "undefined" && typeof DOMMatrix !== "undefined";
    if (!canRenderPdf) return;

    let isMounted = true;

    void import("react-pdf")
      .then((module) => {
        if (!isMounted) return;

        module.pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${module.pdfjs.version}/build/pdf.worker.min.mjs`;

        setReactPdf(module);
      })
      .catch(() => setReactPdf(null));

    return () => {
      isMounted = false;
    };
  }, [attrs.src]);

  useEffect(() => {
    setCurrentPage(1);
    setVisiblePage(1);
    setIsPageRendering(false);
    setPageCount(null);
  }, [attrs.src]);

  useEffect(() => {
    if (!viewerContainerRef.current) return;

    const element = viewerContainerRef.current;
    const updateWidth = () => {
      setViewerWidth(Math.floor(element.clientWidth));
    };

    updateWidth();

    const observer = new ResizeObserver(updateWidth);
    observer.observe(element);

    return () => observer.disconnect();
  }, []);

  if (!attrs.src) return null;
  const canRenderPdf =
    typeof window !== "undefined" && typeof DOMMatrix !== "undefined" && reactPdf !== null;

  if (!canRenderPdf) {
    return (
      <NodeViewWrapper className="pdf-preview-node block w-full">
        <div className="w-full rounded-md border p-2">
          <a
            href={attrs.src}
            target="_blank"
            rel="noopener noreferrer"
            className="p-4 text-sm text-primary-700 underline"
          >
            {t("richText.pdfPreview.openFile")}
          </a>
        </div>
      </NodeViewWrapper>
    );
  }

  const { Document, Page } = reactPdf;
  const isPreloadingNextPage = currentPage !== visiblePage;

  return (
    <NodeViewWrapper className="pdf-preview-node block w-full">
      <div ref={viewerContainerRef} className="w-full rounded-md border p-2">
        <Document
          className="w-full"
          file={attrs.src}
          onLoadSuccess={({ numPages }: { numPages: number }) => {
            setPageCount(numPages);
            const normalizedPage = Math.min(Math.max(currentPage, 1), numPages);
            setCurrentPage(normalizedPage);
            setVisiblePage(normalizedPage);
            setIsPageRendering(false);
          }}
          loading={
            <div className="p-4 text-sm text-neutral-600">{t("richText.pdfPreview.loading")}</div>
          }
          error={
            <a
              href={attrs.src}
              target="_blank"
              rel="noopener noreferrer"
              className="p-4 text-sm text-primary-700 underline"
            >
              {t("richText.pdfPreview.openFile")}
            </a>
          }
        >
          <div className="relative">
            <Page
              pageNumber={visiblePage}
              width={viewerWidth ?? undefined}
              className="[&>canvas]:!h-auto [&>canvas]:!w-full"
              renderAnnotationLayer={false}
              renderTextLayer={false}
            />
            {isPreloadingNextPage && (
              <div className="pointer-events-none absolute inset-0 opacity-0">
                <Page
                  pageNumber={currentPage}
                  width={viewerWidth ?? undefined}
                  className="[&>canvas]:!h-auto [&>canvas]:!w-full"
                  renderAnnotationLayer={false}
                  renderTextLayer={false}
                  onRenderSuccess={() => {
                    setVisiblePage(currentPage);
                    setIsPageRendering(false);
                  }}
                  onRenderError={() => {
                    setCurrentPage(visiblePage);
                    setIsPageRendering(false);
                  }}
                />
              </div>
            )}
          </div>
        </Document>
        {pageCount && (
          <div className="mt-2 flex items-center justify-between gap-2">
            <div className="text-xs text-neutral-600">
              {t("richText.pdfPreview.showingPage", { page: visiblePage, total: pageCount })}
            </div>
            {pageCount > 1 && (
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="inline-flex items-center gap-1"
                  onClick={() => {
                    const nextPage = Math.max(currentPage - 1, 1);
                    if (nextPage === visiblePage) return;
                    setCurrentPage(nextPage);
                    setIsPageRendering(true);
                  }}
                  disabled={currentPage <= 1 || isPageRendering}
                >
                  <ChevronLeft className="size-3.5" aria-hidden />
                  {t("richText.pdfPreview.previous")}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="inline-flex items-center gap-1"
                  onClick={() => {
                    const nextPage = Math.min(currentPage + 1, pageCount);
                    if (nextPage === visiblePage) return;
                    setCurrentPage(nextPage);
                    setIsPageRendering(true);
                  }}
                  disabled={currentPage >= pageCount || isPageRendering}
                >
                  {t("richText.pdfPreview.next")}
                  <ChevronRight className="size-3.5" aria-hidden />
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
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

export const PdfPreviewEmbedEditor = Node.create({
  ...basePdfPreviewNodeConfig,
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
