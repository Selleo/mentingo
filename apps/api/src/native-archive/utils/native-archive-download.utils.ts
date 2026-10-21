import { NATIVE_ARCHIVE_DOWNLOAD_FILENAME } from "../native-archive.constants";

import type { Response } from "express";
import type { FileStreamPayload } from "src/file/types/file-stream.type";

export function streamNativeArchiveDownload(file: FileStreamPayload, response: Response) {
  response.setHeader("Content-Type", "application/zip");
  response.setHeader(
    "Content-Disposition",
    `attachment; filename="${NATIVE_ARCHIVE_DOWNLOAD_FILENAME}"`,
  );
  response.setHeader("Cache-Control", "private, no-store");

  if (file.contentLength) response.setHeader("Content-Length", file.contentLength);
  file.stream.pipe(response);
}
