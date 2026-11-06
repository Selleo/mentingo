// SVG uploads are accepted but rasterized to WebP by the API before storage.
export const ALLOWED_LESSON_IMAGE_FILE_TYPES: readonly string[] = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/svg+xml",
];

export const ALLOWED_IMAGE_FILE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp", ".svg"] as const;

export const SUPPORTED_IMAGE_VARIANT_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

// Containers/codecs are verified server-side; raw AAC is deliberately unsupported.
export const ALLOWED_AUDIO_FILE_TYPES = [
  "audio/mpeg",
  "audio/mp3",
  "audio/x-mp3",
  "audio/mp4",
  "audio/m4a",
  "audio/x-m4a",
  "audio/wav",
  "audio/wave",
  "audio/x-wav",
  "audio/vnd.wave",
  "audio/ogg",
  "application/ogg",
  "audio/webm",
] as const;

export const AUDIO_FILE_EXTENSIONS = [
  ".mp3",
  ".m4a",
  ".wav",
  ".ogg",
  ".oga",
  ".opus",
  ".webm",
] as const;

/** Browser upload classification only, never a substitute for content validation. */
export const isAudioFile = (file: { type: string; name: string }): boolean => {
  const mime = file.type.toLowerCase().split(";")[0].trim();
  if ((ALLOWED_AUDIO_FILE_TYPES as readonly string[]).includes(mime)) return true;
  const fileName = file.name.toLowerCase();
  return (
    (!mime || mime === "application/octet-stream") &&
    AUDIO_FILE_EXTENSIONS.some((extension) => fileName.endsWith(extension))
  );
};

export const ALLOWED_VIDEO_FILE_TYPES: readonly string[] = [
  "video/mp4",
  "video/quicktime",
  "video/webm",
  "video/ogg",
  "video/mov",
];

export const ALLOWED_VIDEO_FILE_EXTENSIONS = [".mp4", ".mov", ".qt", ".webm", ".ogg"] as const;

export const ALLOWED_PRESENTATION_FILE_TYPES: readonly string[] = [
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.oasis.opendocument.presentation",
];

export const ALLOWED_PRESENTATION_FILE_EXTENSIONS = [".pptx", ".odp"] as const;

export const ALLOWED_EXCEL_FILE_TYPES: readonly string[] = [
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/csv",
];

export const ALLOWED_SPREADSHEET_FILE_EXTENSIONS = [".xlsx", ".csv"] as const;

export const ALLOWED_WORD_FILE_TYPES: readonly string[] = [
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

export const ALLOWED_WORD_FILE_EXTENSIONS = [".docx"] as const;

export const ALLOWED_PDF_FILE_TYPES: readonly string[] = ["application/pdf"];

export const ALLOWED_PDF_FILE_EXTENSIONS = [".pdf"] as const;

/** File ingestion supported by the durable course-authoring source pipeline. */
export const COURSE_AUTHORING_SOURCE_FILE_TYPES = [
  ...ALLOWED_PDF_FILE_TYPES,
  ...ALLOWED_WORD_FILE_TYPES,
  "text/plain",
  "text/markdown",
  "text/x-markdown",
] as const;
