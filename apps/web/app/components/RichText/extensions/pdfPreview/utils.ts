import { PDF_PREVIEW_NODE_TYPE } from "./constants";

import type { PdfPreviewAttrs } from "./types";

export const normalizePdfPreviewAttrs = (attrs: {
  src?: string | null;
  name?: string | null;
}): PdfPreviewAttrs => ({
  src: typeof attrs.src === "string" ? attrs.src : null,
  name: typeof attrs.name === "string" ? attrs.name : null,
});

export const getPdfPreviewDataAttributes = (attrs: PdfPreviewAttrs) => ({
  "data-node-type": PDF_PREVIEW_NODE_TYPE,
  "data-src": attrs.src ?? "",
  "data-name": attrs.name ?? "",
});
