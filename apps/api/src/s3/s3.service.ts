import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
  DeleteObjectCommand,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
  CopyObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
} from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Inject, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { DEFAULT_TUS_CHUNK_SIZE } from "@repo/shared";

import { S3_MULTIPART_UPLOAD_CONCURRENCY, S3_OPERATION_TIMEOUT_MS } from "src/s3/s3.constants";

import type { S3StreamUploadOptions } from "./s3.types";
import type { FileStreamPayload } from "src/file/types/file-stream.type";
import type { PassThrough, Readable } from "stream";

@Injectable()
export class S3Service {
  private readonly logger = new Logger(S3Service.name);
  private s3Client: S3Client;
  private readonly bucketName: string;

  constructor(@Inject(ConfigService) private configService: ConfigService) {
    const config = this.loadS3Config();

    this.s3Client = new S3Client({
      region: config.region,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
      forcePathStyle: true,
      ...(config.endpoint && { endpoint: config.endpoint }),
    });

    this.bucketName = config.bucketName;

    if (!this.s3Client) {
      throw new Error("S3 client is not initialized. Please check your configuration.");
    }
  }

  private loadS3Config() {
    const s3Config = this.getS3Config("s3.S3");
    if (this.isValidS3Config(s3Config)) {
      return s3Config;
    }

    const awsConfig = this.getS3Config("aws.AWS");
    return awsConfig;
  }

  private getS3Config(prefix: string) {
    return {
      endpoint: this.configService.get<string>(`${prefix}_ENDPOINT`) || "",
      region: this.configService.get<string>(`${prefix}_REGION`) || "us-east-1",
      accessKeyId: this.configService.get<string>(`${prefix}_ACCESS_KEY_ID`) || "",
      secretAccessKey: this.configService.get<string>(`${prefix}_SECRET_ACCESS_KEY`) || "",
      bucketName: this.configService.get<string>(`${prefix}_BUCKET_NAME`) || "",
    };
  }

  private isValidS3Config(config: {
    endpoint: string;
    region: string;
    accessKeyId: string;
    secretAccessKey: string;
    bucketName: string;
  }): boolean {
    return !!(
      config.region &&
      config.accessKeyId &&
      config.secretAccessKey &&
      config.bucketName &&
      config.endpoint
    );
  }

  private async sendWithTimeout<T>(
    operation: string,
    sendOperation: (abortSignal: AbortSignal) => Promise<T>,
    context?: { key?: string; ignoreNotFound?: boolean },
  ): Promise<T> {
    const abortController = new AbortController();

    let timedOut = false;

    const timeout = setTimeout(() => {
      timedOut = true;
      abortController.abort();
    }, S3_OPERATION_TIMEOUT_MS);

    try {
      return await sendOperation(abortController.signal);
    } catch (error) {
      const message = this.getErrorMessage(error);
      const statusCode = this.getErrorStatusCode(error);
      const keyContext = context?.key ? ` for key "${context.key}"` : "";

      if (timedOut) {
        const timeoutMessage = `S3 ${operation}${keyContext} timed out after ${S3_OPERATION_TIMEOUT_MS}ms`;
        this.logger.error(timeoutMessage);
        throw new Error(timeoutMessage);
      }

      if (!context?.ignoreNotFound || !this.isNotFoundError(error)) {
        this.logger.error(
          `S3 ${operation}${keyContext} failed${
            statusCode ? ` with status ${statusCode}` : ""
          }: ${message}`,
          error instanceof Error ? error.stack : undefined,
        );
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  private getErrorMessage(error: unknown) {
    return error instanceof Error ? error.message : String(error);
  }

  private getErrorStatusCode(error: unknown) {
    if (!error || typeof error !== "object" || !("$metadata" in error)) return undefined;

    const metadata = (error as { $metadata?: { httpStatusCode?: number } }).$metadata;
    return metadata?.httpStatusCode;
  }

  private isNotFoundError(error: unknown) {
    if (!error || typeof error !== "object") return false;

    const maybeError = error as {
      $metadata?: { httpStatusCode?: number };
      name?: string;
      Code?: string;
      code?: string;
    };

    return (
      maybeError.$metadata?.httpStatusCode === 404 ||
      maybeError.name === "NotFound" ||
      maybeError.name === "NoSuchKey" ||
      maybeError.Code === "NoSuchKey" ||
      maybeError.code === "NoSuchKey"
    );
  }

  isConfigured(): boolean {
    const config = this.loadS3Config();
    return Boolean(
      config.region && config.accessKeyId && config.secretAccessKey && config.bucketName,
    );
  }

  /** With a download filename, the URL makes browsers save the object instead of opening it. */
  async getSignedUrl(
    key: string,
    expiresIn: number = 3600,
    { downloadFilename }: { downloadFilename?: string } = {},
  ): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      ...(downloadFilename && {
        ResponseContentDisposition: `attachment; filename="${downloadFilename}"`,
      }),
    });

    return getSignedUrl(this.s3Client, command, { expiresIn });
  }

  async getFileContent(key: string): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: key,
    });

    const response = await this.sendWithTimeout(
      "getFileContent",
      (abortSignal) => this.s3Client.send(command, { abortSignal }),
      { key },
    );

    return response.Body?.transformToString() || "";
  }

  async getFileBuffer(key: string): Promise<Buffer> {
    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: key,
    });

    const response = await this.sendWithTimeout(
      "getFileBuffer",
      (abortSignal) => this.s3Client.send(command, { abortSignal }),
      { key },
    );

    const bytes = await response.Body?.transformToByteArray();
    return Buffer.from(bytes || []);
  }

  async uploadFile(
    fileBuffer: Buffer | PassThrough | Readable,
    key: string,
    contentType: string,
    contentLength?: number,
  ) {
    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      Body: fileBuffer,
      ContentType: contentType,
      ...(typeof contentLength === "number" ? { ContentLength: contentLength } : {}),
    });

    await this.sendWithTimeout(
      "uploadFile",
      (abortSignal) => this.s3Client.send(command, { abortSignal }),
      { key },
    );
  }

  async copyFile(sourceKey: string, destinationKey: string, contentType?: string) {
    const command = new CopyObjectCommand({
      Bucket: this.bucketName,
      CopySource: `${this.bucketName}/${encodeURIComponent(sourceKey).replace(/%2F/g, "/")}`,
      Key: destinationKey,
      ...(contentType ? { ContentType: contentType, MetadataDirective: "REPLACE" } : {}),
    });

    await this.sendWithTimeout(
      "copyFile",
      (abortSignal) => this.s3Client.send(command, { abortSignal }),
      { key: destinationKey },
    );
  }

  async deleteFile(key: string): Promise<void> {
    const command = new DeleteObjectCommand({
      Bucket: this.bucketName,
      Key: key,
    });

    await this.sendWithTimeout(
      "deleteFile",
      (abortSignal) => this.s3Client.send(command, { abortSignal }),
      { key },
    );
  }

  async createMultipartUpload(key: string, contentType: string): Promise<{ uploadId: string }> {
    const command = new CreateMultipartUploadCommand({
      Bucket: this.bucketName,
      Key: key,
      ContentType: contentType,
    });

    const response = await this.sendWithTimeout(
      "createMultipartUpload",
      (abortSignal) => this.s3Client.send(command, { abortSignal }),
      { key },
    );

    if (!response.UploadId) {
      throw new Error("Failed to initialize multipart upload");
    }

    return { uploadId: response.UploadId };
  }

  async getPresignedUploadPartUrl(
    key: string,
    uploadId: string,
    partNumber: number,
    expiresIn: number = 3600,
  ): Promise<string> {
    const command = new UploadPartCommand({
      Bucket: this.bucketName,
      Key: key,
      UploadId: uploadId,
      PartNumber: partNumber,
    });

    return getSignedUrl(this.s3Client, command, { expiresIn });
  }

  async uploadMultipartPart(
    key: string,
    uploadId: string,
    partNumber: number,
    body: Buffer,
  ): Promise<string> {
    const command = new UploadPartCommand({
      Bucket: this.bucketName,
      Key: key,
      UploadId: uploadId,
      PartNumber: partNumber,
      Body: body,
    });

    const response = await this.sendWithTimeout(
      "uploadMultipartPart",
      (abortSignal) => this.s3Client.send(command, { abortSignal }),
      { key },
    );

    if (!response.ETag) {
      throw new Error("Failed to upload multipart part");
    }

    return response.ETag.replace(/"/g, "");
  }

  async completeMultipartUpload(
    key: string,
    uploadId: string,
    parts: Array<{ ETag: string; PartNumber: number }>,
  ): Promise<void> {
    const command = new CompleteMultipartUploadCommand({
      Bucket: this.bucketName,
      Key: key,
      UploadId: uploadId,
      MultipartUpload: { Parts: parts },
    });

    await this.sendWithTimeout(
      "completeMultipartUpload",
      (abortSignal) => this.s3Client.send(command, { abortSignal }),
      { key },
    );
  }

  async abortMultipartUpload(key: string, uploadId: string): Promise<void> {
    const command = new AbortMultipartUploadCommand({
      Bucket: this.bucketName,
      Key: key,
      UploadId: uploadId,
    });

    await this.sendWithTimeout(
      "abortMultipartUpload",
      (abortSignal) => this.s3Client.send(command, { abortSignal }),
      { key },
    );
  }

  /**
   * Streams into storage with the SDK's managed upload: parts are buffered without re-copying and
   * up to S3_MULTIPART_UPLOAD_CONCURRENCY of them upload while the stream keeps being read. Like
   * every other S3 call, the upload is aborted when no part finishes within the operation timeout.
   */
  async uploadStreamMultipart(
    stream: Readable,
    key: string,
    contentType: string,
    { partSize = DEFAULT_TUS_CHUNK_SIZE, onUploadedBytes }: S3StreamUploadOptions = {},
  ): Promise<void> {
    const upload = new Upload({
      client: this.s3Client,
      params: { Bucket: this.bucketName, Key: key, Body: stream, ContentType: contentType },
      partSize,
      queueSize: S3_MULTIPART_UPLOAD_CONCURRENCY,
      leavePartsOnError: false,
    });

    let timedOut = false;
    let stallTimeout: NodeJS.Timeout | undefined;

    const restartStallTimeout = () => {
      clearTimeout(stallTimeout);
      stallTimeout = setTimeout(() => {
        timedOut = true;
        void upload.abort();
      }, S3_OPERATION_TIMEOUT_MS);
    };

    upload.on("httpUploadProgress", ({ loaded }) => {
      restartStallTimeout();
      if (loaded !== undefined) onUploadedBytes?.(loaded);
    });
    restartStallTimeout();

    try {
      await upload.done();
    } catch (error) {
      if (timedOut) {
        const timeoutMessage = `S3 uploadStreamMultipart for key "${key}" timed out after ${S3_OPERATION_TIMEOUT_MS}ms`;
        this.logger.error(timeoutMessage);
        throw new Error(timeoutMessage);
      }

      this.logger.error(
        `S3 uploadStreamMultipart for key "${key}" failed: ${this.getErrorMessage(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    } finally {
      clearTimeout(stallTimeout);
      stream.destroy();
    }
  }

  async getFileStream(key: string, range?: string): Promise<FileStreamPayload> {
    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      ...(range ? { Range: range } : {}),
    });

    const response = await this.sendWithTimeout(
      "getFileStream",
      (abortSignal) => this.s3Client.send(command, { abortSignal }),
      { key },
    );

    return {
      stream: response.Body as Readable,
      contentType: response.ContentType,
      contentLength: response.ContentLength,
      contentRange: response.ContentRange,
      acceptRanges: response.AcceptRanges,
      etag: response.ETag,
      lastModified: response.LastModified,
      statusCode: response.$metadata.httpStatusCode,
      streamTimeoutMs: S3_OPERATION_TIMEOUT_MS,
    };
  }

  async listFileKeysByPrefix(prefix: string): Promise<string[]> {
    const keys: string[] = [];
    let continuationToken: string | undefined;

    do {
      const command = new ListObjectsV2Command({
        Bucket: this.bucketName,
        Prefix: prefix,
        ContinuationToken: continuationToken,
      });

      const response = await this.sendWithTimeout(
        "listFileKeysByPrefix",
        (abortSignal) => this.s3Client.send(command, { abortSignal }),
        { key: prefix },
      );

      keys.push(...(response.Contents ?? []).flatMap((object) => (object.Key ? [object.Key] : [])));
      continuationToken = response.NextContinuationToken;
    } while (continuationToken);

    return keys;
  }

  async getFileExists(key: string) {
    const command = new HeadObjectCommand({ Bucket: this.bucketName, Key: key });

    try {
      await this.sendWithTimeout(
        "getFileExists",
        (abortSignal) => this.s3Client.send(command, { abortSignal }),
        { key, ignoreNotFound: true },
      );

      return true;
    } catch (err) {
      if (this.isNotFoundError(err)) return false;
      throw err;
    }
  }

  async getFileSize(key: string): Promise<number> {
    const command = new HeadObjectCommand({ Bucket: this.bucketName, Key: key });
    const response = await this.sendWithTimeout(
      "getFileSize",
      (abortSignal) => this.s3Client.send(command, { abortSignal }),
      { key },
    );

    return response.ContentLength ?? 0;
  }

  async getFileContentType(key: string): Promise<string | null> {
    const command = new HeadObjectCommand({ Bucket: this.bucketName, Key: key });
    const response = await this.sendWithTimeout(
      "getFileContentType",
      (abortSignal) => this.s3Client.send(command, { abortSignal }),
      { key },
    );

    return response.ContentType ?? null;
  }
}
