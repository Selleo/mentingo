import type { PDF_VIEWER_ACTION } from "./constants";

export type ReactPdfModule = typeof import("react-pdf");

export type PdfPreviewAttrs = {
  src: string | null;
  name: string | null;
};

export type PdfPreviewViewerProps = {
  src: string;
  name?: string | null;
};

export type PdfViewerState = {
  pageCount: number | null;
  currentPage: number;
  visiblePage: number;
  isPageRendering: boolean;
};

export type PdfViewerAction =
  | { type: (typeof PDF_VIEWER_ACTION)["RESET"] }
  | { type: (typeof PDF_VIEWER_ACTION)["DOCUMENT_LOADED"]; pageCount: number }
  | { type: (typeof PDF_VIEWER_ACTION)["REQUEST_PAGE_CHANGE"]; nextPage: number }
  | { type: (typeof PDF_VIEWER_ACTION)["PRELOAD_SUCCESS"] }
  | { type: (typeof PDF_VIEWER_ACTION)["PRELOAD_ERROR"] };
