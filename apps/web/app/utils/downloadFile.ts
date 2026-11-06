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

/** Lets the browser download a file URL natively, with its own progress, without buffering it in memory. */
export const triggerBrowserDownloadFromUrl = (url: string) => {
  const linkElement = document.createElement("a");

  linkElement.href = url;
  linkElement.rel = "noopener";
  document.body.appendChild(linkElement);
  linkElement.click();
  document.body.removeChild(linkElement);
};

export const triggerBrowserDownload = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const linkElement = document.createElement("a");

  linkElement.href = url;
  linkElement.download = filename;
  document.body.appendChild(linkElement);
  linkElement.click();
  document.body.removeChild(linkElement);

  URL.revokeObjectURL(url);
};
