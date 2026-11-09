import {
  ALLOWED_AUDIO_FILE_TYPES,
  ALLOWED_LESSON_IMAGE_FILE_TYPES,
  ALLOWED_VIDEO_FILE_TYPES,
} from "@repo/shared";

import type { FileContentDisposition } from "src/file/types/file-stream.type";

const INLINE_CONTENT_TYPES = new Set<string>([
  ...ALLOWED_LESSON_IMAGE_FILE_TYPES.filter((type) => type !== "image/svg+xml"),
  ...ALLOWED_AUDIO_FILE_TYPES,
  ...ALLOWED_VIDEO_FILE_TYPES,
]);

export const uploadContentDisposition = (contentType?: string): FileContentDisposition => {
  const mime = contentType?.split(";")[0].trim().toLowerCase();

  return mime && INLINE_CONTENT_TYPES.has(mime) ? "inline" : "attachment";
};
