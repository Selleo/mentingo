import { Readable } from "stream";

import {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  UploadPartCommand,
} from "@aws-sdk/client-s3";
import { Logger } from "@nestjs/common";

import { S3_MULTIPART_UPLOAD_CONCURRENCY, S3_OPERATION_TIMEOUT_MS } from "src/s3/s3.constants";

import { S3Service } from "./s3.service";

import type { ConfigService } from "@nestjs/config";

type S3ClientMock = {
  send: jest.Mock;
};

const buildConfigService = () =>
  ({
    get: jest.fn((key: string) => {
      const config: Record<string, string> = {
        "s3.S3_ENDPOINT": "http://localhost:9100",
        "s3.S3_REGION": "eu-central-1",
        "s3.S3_ACCESS_KEY_ID": "minioadmin",
        "s3.S3_SECRET_ACCESS_KEY": "minioadmin",
        "s3.S3_BUCKET_NAME": "bucket",
      };

      return config[key];
    }),
  }) as unknown as ConfigService;

const setS3Client = (service: S3Service, client: S3ClientMock) => {
  (service as unknown as { s3Client: S3ClientMock }).s3Client = client;
};

describe("S3Service", () => {
  let loggerErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    loggerErrorSpy = jest.spyOn(Logger.prototype, "error").mockImplementation();
  });

  afterEach(() => {
    jest.useRealTimers();
    loggerErrorSpy.mockRestore();
  });

  it("aborts S3 operations after the S3 operation timeout", async () => {
    jest.useFakeTimers();

    const service = new S3Service(buildConfigService());
    const send = jest.fn(
      (_command: unknown, options?: { abortSignal?: AbortSignal }) =>
        new Promise((_resolve, reject) => {
          options?.abortSignal?.addEventListener("abort", () => {
            reject(new Error("aborted"));
          });
        }),
    );

    setS3Client(service, { send });

    const request = service.getFileBuffer("tenant/file.pdf");
    const assertion = expect(request).rejects.toThrow(
      `S3 getFileBuffer for key "tenant/file.pdf" timed out after ${S3_OPERATION_TIMEOUT_MS}ms`,
    );

    await jest.advanceTimersByTimeAsync(S3_OPERATION_TIMEOUT_MS);
    await assertion;
    expect(send.mock.calls[0][1]?.abortSignal).toBeInstanceOf(AbortSignal);
    expect(loggerErrorSpy).toHaveBeenCalledWith(
      `S3 getFileBuffer for key "tenant/file.pdf" timed out after ${S3_OPERATION_TIMEOUT_MS}ms`,
    );
  });

  it("passes the S3 operation timeout to file streams", async () => {
    const service = new S3Service(buildConfigService());
    const send = jest.fn().mockResolvedValue({
      Body: Readable.from(["file-content"]),
      ContentType: "text/plain",
      ContentLength: 12,
      $metadata: { httpStatusCode: 200 },
    });

    setS3Client(service, { send });

    const stream = await service.getFileStream("tenant/file.txt");

    expect(stream.streamTimeoutMs).toBe(S3_OPERATION_TIMEOUT_MS);
  });

  const PART_SIZE = 5 * 1024 * 1024;
  const CHUNK_SIZE = 1024 * 1024;

  function arrangeMultipartUpload({ failingPartNumber }: { failingPartNumber?: number } = {}) {
    const service = new S3Service(buildConfigService());
    const client = (service as unknown as { s3Client: { send: (...args: unknown[]) => unknown } })
      .s3Client;
    const uploadedParts: Array<{ partNumber: number; byteLength: number }> = [];
    let partsInFlight = 0;
    let maxPartsInFlight = 0;
    const send = jest.spyOn(client, "send").mockImplementation(async (command: unknown) => {
      if (command instanceof CreateMultipartUploadCommand) return { UploadId: "upload-1" };
      if (command instanceof UploadPartCommand) {
        const partNumber = command.input.PartNumber ?? 0;
        partsInFlight += 1;
        maxPartsInFlight = Math.max(maxPartsInFlight, partsInFlight);
        await new Promise((resolve) => setTimeout(resolve, 5));
        partsInFlight -= 1;
        if (partNumber === failingPartNumber) throw new Error("part upload failed");
        uploadedParts.push({ partNumber, byteLength: (command.input.Body as Buffer).length });
        return { ETag: `"etag-${partNumber}"` };
      }
      return {};
    });

    const sentCommands = <T>(commandType: new (...args: never[]) => T): T[] =>
      send.mock.calls
        .map(([command]) => command)
        .filter((command): command is T => command instanceof commandType);

    return {
      service,
      uploadedParts,
      sentCommands,
      getMaxPartsInFlight: () => maxPartsInFlight,
    };
  }

  const megabyteChunks = (chunkCount: number) =>
    Readable.from(Array.from({ length: chunkCount }, () => Buffer.alloc(CHUNK_SIZE, 1)));

  it("joins small chunks into full parts and completes them in order", async () => {
    const { service, uploadedParts, sentCommands } = arrangeMultipartUpload();

    await service.uploadStreamMultipart(
      megabyteChunks(16),
      "tenant/archive.zip",
      "application/zip",
      { partSize: PART_SIZE },
    );

    expect([...uploadedParts].sort((left, right) => left.partNumber - right.partNumber)).toEqual([
      { partNumber: 1, byteLength: PART_SIZE },
      { partNumber: 2, byteLength: PART_SIZE },
      { partNumber: 3, byteLength: PART_SIZE },
      { partNumber: 4, byteLength: CHUNK_SIZE },
    ]);
    const [completeCommand] = sentCommands(CompleteMultipartUploadCommand);
    expect(completeCommand?.input.MultipartUpload?.Parts).toEqual(
      [1, 2, 3, 4].map((partNumber) =>
        expect.objectContaining({ ETag: `"etag-${partNumber}"`, PartNumber: partNumber }),
      ),
    );
  });

  it("uploads several parts at once, never more than the concurrency limit", async () => {
    const { service, getMaxPartsInFlight } = arrangeMultipartUpload();

    await service.uploadStreamMultipart(
      megabyteChunks(30),
      "tenant/archive.zip",
      "application/zip",
      { partSize: PART_SIZE },
    );

    expect(getMaxPartsInFlight()).toBeGreaterThan(1);
    expect(getMaxPartsInFlight()).toBeLessThanOrEqual(S3_MULTIPART_UPLOAD_CONCURRENCY);
  });

  it("aborts the upload and reports the error when a part fails", async () => {
    const { service, sentCommands } = arrangeMultipartUpload({ failingPartNumber: 2 });

    await expect(
      service.uploadStreamMultipart(megabyteChunks(16), "tenant/archive.zip", "application/zip", {
        partSize: PART_SIZE,
      }),
    ).rejects.toThrow("part upload failed");

    expect(sentCommands(AbortMultipartUploadCommand)).toHaveLength(1);
    expect(sentCommands(CompleteMultipartUploadCommand)).toHaveLength(0);
  });

  it("reports the bytes uploaded as parts finish", async () => {
    const { service } = arrangeMultipartUpload();
    const onUploadedBytes = jest.fn();

    await service.uploadStreamMultipart(
      megabyteChunks(11),
      "tenant/archive.zip",
      "application/zip",
      {
        partSize: PART_SIZE,
        onUploadedBytes,
      },
    );

    expect(onUploadedBytes.mock.calls.at(-1)).toEqual([11 * CHUNK_SIZE]);
    expect(onUploadedBytes.mock.calls.map(([uploadedBytes]) => uploadedBytes)).toEqual(
      [...onUploadedBytes.mock.calls.map(([uploadedBytes]) => uploadedBytes)].sort(
        (left, right) => left - right,
      ),
    );
  });
});
