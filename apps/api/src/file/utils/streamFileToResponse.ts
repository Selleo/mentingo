import type { Response } from "express";
import type { Readable } from "stream";

type StreamableFile = {
  stream: Readable;
  contentType?: string;
  contentLength?: number;
  contentRange?: string;
  acceptRanges?: string;
  etag?: string;
  lastModified?: Date;
};

export const streamFileToResponse = (res: Response, file: StreamableFile) => {
  res.setHeader("Accept-Ranges", file.acceptRanges ?? "bytes");

  if (file.contentType) {
    res.setHeader("Content-Type", file.contentType);
  }

  if (typeof file.contentLength === "number") {
    res.setHeader("Content-Length", String(file.contentLength));
  }

  if (file.contentRange) {
    res.setHeader("Content-Range", file.contentRange);
    res.status(206);
  } else {
    res.status(200);
  }

  if (file.etag) {
    res.setHeader("ETag", file.etag);
  }

  if (file.lastModified) {
    res.setHeader("Last-Modified", file.lastModified.toUTCString());
  }

  file.stream.on("error", () => {
    if (!res.headersSent) {
      res.status(500).end();
      return;
    }

    res.end();
  });

  file.stream.pipe(res);
};
