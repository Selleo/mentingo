import { Readable } from "stream";

import { Logger } from "@nestjs/common";

import { S3_OPERATION_TIMEOUT_MS } from "src/s3/s3.constants";

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
});
