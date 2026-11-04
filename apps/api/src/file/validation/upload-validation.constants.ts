export const MAX_UPLOAD_IMAGE_PIXELS = 16_777_216;
export const SVG_BASE_DENSITY = 72;
export const SVG_MAX_DENSITY = 2400;
export const UPLOAD_IMAGE_TIMEOUT_SECONDS = 5;

export const TEXT_UPLOAD_MIME_TYPES_BY_EXTENSION: Record<string, string> = {
  csv: "text/csv",
  txt: "text/plain",
  md: "text/markdown",
  markdown: "text/markdown",
  xmd: "text/markdown",
};

export const UPLOAD_CONTENT_SOURCE = {
  BINARY: "binary",
  SVG: "svg",
  TEXT: "text",
} as const;
