export const MAX_MB_PER_FILE = 10;
export const MAX_NUM_OF_FILES = 3;

export const ALLOWED_FILE_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
];

export const ALLOWED_FILE_TYPES_MAP = {
  PDF: "application/pdf",
  DOCX: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  TXT: "text/plain",
} as const;

// Only document formats accepted by resource-library uploads and supported by our parsers.
export const SEARCH_FILE_TYPES_MAP = {
  PDF: ALLOWED_FILE_TYPES_MAP.PDF,
  DOCX: ALLOWED_FILE_TYPES_MAP.DOCX,
  PPTX: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  XLSX: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  CSV: "text/csv",
} as const;

export const SEARCH_EXTRACTABLE_FILE_TYPES: string[] = Object.values(SEARCH_FILE_TYPES_MAP);
