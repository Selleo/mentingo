import { createReadStream } from "node:fs";
import { rm } from "node:fs/promises";
import { Readable } from "node:stream";

import { ForbiddenException, NotFoundException } from "@nestjs/common";
import AdmZip from "adm-zip";

import { CACHE_MANAGER_TOKEN } from "src/cache/cache.types";
import { NativeArchiveJobService } from "src/native-archive/services/native-archive-job.service";
import { S3Service } from "src/s3/s3.service";

type Actor = { tenantId: string; userId: string };
type StoredJob = { actor: Actor; state: "waiting" | "completed"; result: unknown };

const archive = new AdmZip();
archive.addFile("manifest.json", Buffer.from("{}"));
export const NATIVE_ARCHIVE_ZIP_FIXTURE = archive.toBuffer();

export function createNativeArchiveUploadE2EDoubles() {
  const jobs = new Map<string, StoredJob>();
  const uploadCalls: Array<{ bytes: Buffer; key: string; contentType: string }> = [];
  const multipartParts: Buffer[] = [];
  const storedSessions = new Map<string, unknown>();

  const cache = {
    get: jest.fn(async (key: string) => storedSessions.get(key)),
    set: jest.fn(async (key: string, value: unknown) => {
      storedSessions.set(key, structuredClone(value));
    }),
    del: jest.fn(async (key: string) => {
      storedSessions.delete(key);
    }),
  };

  const s3Service = {
    isConfigured: jest.fn(() => true),
    uploadStreamMultipart: jest.fn(
      async (stream: NodeJS.ReadableStream, key: string, contentType: string) => {
        const chunks: Buffer[] = [];
        for await (const chunk of stream as AsyncIterable<Buffer | string>) {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        }
        uploadCalls.push({ bytes: Buffer.concat(chunks), key, contentType });
      },
    ),
    createMultipartUpload: jest.fn(async () => ({ uploadId: "multipart-1" })),
    uploadMultipartPart: jest.fn(
      async (_key: string, _uploadId: string, _part: number, bytes: Buffer) => {
        multipartParts.push(Buffer.from(bytes));
        return "etag-1";
      },
    ),
    completeMultipartUpload: jest.fn(async () => undefined),
    abortMultipartUpload: jest.fn(async () => undefined),
  };

  const nextJobId = () => `native-archive-${jobs.size + 1}`;
  const ensureActor = (jobId: string, actor: Actor) => {
    const job = jobs.get(jobId);
    if (!job) throw new NotFoundException("nativeArchive.error.jobNotFound");
    if (job.actor.tenantId !== actor.tenantId || job.actor.userId !== actor.userId) {
      throw new ForbiddenException("nativeArchive.error.accessDenied");
    }
    return job;
  };

  const jobService = {
    enqueueArchiveImportFromFile: jest.fn(async (file: Express.Multer.File, actor: Actor) => {
      const key = `${actor.tenantId}/native-archive/uploads/multipart-${jobs.size + 1}.zip`;
      try {
        await s3Service.uploadStreamMultipart(createReadStream(file.path), key, "application/zip");
      } finally {
        await rm(file.path, { force: true });
      }
      const id = nextJobId();
      jobs.set(id, { actor, state: "waiting", result: null });
      return { jobId: id };
    }),
    enqueueArchiveImportFromStorageKey: jest.fn(async (key: string, actor: Actor) => {
      if (!key.startsWith(`${actor.tenantId}/native-archive/uploads/`)) {
        throw new ForbiddenException("nativeArchive.error.invalidUpload");
      }
      const id = nextJobId();
      jobs.set(id, { actor, state: "waiting", result: null });
      return { jobId: id };
    }),
    getArchiveJobStatus: jest.fn(async (id: string, actor: Actor) => {
      const job = ensureActor(id, actor);
      return { jobId: id, state: job.state, result: job.result, failedReason: null };
    }),
    getArchiveDownloadStream: jest.fn(async (id: string, actor: Actor) => {
      const job = ensureActor(id, actor);
      if (job.state !== "completed") throw new NotFoundException("nativeArchive.error.notReady");
      return { stream: Readable.from(Buffer.from("archive")), contentLength: 7 };
    }),
  };

  const providers = [
    { provide: S3Service, useValue: s3Service },
    { provide: NativeArchiveJobService, useValue: jobService },
    { provide: CACHE_MANAGER_TOKEN, useValue: cache },
  ];

  return {
    cache,
    jobs,
    jobService,
    multipartParts,
    providers,
    s3Service,
    uploadCalls,
    clear: () => {
      jobs.clear();
      uploadCalls.length = 0;
      multipartParts.length = 0;
      jest.clearAllMocks();
    },
  };
}
