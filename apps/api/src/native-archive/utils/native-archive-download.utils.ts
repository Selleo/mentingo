
import type { NativeArchiveDownload } from "../native-archive.types";
import type { Response } from "express";

export function streamNativeArchiveDownload(
  { file, filename }: NativeArchiveDownload,
  response: Response,
) {
  response.setHeader("Content-Type", "application/zip");
  response.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  response.setHeader("Cache-Control", "private, no-store");

  if (file.contentLength) response.setHeader("Content-Length", file.contentLength);
  file.stream.pipe(response);
}
