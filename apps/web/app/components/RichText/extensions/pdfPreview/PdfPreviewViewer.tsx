import { ChevronLeft, ChevronRight, Maximize, Minimize } from "lucide-react";
import { useEffect, useReducer, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";

import { PDF_VIEWER_ACTION } from "./constants";
import { initialPdfViewerState, pdfViewerReducer } from "./reducer";

import type { PdfPreviewViewerProps, ReactPdfModule } from "./types";

export const PdfPreviewViewer = ({ src }: PdfPreviewViewerProps) => {
  const { t } = useTranslation();
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
    if (!src) return;

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
  }, [src]);

  useEffect(() => {
    dispatch({ type: PDF_VIEWER_ACTION.RESET });
  }, [src]);

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

  if (!src) return null;

  const canRenderPdf =
    typeof window !== "undefined" && typeof DOMMatrix !== "undefined" && reactPdf !== null;

  if (!canRenderPdf) {
    return (
      <div className="w-full rounded-md border p-2">
        <a
          href={src}
          target="_blank"
          rel="noopener noreferrer"
          className="p-4 text-sm text-primary-700 underline"
        >
          {t("richText.pdfPreview.openFile")}
        </a>
      </div>
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
          file={src}
          onLoadSuccess={({ numPages }: { numPages: number }) => {
            dispatch({ type: PDF_VIEWER_ACTION.DOCUMENT_LOADED, pageCount: numPages });
          }}
          loading={
            <div className="p-4 text-sm text-neutral-600">{t("richText.pdfPreview.loading")}</div>
          }
          error={
            <a
              href={src}
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
              isFullscreen ? "flex min-h-0 flex-1 items-center justify-center overflow-hidden" : "",
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
            <div className={cn("text-xs", isFullscreen ? "text-neutral-100" : "text-neutral-600")}>
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
                aria-label={isFullscreen ? t("common.exitFullscreen") : t("common.enterFullscreen")}
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
  );
};
