import type { Readable } from "stream";

export type FileStreamPayload = {
  stream: Readable;
  contentType?: string;
  contentLength?: number;
  contentRange?: string;
  acceptRanges?: string;
  etag?: string;
  lastModified?: Date;
  statusCode?: number;
};
