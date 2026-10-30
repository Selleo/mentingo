export const ALLOWED_LESSON_IMAGE_FILE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/bmp",
  "image/tiff",
];

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

export const AUDIO_UPLOAD_MAX_BYTES = 200 * 1024 * 1024;

/** Browser upload classification only, never a substitute for content validation. */
export const isAudioFile = (file: { type: string; name: string }): boolean => {
  const mime = file.type.toLowerCase().split(";")[0].trim();
  if ((ALLOWED_AUDIO_FILE_TYPES as readonly string[]).includes(mime)) return true;
  return (
    (!mime || mime === "application/octet-stream") &&
    /\.(mp3|m4a|wav|ogg|oga|opus|webm)$/i.test(file.name)
  );
};

export const ALLOWED_VIDEO_FILE_TYPES = [
  "video/mp4",
  "video/quicktime",
  "video/webm",
  "video/ogg",
  "video/avi",
  "video/mov",
  "video/wmv",
];

export const ALLOWED_PRESENTATION_FILE_TYPES = [
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.oasis.opendocument.presentation",
];

export const ALLOWED_EXCEL_FILE_TYPES = [
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/csv",
];

export const ALLOWED_WORD_FILE_TYPES = [
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

export const ALLOWED_PDF_FILE_TYPES = ["application/pdf"];

export const ALLOWED_CERTIFICATE_SIGNATURE_FILE_TYPES = [
  "image/png",
  "image/svg+xml",
  "application/xml",
] as const;

/** File ingestion supported by the durable course-authoring source pipeline. */
export const COURSE_AUTHORING_SOURCE_FILE_TYPES = [
  ...ALLOWED_PDF_FILE_TYPES,
  ...ALLOWED_WORD_FILE_TYPES.filter((type) => type !== "application/msword"),
  "text/plain",
  "text/markdown",
  "text/x-markdown",
] as const;
export const MAX_COURSE_AUTHORING_SOURCE_SIZE = 25 * 1024 * 1024;
