import { Logger } from "@nestjs/common";

import type { Response } from "express";
import type { FileStreamPayload } from "src/file/types/file-stream.type";

const logger = new Logger("FileDelivery");

export const streamFileToResponse = (res: Response, file: FileStreamPayload) => {
  let streamTimeout: NodeJS.Timeout | undefined;

  const clearStreamTimeout = () => {
    if (!streamTimeout) return;

    clearTimeout(streamTimeout);
    streamTimeout = undefined;
  };

  const destroyFileStream = () => {
    if (file.stream.destroyed) return;
    file.stream.destroy();
  };

  const handleResponseError = (error: Error) => {
    clearStreamTimeout();

    logger.error(
      `File response failed: ${error instanceof Error ? error.message : String(error)}`,
      error instanceof Error ? error.stack : undefined,
    );

    destroyFileStream();
  };

  const handleResponseClose = () => {
    clearStreamTimeout();

    if (!res.writableEnded) destroyFileStream();
  };

  const resetStreamTimeout = () => {
    if (!file.streamTimeoutMs) return;

    clearStreamTimeout();

    streamTimeout = setTimeout(() => {
      const message = `File stream timed out after ${file.streamTimeoutMs}ms`;
      logger.error(message);
      file.stream.destroy(new Error(message));
    }, file.streamTimeoutMs);
  };

  resetStreamTimeout();

  file.stream.on("data", resetStreamTimeout);
  file.stream.on("end", clearStreamTimeout);
  file.stream.on("close", clearStreamTimeout);
  res.once("error", handleResponseError);
  res.once("close", handleResponseClose);
  res.once("finish", clearStreamTimeout);

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

  file.stream.on("error", (error) => {
    clearStreamTimeout();

    logger.error(
      `File stream failed: ${error instanceof Error ? error.message : String(error)}`,
      error instanceof Error ? error.stack : undefined,
    );

    if (!res.headersSent) {
      res.status(500).end();
      return;
    }

    res.end();
  });

  file.stream.pipe(res);
};
