import type { Readable } from "stream";

export type FileContentDisposition = "inline" | "attachment";

export type FileStreamPayload = {
  stream: Readable;
  contentType?: string;
  contentDisposition?: FileContentDisposition;
  contentLength?: number;
  contentRange?: string;
  acceptRanges?: string;
  etag?: string;
  lastModified?: Date;
  statusCode?: number;
  streamTimeoutMs?: number;
};
