import { Readable } from "node:stream";

import { BadRequestException, ServiceUnavailableException } from "@nestjs/common";

import { dbAls } from "src/storage/db/db-als.store";

import { PresentationPreviewService } from "./presentation-preview.service";

import type { PresentationConverterClient } from "./presentation-converter.client";
import type { S3Service } from "src/s3/s3.service";

const tenant = "tenant-123";
const key = `${tenant}/slides.pptx`;
const preview = `${tenant}/slides.preview.pdf`;
const pdf = Buffer.from("%PDF-1.4\nexample");

const deferred = () => {
  let resolve!: (value: Buffer) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<Buffer>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
};

describe("PresentationPreviewService", () => {
  let service: PresentationPreviewService;
  let s3: { getFileExists: jest.Mock; getFileStream: jest.Mock; uploadFile: jest.Mock };
  let converter: { convert: jest.Mock };

  beforeEach(() => {
    s3 = {
      getFileExists: jest.fn().mockResolvedValue(false),
      getFileStream: jest.fn().mockImplementation(async () => ({
        stream: Readable.from([Buffer.from("presentation")]),
        contentLength: 12,
      })),
      uploadFile: jest.fn().mockResolvedValue(undefined),
    };
    converter = { convert: jest.fn().mockResolvedValue(pdf) };
    service = new PresentationPreviewService(
      s3 as unknown as S3Service,
      converter as unknown as PresentationConverterClient,
    );
  });

  const scoped = <T>(fn: () => Promise<T>) =>
    dbAls.run({ tenantId: tenant }, () => Promise.resolve().then(fn));

  it("rejects foreign, remote, unsupported and missing-context keys before cache access", async () => {
    for (const invalid of [
      "other/slides.pptx",
      "https://evil/slides.pptx",
      `${tenant}/slides.pdf`,
      `${tenant}/slides.pptx/other`,
    ]) {
      await expect(scoped(() => service.getOrCreate(invalid))).rejects.toBeInstanceOf(
        BadRequestException,
      );
    }
    await expect(Promise.resolve().then(() => service.getOrCreate(key))).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(s3.getFileExists).not.toHaveBeenCalled();
  });

  it("returns cached preview without fetching original", async () => {
    s3.getFileExists.mockResolvedValue(true);
    await expect(scoped(() => service.getOrCreate(key))).resolves.toBe(preview);
    expect(s3.getFileStream).not.toHaveBeenCalled();
  });

  it("converts ODP and stores only validated PDF at extension-replaced key", async () => {
    await expect(scoped(() => service.getOrCreate(`${tenant}/slides.ODP`))).resolves.toBe(
      `${tenant}/slides.preview.pdf`,
    );
    expect(converter.convert).toHaveBeenCalledWith(Buffer.from("presentation"), "odp");
    expect(s3.uploadFile).toHaveBeenCalledWith(pdf, preview, "application/pdf");
  });

  it("rejects declared and streamed oversize and empty input without conversion", async () => {
    const limit = 100 * 1024 * 1024;
    s3.getFileStream.mockResolvedValueOnce({ stream: Readable.from([]), contentLength: limit + 1 });
    await expect(scoped(() => service.getOrCreate(key))).rejects.toThrow();
    s3.getFileStream.mockResolvedValueOnce({
      stream: Readable.from([Buffer.alloc(limit), Buffer.from("x")]),
    });
    await expect(scoped(() => service.getOrCreate(key))).rejects.toThrow();
    s3.getFileStream.mockResolvedValueOnce({ stream: Readable.from([]), contentLength: 0 });
    await expect(scoped(() => service.getOrCreate(key))).rejects.toThrow();
    expect(converter.convert).not.toHaveBeenCalled();
  });

  it("does not expose S3 or converter errors and does not cache invalid output", async () => {
    s3.getFileStream.mockRejectedValueOnce(new Error("private storage detail"));
    await expect(scoped(() => service.getOrCreate(key))).rejects.toThrow(
      "Presentation conversion failed",
    );
    converter.convert.mockResolvedValueOnce(Buffer.from("not a PDF"));
    await expect(scoped(() => service.getOrCreate(key))).rejects.toThrow(
      "Presentation conversion failed",
    );
    expect(s3.uploadFile).not.toHaveBeenCalled();
    await expect(scoped(() => service.getOrCreate(key))).resolves.toBe(preview);
  });

  it("rejects oversized converter output before writing the cache", async () => {
    converter.convert.mockResolvedValueOnce(Buffer.concat([pdf, Buffer.alloc(100 * 1024 * 1024)]));
    await expect(scoped(() => service.getOrCreate(key))).rejects.toThrow(
      "Presentation conversion failed",
    );
    expect(s3.uploadFile).not.toHaveBeenCalled();
  });

  it("aborts a stalled S3 stream and permits a retry", async () => {
    jest.useFakeTimers();
    try {
      const stream = new Readable({ read() {} });
      s3.getFileStream.mockResolvedValueOnce({ stream, contentLength: 12 });
      const attempt = scoped(() => service.getOrCreate(key));
      const failed = expect(attempt).rejects.toThrow("Presentation conversion failed");
      await jest.advanceTimersByTimeAsync(300_001);
      await failed;
      expect(stream.destroyed).toBe(true);
      await expect(scoped(() => service.getOrCreate(key))).resolves.toBe(preview);
    } finally {
      jest.useRealTimers();
    }
  });

  it("joins same-key work, rejects fifth distinct pending key, and retries after failure", async () => {
    const pending = deferred();
    converter.convert.mockReturnValueOnce(pending.promise);
    const first = scoped(() => service.getOrCreate(key));
    const joined = scoped(() => service.getOrCreate(key));
    // Allow the cache lookup and streaming phase to reach the converter.
    await new Promise((resolve) => setImmediate(resolve));
    expect(s3.getFileExists).toHaveBeenCalledTimes(1);
    const others = ["b", "c", "d"].map((name) =>
      scoped(() => service.getOrCreate(`${tenant}/${name}.pptx`)),
    );
    await expect(scoped(() => service.getOrCreate(`${tenant}/e.pptx`))).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    pending.reject(new Error("converter unavailable"));
    await expect(first).rejects.toThrow();
    await expect(joined).rejects.toThrow();
    await Promise.all(others);
    await expect(scoped(() => service.getOrCreate(key))).resolves.toBe(preview);
    expect(s3.uploadFile).toHaveBeenCalledTimes(4);
  });
});
