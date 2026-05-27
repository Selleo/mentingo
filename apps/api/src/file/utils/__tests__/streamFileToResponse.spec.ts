import { PassThrough, Writable } from "stream";

import { Logger } from "@nestjs/common";

import { streamFileToResponse } from "../streamFileToResponse";

import type { Response } from "express";

class MockResponse extends Writable {
  headersSent = false;
  headers = new Map<string, string>();
  statusCode = 200;

  _write(_chunk: unknown, _encoding: BufferEncoding, callback: (error?: Error | null) => void) {
    this.headersSent = true;
    callback();
  }

  setHeader(name: string, value: string) {
    this.headers.set(name, value);
    return this;
  }

  status(code: number) {
    this.statusCode = code;
    return this;
  }
}

describe("streamFileToResponse", () => {
  let loggerErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    loggerErrorSpy = jest.spyOn(Logger.prototype, "error").mockImplementation();
  });

  afterEach(() => {
    loggerErrorSpy.mockRestore();
  });

  it("destroys the file stream when the response emits an error", () => {
    const fileStream = new PassThrough();
    const response = new MockResponse();

    streamFileToResponse(response as unknown as Response, { stream: fileStream });

    response.emit("error", new Error("socket failed"));

    expect(fileStream.destroyed).toBe(true);
    expect(loggerErrorSpy).toHaveBeenCalledWith(
      "File response failed: socket failed",
      expect.any(String),
    );
  });

  it("destroys the file stream when the response closes before completion", () => {
    const fileStream = new PassThrough();
    const response = new MockResponse();

    streamFileToResponse(response as unknown as Response, { stream: fileStream });

    response.emit("close");

    expect(fileStream.destroyed).toBe(true);
    expect(loggerErrorSpy).not.toHaveBeenCalled();
  });
});
