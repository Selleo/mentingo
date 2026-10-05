const INLINE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/bmp",
  "image/tiff",
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/ogg",
  "audio/aac",
  "audio/mp4",
  "video/mp4",
  "video/quicktime",
  "video/webm",
  "video/ogg",
]);

export function uploadContentDisposition(contentType?: string): "inline" | "attachment" {
  const normalized = contentType?.split(";", 1)[0].trim().toLowerCase();
  return normalized && INLINE_TYPES.has(normalized) ? "inline" : "attachment";
}
