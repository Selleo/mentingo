import {
  ALLOWED_EXCEL_FILE_TYPES,
  ALLOWED_LESSON_IMAGE_FILE_TYPES,
  ALLOWED_PDF_FILE_TYPES,
  ALLOWED_PRESENTATION_FILE_TYPES,
  ALLOWED_VIDEO_FILE_TYPES,
  ALLOWED_WORD_FILE_TYPES,
} from "./fileTypes";

export const RICH_TEXT_RESOURCE_TYPE = {
  IMAGE: "image",
  VIDEO: "video",
  PRESENTATION: "presentation",
  PDF: "pdf",
  DOCUMENT: "document",
  OTHER: "other",
} as const;

export type RichTextResourceType =
  (typeof RICH_TEXT_RESOURCE_TYPE)[keyof typeof RICH_TEXT_RESOURCE_TYPE];

export const RICH_TEXT_RESOURCE_DISPLAY_MODE = {
  PREVIEW: "preview",
  DOWNLOAD: "download",
} as const;

export type RichTextResourceDisplayMode =
  (typeof RICH_TEXT_RESOURCE_DISPLAY_MODE)[keyof typeof RICH_TEXT_RESOURCE_DISPLAY_MODE];

export function classifyRichTextResourceType(mimeType: string): RichTextResourceType {
  if (ALLOWED_LESSON_IMAGE_FILE_TYPES.includes(mimeType)) return RICH_TEXT_RESOURCE_TYPE.IMAGE;
  if (ALLOWED_VIDEO_FILE_TYPES.includes(mimeType)) return RICH_TEXT_RESOURCE_TYPE.VIDEO;
  if (ALLOWED_PRESENTATION_FILE_TYPES.includes(mimeType))
    return RICH_TEXT_RESOURCE_TYPE.PRESENTATION;
  if (ALLOWED_PDF_FILE_TYPES.includes(mimeType)) return RICH_TEXT_RESOURCE_TYPE.PDF;
  if (ALLOWED_WORD_FILE_TYPES.includes(mimeType) || ALLOWED_EXCEL_FILE_TYPES.includes(mimeType))
    return RICH_TEXT_RESOURCE_TYPE.DOCUMENT;
  return RICH_TEXT_RESOURCE_TYPE.OTHER;
}
