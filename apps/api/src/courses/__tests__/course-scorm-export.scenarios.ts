export const SHARED_IMAGE_REFERENCE = "exports/shared-image.png";

export const RICH_TEXT_ASSET_KINDS = {
  VIDEO: "video",
  DOWNLOADABLE_FILE: "downloadable-file",
  PDF_PREVIEW: "pdf-preview",
} as const;

export const RICH_TEXT_ASSETS = [
  {
    kind: RICH_TEXT_ASSET_KINDS.VIDEO,
    reference: "lesson-content/video.mp4",
    contentType: "video/mp4",
    fileName: "video.mp4",
  },
  {
    kind: RICH_TEXT_ASSET_KINDS.DOWNLOADABLE_FILE,
    reference: "lesson-content/document.pdf",
    contentType: "application/pdf",
    fileName: "document.pdf",
  },
  {
    kind: RICH_TEXT_ASSET_KINDS.PDF_PREVIEW,
    reference: "lesson-content/slides.pptx",
    contentType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    fileName: "slides.pptx",
  },
] as const;
