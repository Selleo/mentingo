import { PDF_VIEWER_ACTION } from "./constants";

import type { PdfViewerAction, PdfViewerState } from "./types";

export const initialPdfViewerState: PdfViewerState = {
  pageCount: null,
  currentPage: 1,
  visiblePage: 1,
  isPageRendering: false,
};

export const pdfViewerReducer = (
  state: PdfViewerState,
  action: PdfViewerAction,
): PdfViewerState => {
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
