export const extractFilenameFromContentDisposition = (
  contentDisposition?: string | null,
): string | null => {
  if (!contentDisposition) return null;

  const utf8Filename = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
  if (utf8Filename) return decodeURIComponent(utf8Filename).trim();

  const quotedFilename = contentDisposition.match(/filename="([^"]+)"/i)?.[1];
  if (quotedFilename) return quotedFilename.trim();

  const plainFilename = contentDisposition.match(/filename=([^;]+)/i)?.[1];
  if (plainFilename) return plainFilename.trim();

  return null;
};
