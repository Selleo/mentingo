import { randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import { rm } from "node:fs/promises";

import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { Value } from "@sinclair/typebox/value";

import { isRecord } from "src/common/utils/object.utils";
import { QUEUE_NAMES, QueueService } from "src/queue";
import { S3Service } from "src/s3/s3.service";

import {
  getNativeArchiveExportPrefix,
  getNativeArchiveUploadKey,
  getNativeArchiveUploadPrefix,
} from "../native-archive-storage-paths";
import {
  NATIVE_ARCHIVE_DOWNLOAD_FILENAME,
  NATIVE_ARCHIVE_DOWNLOAD_URL_TTL_SECONDS,
  NATIVE_ARCHIVE_EXPORT_ACCESS,
  NATIVE_ARCHIVE_EXPORT_TTL_MS,
  NATIVE_ARCHIVE_IMPORT_ARCHIVE_ORIGINS,
  NATIVE_ARCHIVE_JOB_ACTION,
  NATIVE_ARCHIVE_JOB_PAGE_SIZE,
  NATIVE_ARCHIVE_JOB_RESULT_PRIVATE_FIELDS,
  NATIVE_ARCHIVE_JOB_STATE,
  NATIVE_ARCHIVE_KIND,
} from "../native-archive.constants";
import { nativeArchiveJobProgressSchema } from "../schemas/native-archive.schema";

import { toPublicArchiveFailureCode } from "./native-archive-job-error.utils";

import type {
  NativeArchiveDownload,
  NativeArchiveDownloadUrl,
  NativeArchiveExportAccess,
  NativeArchiveImportMode,
  NativeArchiveImportOptions,
  NativeArchiveImportSource,
  NativeArchiveJob,
  NativeArchiveJobReceipt,
  NativeArchiveJobStatus,
} from "../native-archive.types";
import type { Job, Queue } from "bullmq";
import type { UUIDType } from "src/common";
import type { CurrentUserType } from "src/common/types/current-user.type";

@Injectable()
export class NativeArchiveJobService {
  constructor(
    private readonly queueService: QueueService,
    private readonly s3Service: S3Service,
  ) {}

  async enqueueArchiveExport(
    kind: "course" | "learning-path",
    id: UUIDType,
    actor: CurrentUserType,
    exportAccess: NativeArchiveExportAccess = NATIVE_ARCHIVE_EXPORT_ACCESS.ACTOR_PERMISSIONS,
  ): Promise<NativeArchiveJobReceipt> {
    if (!this.s3Service.isConfigured()) {
      throw new BadRequestException("nativeArchive.error.storageUnavailable");
    }

    const action =
      kind === NATIVE_ARCHIVE_KIND.COURSE
        ? NATIVE_ARCHIVE_JOB_ACTION.EXPORT_COURSE
        : NATIVE_ARCHIVE_JOB_ACTION.EXPORT_LEARNING_PATH;

    const job = await this.queueService.enqueue(
      QUEUE_NAMES.NATIVE_ARCHIVE,
      action,
      {
        action,
        rootId: id,
        exportAccess,
        actor,
      } satisfies NativeArchiveJob,
      { attempts: 1, removeOnComplete: false, removeOnFail: false },
    );

    return { jobId: String(job.id) };
  }

  async enqueueArchiveImportFromFile(
    file: Express.Multer.File,
    actor: CurrentUserType,
  ): Promise<NativeArchiveJobReceipt> {
    if (!this.s3Service.isConfigured()) {
      await rm(file.path, { force: true });

      throw new BadRequestException("nativeArchive.error.storageUnavailable");
    }

    const key = getNativeArchiveUploadKey(actor.tenantId, randomUUID());

    try {
      await this.s3Service.uploadStreamMultipart(
        createReadStream(file.path),
        key,
        "application/zip",
      );
    } finally {
      await rm(file.path, { force: true });
    }

    return this.enqueueArchiveImportFromStorageKey(key, actor);
  }

  async enqueueArchiveImportFromStorageKey(
    key: string,
    actor: CurrentUserType,
    { importSource, importMode }: NativeArchiveImportOptions = {},
  ): Promise<NativeArchiveJobReceipt> {
    if (!key.startsWith(getNativeArchiveUploadPrefix(actor.tenantId))) {
      throw new ForbiddenException("nativeArchive.error.invalidUpload");
    }

    const job = await this.queueService.enqueue(
      QUEUE_NAMES.NATIVE_ARCHIVE,
      NATIVE_ARCHIVE_JOB_ACTION.IMPORT,
      {
        action: NATIVE_ARCHIVE_JOB_ACTION.IMPORT,
        key,
        archiveOrigin: NATIVE_ARCHIVE_IMPORT_ARCHIVE_ORIGINS.UPLOAD,
        importSource,
        importMode,
        actor,
      } satisfies NativeArchiveJob,
      { attempts: 1, removeOnComplete: false, removeOnFail: false },
    );

    return { jobId: String(job.id) };
  }

  /**
   * Queues an import whose archive the downloader registered for the import source's kind
   * supplies when the job runs, so the HTTP request never downloads it.
   */
  async enqueueArchiveImportFromSource(
    importSource: NativeArchiveImportSource,
    actor: CurrentUserType,
    importMode?: NativeArchiveImportMode,
  ): Promise<NativeArchiveJobReceipt> {
    const job = await this.queueService.enqueue(
      QUEUE_NAMES.NATIVE_ARCHIVE,
      NATIVE_ARCHIVE_JOB_ACTION.IMPORT,
      {
        action: NATIVE_ARCHIVE_JOB_ACTION.IMPORT,
        archiveOrigin: NATIVE_ARCHIVE_IMPORT_ARCHIVE_ORIGINS.IMPORT_SOURCE,
        importSource,
        importMode,
        actor,
      } satisfies NativeArchiveJob,
      { attempts: 1, removeOnComplete: false, removeOnFail: false },
    );

    return { jobId: String(job.id) };
  }

  async getArchiveJobStatus(
    jobId: string,
    actor: CurrentUserType,
  ): Promise<NativeArchiveJobStatus> {
    const job = await this.getAuthorizedArchiveJob(jobId, actor);
    const result = isRecord(job.returnvalue) ? job.returnvalue : null;

    return {
      jobId,
      state: await job.getState(),
      result: result
        ? Object.fromEntries(
            Object.entries(result).filter(
              ([key]) => !NATIVE_ARCHIVE_JOB_RESULT_PRIVATE_FIELDS.has(key),
            ),
          )
        : null,
      failedReason: toPublicArchiveFailureCode(job.failedReason),
      progress: Value.Check(nativeArchiveJobProgressSchema, job.progress) ? job.progress : null,
    };
  }

  async getArchiveDownloadStream(
    jobId: string,
    actor: CurrentUserType,
  ): Promise<NativeArchiveDownload> {
    const { key, filename } = await this.getCompletedArchiveExport(jobId, actor);

    return { file: await this.s3Service.getFileStream(key), filename };
  }

  /**
   * A short-lived storage URL for a finished export, so clients download the zip straight from
   * storage with native progress instead of through the API.
   */
  async getArchiveDownloadUrl(
    jobId: string,
    actor: CurrentUserType,
  ): Promise<NativeArchiveDownloadUrl> {
    const { key, filename } = await this.getCompletedArchiveExport(jobId, actor);

    return {
      url: await this.s3Service.getSignedUrl(key, NATIVE_ARCHIVE_DOWNLOAD_URL_TTL_SECONDS, {
        downloadFilename: filename,
      }),
      expiresInSeconds: NATIVE_ARCHIVE_DOWNLOAD_URL_TTL_SECONDS,
    };
  }

  private async getCompletedArchiveExport(
    jobId: string,
    actor: CurrentUserType,
  ): Promise<{ key: string; filename: string }> {
    const job = await this.getAuthorizedArchiveJob(jobId, actor);

    if ((await job.getState()) !== NATIVE_ARCHIVE_JOB_STATE.COMPLETED)
      throw new NotFoundException("nativeArchive.error.notReady");

    const key = this.getArchiveExportKey(job.returnvalue);

    if (!key || !this.isArchiveExportKeyForTenant(key, actor.tenantId)) {
      throw new NotFoundException("nativeArchive.error.notReady");
    }

    return { key, filename: this.getArchiveDownloadFilename(job.returnvalue) };
  }

  /** Exports finished before packages were named after their content keep the generic name. */
  private getArchiveDownloadFilename(result: unknown): string {
    if (isRecord(result) && typeof result.filename === "string") return result.filename;

    return NATIVE_ARCHIVE_DOWNLOAD_FILENAME;
  }

  private async getAuthorizedArchiveJob(
    jobId: string,
    actor: CurrentUserType,
  ): Promise<Job<NativeArchiveJob>> {
    const queue: Queue = this.queueService.getQueue(QUEUE_NAMES.NATIVE_ARCHIVE);
    const job = await queue.getJob(jobId);

    if (!job) throw new NotFoundException("nativeArchive.error.jobNotFound");

    const data = job.data;

    if (data.actor.tenantId !== actor.tenantId || data.actor.userId !== actor.userId) {
      throw new ForbiddenException("nativeArchive.error.accessDenied");
    }

    return job;
  }

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async removeExpiredArchives(): Promise<void> {
    const queue = this.queueService.getQueue(QUEUE_NAMES.NATIVE_ARCHIVE);
    const cutoff = Date.now() - NATIVE_ARCHIVE_EXPORT_TTL_MS;
    const expiredJobs: Job<NativeArchiveJob>[] = [];

    for (let offset = 0; ; offset += NATIVE_ARCHIVE_JOB_PAGE_SIZE) {
      const page = await queue.getJobs(
        [NATIVE_ARCHIVE_JOB_STATE.COMPLETED, NATIVE_ARCHIVE_JOB_STATE.FAILED],
        offset,
        offset + NATIVE_ARCHIVE_JOB_PAGE_SIZE - 1,
      );
      expiredJobs.push(...page.filter((job) => (job.finishedOn ?? job.timestamp) < cutoff));

      if (page.length < NATIVE_ARCHIVE_JOB_PAGE_SIZE) break;
    }

    for (const job of expiredJobs) {
      await this.removeExpiredArchiveJob(job);
    }
  }

  private async removeExpiredArchiveJob(job: Job<NativeArchiveJob>): Promise<void> {
    const key = this.getArchiveExportKey(job.returnvalue);
    const tenantId = job.data?.actor?.tenantId;

    try {
      if (key && tenantId && this.isArchiveExportKeyForTenant(key, tenantId)) {
        await this.s3Service.deleteFile(key);
      }

      await job.remove();
    } catch {
      // Keep the job so the next cleanup run can retry.
    }
  }

  private getArchiveExportKey(result: unknown): string | undefined {
    if (!isRecord(result)) return;
    return typeof result.key === "string" ? result.key : undefined;
  }

  private isArchiveExportKeyForTenant(key: string, tenantId: UUIDType): boolean {
    return key.startsWith(getNativeArchiveExportPrefix(tenantId));
  }
}
