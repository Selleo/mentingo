import { Node, mergeAttributes } from "@tiptap/core";
import { NodeViewWrapper, ReactNodeViewRenderer } from "@tiptap/react";
import {
  ChevronLeft,
  ChevronRight,
  FileText,
  GripVertical,
  Maximize,
  Minimize,
  X,
} from "lucide-react";
import { useEffect, useReducer, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";

import type { NodeConfig } from "@tiptap/core";
import type { NodeViewProps } from "@tiptap/react";

type ReactPdfModule = typeof import("react-pdf");

type PdfPreviewAttrs = {
  src: string | null;
  name: string | null;
};

type PdfViewerState = {
  pageCount: number | null;
  currentPage: number;
  visiblePage: number;
  isPageRendering: boolean;
};

const PDF_VIEWER_ACTION = {
  RESET: "reset",
  DOCUMENT_LOADED: "documentLoaded",
  REQUEST_PAGE_CHANGE: "requestPageChange",
  PRELOAD_SUCCESS: "preloadSuccess",
  PRELOAD_ERROR: "preloadError",
} as const;

type PdfViewerAction =
  | { type: (typeof PDF_VIEWER_ACTION)["RESET"] }
  | { type: (typeof PDF_VIEWER_ACTION)["DOCUMENT_LOADED"]; pageCount: number }
  | { type: (typeof PDF_VIEWER_ACTION)["REQUEST_PAGE_CHANGE"]; nextPage: number }
  | { type: (typeof PDF_VIEWER_ACTION)["PRELOAD_SUCCESS"] }
  | { type: (typeof PDF_VIEWER_ACTION)["PRELOAD_ERROR"] };

const initialPdfViewerState: PdfViewerState = {
  pageCount: null,
  currentPage: 1,
  visiblePage: 1,
  isPageRendering: false,
};

const pdfViewerReducer = (state: PdfViewerState, action: PdfViewerAction): PdfViewerState => {
  switch (action.type) {
    case PDF_VIEWER_ACTION.RESET:
      return initialPdfViewerState;
    case PDF_VIEWER_ACTION.DOCUMENT_LOADED: {
      const normalizedPage = Math.min(Math.max(state.currentPage, 1), action.pageCount);
      return {
        pageCount: action.pageCount,
        currentPage: normalizedPage,
        visiblePage: normalizedPage,
        isPageRendering: false,
      };
    }
    case PDF_VIEWER_ACTION.REQUEST_PAGE_CHANGE:
      if (action.nextPage === state.visiblePage) {
        return state;
      }
      return {
        ...state,
        currentPage: action.nextPage,
        isPageRendering: true,
      };
    case PDF_VIEWER_ACTION.PRELOAD_SUCCESS:
      return {
        ...state,
        visiblePage: state.currentPage,
        isPageRendering: false,
      };
    case PDF_VIEWER_ACTION.PRELOAD_ERROR:
      return {
        ...state,
        currentPage: state.visiblePage,
        isPageRendering: false,
      };
    default:
      return state;
  }
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
  const [{ pageCount, currentPage, visiblePage, isPageRendering }, dispatch] = useReducer(
    pdfViewerReducer,
    initialPdfViewerState,
  );

  const [reactPdf, setReactPdf] = useState<ReactPdfModule | null>(null);
  const [viewerWidth, setViewerWidth] = useState<number | null>(null);
  const [pdfAspectRatio, setPdfAspectRatio] = useState<number | null>(null);
  const [fullscreenStageSize, setFullscreenStageSize] = useState<{
    width: number;
    height: number;
  } | null>(null);
  const viewerContainerRef = useRef<HTMLDivElement | null>(null);
  const fullscreenStageRef = useRef<HTMLDivElement | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

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
    dispatch({ type: PDF_VIEWER_ACTION.RESET });
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

  useEffect(() => {
    if (!fullscreenStageRef.current) return;

    const element = fullscreenStageRef.current;
    const updateSize = () => {
      setFullscreenStageSize({
        width: Math.floor(element.clientWidth),
        height: Math.floor(element.clientHeight),
      });
    };

    updateSize();

    const observer = new ResizeObserver(updateSize);
    observer.observe(element);

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!fullscreenStageRef.current) return;

    const measure = () => {
      if (!fullscreenStageRef.current) return;
      setFullscreenStageSize({
        width: Math.floor(fullscreenStageRef.current.clientWidth),
        height: Math.floor(fullscreenStageRef.current.clientHeight),
      });
    };

    measure();
    const frame = window.requestAnimationFrame(measure);
    return () => window.cancelAnimationFrame(frame);
  }, [isFullscreen, visiblePage]);

  useEffect(() => {
    const updateFullscreenState = () => {
      const targetElement = viewerContainerRef.current;
      setIsFullscreen(!!targetElement && document.fullscreenElement === targetElement);
    };

    updateFullscreenState();
    document.addEventListener("fullscreenchange", updateFullscreenState);

    return () => {
      document.removeEventListener("fullscreenchange", updateFullscreenState);
    };
  }, []);

  useEffect(() => {
    if (!isFullscreen || !pageCount || pageCount <= 1) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft" && currentPage > 1) {
        event.preventDefault();
        dispatch({
          type: PDF_VIEWER_ACTION.REQUEST_PAGE_CHANGE,
          nextPage: Math.max(currentPage - 1, 1),
        });
      }

      if (event.key === "ArrowRight" && currentPage < pageCount) {
        event.preventDefault();
        dispatch({
          type: PDF_VIEWER_ACTION.REQUEST_PAGE_CHANGE,
          nextPage: Math.min(currentPage + 1, pageCount),
        });
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [currentPage, isFullscreen, pageCount]);

  const toggleFullscreen = () => {
    const targetElement = viewerContainerRef.current;
    if (!targetElement) return;

    if (document.fullscreenElement === targetElement) {
      void document.exitFullscreen().catch(() => {});
      return;
    }

    if (document.fullscreenElement) {
      void document
        .exitFullscreen()
        .then(() => targetElement.requestFullscreen())
        .catch(() => {});
      return;
    }

    void targetElement.requestFullscreen().catch(() => {});
  };

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
  const fullscreenPageWidth =
    isFullscreen && fullscreenStageSize && pdfAspectRatio
      ? Math.max(
          1,
          Math.floor(
            Math.min(fullscreenStageSize.width, fullscreenStageSize.height * pdfAspectRatio),
          ),
        )
      : undefined;
  const pageWidth = isFullscreen ? fullscreenPageWidth : (viewerWidth ?? undefined);

  const updateAspectRatioFromCanvas = () => {
    const canvas = fullscreenStageRef.current?.querySelector("canvas");
    if (!canvas) return;
    if (canvas.height <= 0) return;

    const nextAspectRatio = canvas.width / canvas.height;
    if (
      Number.isFinite(nextAspectRatio) &&
      nextAspectRatio > 0 &&
      (pdfAspectRatio === null || Math.abs(nextAspectRatio - pdfAspectRatio) > 0.0005)
    ) {
      setPdfAspectRatio(nextAspectRatio);
    }
  };

  const updateAspectRatioFromPage = (page: {
    getViewport: (opts: { scale: number }) => { width: number; height: number };
  }) => {
    const viewport = page.getViewport({ scale: 1 });
    if (viewport.height <= 0) return;
    const nextAspectRatio = viewport.width / viewport.height;
    if (
      Number.isFinite(nextAspectRatio) &&
      nextAspectRatio > 0 &&
      (pdfAspectRatio === null || Math.abs(nextAspectRatio - pdfAspectRatio) > 0.0005)
    ) {
      setPdfAspectRatio(nextAspectRatio);
    }
  };

  return (
    <NodeViewWrapper className="pdf-preview-node block w-full">
      <div
        ref={viewerContainerRef}
        className={cn(
          "w-full",
          isFullscreen ? "fixed inset-0 z-50 bg-black p-3 md:p-4" : "rounded-md border p-2",
        )}
      >
        <div className={cn("relative w-full", isFullscreen ? "flex h-full min-h-0 flex-col" : "")}>
          <Document
            className={cn("w-full", isFullscreen ? "flex min-h-0 flex-1 flex-col" : "")}
            file={attrs.src}
            onLoadSuccess={({ numPages }: { numPages: number }) => {
              dispatch({ type: PDF_VIEWER_ACTION.DOCUMENT_LOADED, pageCount: numPages });
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
            <div
              ref={fullscreenStageRef}
              className={cn(
                "relative w-full",
                isFullscreen
                  ? "flex min-h-0 flex-1 items-center justify-center overflow-hidden"
                  : "",
              )}
            >
              <Page
                pageNumber={visiblePage}
                width={pageWidth}
                className={cn(
                  isFullscreen ? "[&>canvas]:block" : "[&>canvas]:!h-auto [&>canvas]:!w-full",
                )}
                renderAnnotationLayer={false}
                renderTextLayer={false}
                onLoadSuccess={updateAspectRatioFromPage}
                onRenderSuccess={
                  isFullscreen && pdfAspectRatio === null ? updateAspectRatioFromCanvas : undefined
                }
              />
              {isPreloadingNextPage && (
                <div className="pointer-events-none absolute inset-0 opacity-0">
                  <Page
                    pageNumber={currentPage}
                    width={pageWidth}
                    className={cn(
                      isFullscreen ? "[&>canvas]:block" : "[&>canvas]:!h-auto [&>canvas]:!w-full",
                    )}
                    renderAnnotationLayer={false}
                    renderTextLayer={false}
                    onRenderSuccess={() => dispatch({ type: PDF_VIEWER_ACTION.PRELOAD_SUCCESS })}
                    onRenderError={() => dispatch({ type: PDF_VIEWER_ACTION.PRELOAD_ERROR })}
                  />
                </div>
              )}
            </div>
          </Document>
          {pageCount && (
            <div
              className={cn(
                "flex items-center justify-between gap-2",
                isFullscreen ? "mt-2 rounded-md bg-black/60 px-3 py-2 text-white" : "mt-2",
              )}
            >
              <div
                className={cn("text-xs", isFullscreen ? "text-neutral-100" : "text-neutral-600")}
              >
                {t("richText.pdfPreview.showingPage", { page: visiblePage, total: pageCount })}
              </div>
              <div className="flex items-center gap-2">
                {pageCount > 1 && (
                  <>
                    <Button
                      type="button"
                      variant={isFullscreen ? "ghost" : "outline"}
                      className={cn(
                        "inline-flex items-center gap-1",
                        isFullscreen
                          ? "border border-white/40 text-white hover:bg-white/15 hover:text-white"
                          : "",
                      )}
                      onClick={() => {
                        const nextPage = Math.max(currentPage - 1, 1);
                        dispatch({ type: PDF_VIEWER_ACTION.REQUEST_PAGE_CHANGE, nextPage });
                      }}
                      disabled={currentPage <= 1 || isPageRendering}
                    >
                      <ChevronLeft className="size-3.5" aria-hidden />
                      {t("richText.pdfPreview.previous")}
                    </Button>
                    <Button
                      type="button"
                      variant={isFullscreen ? "ghost" : "outline"}
                      className={cn(
                        "inline-flex items-center gap-1",
                        isFullscreen
                          ? "border border-white/40 text-white hover:bg-white/15 hover:text-white"
                          : "",
                      )}
                      onClick={() => {
                        const nextPage = Math.min(currentPage + 1, pageCount);
                        dispatch({ type: PDF_VIEWER_ACTION.REQUEST_PAGE_CHANGE, nextPage });
                      }}
                      disabled={currentPage >= pageCount || isPageRendering}
                    >
                      {t("richText.pdfPreview.next")}
                      <ChevronRight className="size-3.5" aria-hidden />
                    </Button>
                  </>
                )}
                <Button
                  type="button"
                  variant={isFullscreen ? "ghost" : "outline"}
                  size="icon"
                  className={cn(
                    isFullscreen
                      ? "border border-white/40 text-white hover:bg-white/15 hover:text-white"
                      : "",
                  )}
                  onClick={toggleFullscreen}
                  aria-label={
                    isFullscreen ? t("common.exitFullscreen") : t("common.enterFullscreen")
                  }
                >
                  {isFullscreen ? (
                    <Minimize className="size-4" aria-hidden />
                  ) : (
                    <Maximize className="size-4" aria-hidden />
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>
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
