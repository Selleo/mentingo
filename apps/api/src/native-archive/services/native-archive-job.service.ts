import { randomUUID } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pipeline } from "node:stream/promises";

import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { Worker, type Job, type Queue } from "bullmq";
import { match } from "ts-pattern";

import { isRecord } from "src/common/utils/object.utils";
import { OutboxPublisher } from "src/outbox/outbox.publisher";
import { QUEUE_NAMES, QueueService } from "src/queue";
import { S3Service } from "src/s3/s3.service";
import { TenantDbRunnerService } from "src/storage/db/tenant-db-runner.service";

import { NativeArchiveImportFinishedEvent } from "../events/native-archive-import-finished.event";
import {
  getNativeArchiveExportKey,
  getNativeArchiveExportPrefix,
  getNativeArchiveUploadKey,
  getNativeArchiveUploadPrefix,
} from "../native-archive-storage-paths";
import {
  NATIVE_ARCHIVE_EXPORT_ACCESS,
  NATIVE_ARCHIVE_EXPORT_TTL_MS,
  NATIVE_ARCHIVE_IMPORT_ARCHIVE_ORIGINS,
  NATIVE_ARCHIVE_IMPORT_OUTCOMES,
  NATIVE_ARCHIVE_JOB_ACTION,
  NATIVE_ARCHIVE_JOB_PAGE_SIZE,
  NATIVE_ARCHIVE_JOB_STATE,
  NATIVE_ARCHIVE_KIND,
  NATIVE_ARCHIVE_LIMITS,
} from "../native-archive.constants";

import { NativeArchiveImportService } from "./native-archive-import.service";
import { toPublicArchiveFailureCode } from "./native-archive-job-error.utils";
import { NativeArchiveSnapshotService } from "./native-archive-snapshot.service";
import { buildNativeArchive } from "./native-archive-zip.service";
import { createSizeLimitedArchiveStream } from "./native-archive-zip.utils";

import type {
  NativeArchiveExportAccess,
  NativeArchiveImportArchive,
  NativeArchiveImportMode,
  NativeArchiveImportOptions,
  NativeArchiveImportSource,
  NativeArchiveJob,
  NativeArchiveJobReceipt,
  NativeArchiveJobResult,
  NativeArchiveJobStatus,
  NativeArchiveSourceArchiveDownloader,
} from "../native-archive.types";
import type { OnModuleDestroy } from "@nestjs/common";
import type { UUIDType } from "src/common";
import type { CurrentUserType } from "src/common/types/current-user.type";
import type { FileStreamPayload } from "src/file/types/file-stream.type";

@Injectable()
export class NativeArchiveJobService implements OnModuleDestroy {
  private readonly archiveWorker: Worker<NativeArchiveJob>;
  private readonly sourceArchiveDownloadersBySourceKind = new Map<
    string,
    NativeArchiveSourceArchiveDownloader
  >();

  constructor(
    private readonly queueService: QueueService,
    private readonly s3Service: S3Service,
    private readonly tenantDbRunnerService: TenantDbRunnerService,
    private readonly nativeArchiveSnapshotService: NativeArchiveSnapshotService,
    private readonly nativeArchiveImportService: NativeArchiveImportService,
    private readonly outboxPublisher: OutboxPublisher,
  ) {
    this.archiveWorker = new Worker<NativeArchiveJob>(
      QUEUE_NAMES.NATIVE_ARCHIVE,
      (job) => this.processArchiveJob(job),
      {
        connection: this.queueService.getConnection(),
        concurrency: 1,
      },
    );
  }

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
   * Lets a feature that queues imports from its own source, such as the content marketplace,
   * supply the archive inside the import job instead of the HTTP request that queued it.
   */
  registerSourceArchiveDownloader(
    sourceKind: string,
    downloader: NativeArchiveSourceArchiveDownloader,
  ) {
    this.sourceArchiveDownloadersBySourceKind.set(sourceKind, downloader);
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
        ? Object.fromEntries(Object.entries(result).filter(([key]) => key !== "key"))
        : null,
      failedReason: toPublicArchiveFailureCode(job.failedReason),
    };
  }

  async getArchiveDownloadStream(
    jobId: string,
    actor: CurrentUserType,
  ): Promise<FileStreamPayload> {
    const job = await this.getAuthorizedArchiveJob(jobId, actor);

    if ((await job.getState()) !== NATIVE_ARCHIVE_JOB_STATE.COMPLETED)
      throw new NotFoundException("nativeArchive.error.notReady");

    const key = this.getArchiveExportKey(job.returnvalue);

    if (!key || !this.isArchiveExportKeyForTenant(key, actor.tenantId)) {
      throw new NotFoundException("nativeArchive.error.notReady");
    }

    return this.s3Service.getFileStream(key);
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

  private async processArchiveJob(job: Job<NativeArchiveJob>): Promise<NativeArchiveJobResult> {
    const { action, actor, rootId, key, archiveOrigin, exportAccess, importSource, importMode } =
      job.data;

    if (action === NATIVE_ARCHIVE_JOB_ACTION.IMPORT) {
      return this.importArchiveAndReportOutcome(String(job.id), { key, archiveOrigin }, actor, {
        importSource,
        importMode,
      });
    }

    return this.processExportJob(action, rootId, actor, exportAccess);
  }

  /**
   * Runs the import; when the job came with an import source, its outcome is published for that
   * source. IMPORTED is published by the import inside its content transaction; only FAILED is
   * published here, because a failed import committed nothing.
   */
  private async importArchiveAndReportOutcome(
    jobId: string,
    archive: NativeArchiveImportArchive,
    actor: CurrentUserType,
    { importSource, importMode }: NativeArchiveImportOptions,
  ): Promise<NativeArchiveJobResult> {
    try {
      return await this.processImportJob(jobId, archive, actor, importMode, importSource);
    } catch (error) {
      if (importSource)
        await this.publishImportFinished(jobId, actor, importSource, {
          outcome: NATIVE_ARCHIVE_IMPORT_OUTCOMES.FAILED,
          courseId: null,
          failureCode: toPublicArchiveFailureCode(error instanceof Error ? error.message : null),
        });

      throw error;
    }
  }

  private async publishImportFinished(
    jobId: string,
    actor: CurrentUserType,
    importSource: NativeArchiveImportSource,
    finish: Pick<NativeArchiveImportFinishedEvent, "outcome" | "courseId" | "failureCode">,
  ) {
    await this.tenantDbRunnerService.runWithTenant(actor.tenantId, () =>
      this.outboxPublisher.publish(
        new NativeArchiveImportFinishedEvent(
          actor.tenantId,
          jobId,
          actor.userId,
          finish.outcome,
          finish.courseId,
          finish.failureCode,
          importSource,
          new Date().toISOString(),
        ),
      ),
    );
  }

  private async processImportJob(
    jobId: string,
    {
      key,
      archiveOrigin = NATIVE_ARCHIVE_IMPORT_ARCHIVE_ORIGINS.UPLOAD,
    }: NativeArchiveImportArchive,
    actor: CurrentUserType,
    importMode: NativeArchiveImportMode | undefined,
    importSource: NativeArchiveImportSource | undefined,
  ): Promise<NativeArchiveJobResult> {
    const uploadKey = match(archiveOrigin)
      .with(NATIVE_ARCHIVE_IMPORT_ARCHIVE_ORIGINS.UPLOAD, () => this.getTenantUploadKey(key, actor))
      .with(NATIVE_ARCHIVE_IMPORT_ARCHIVE_ORIGINS.IMPORT_SOURCE, () => null)
      .exhaustive();

    const directory = await mkdtemp(path.join(tmpdir(), "mentingo-native-upload-"));
    const filename = path.join(directory, "archive.zip");

    try {
      if (uploadKey) {
        await pipeline(
          (await this.s3Service.getFileStream(uploadKey)).stream,
          createWriteStream(filename),
        );
      } else {
        await this.downloadImportSourceArchive(importSource, actor, filename);
      }

      return await this.tenantDbRunnerService.runWithTenant(actor.tenantId, () =>
        this.nativeArchiveImportService.importArchive(
          filename,
          actor,
          importMode,
          importSource && { jobId, importSource },
        ),
      );
    } finally {
      await rm(directory, { recursive: true, force: true });

      if (uploadKey) await this.s3Service.deleteFile(uploadKey);
    }
  }

  private getTenantUploadKey(key: string | undefined, actor: CurrentUserType): string {
    if (!key || !key.startsWith(getNativeArchiveUploadPrefix(actor.tenantId))) {
      throw new ForbiddenException("nativeArchive.error.invalidUpload");
    }

    return key;
  }

  /** Downloads the import source's archive in the tenant's context, rejecting archives over the size limit. */
  private async downloadImportSourceArchive(
    importSource: NativeArchiveImportSource | undefined,
    actor: CurrentUserType,
    filename: string,
  ) {
    const downloadSourceArchive =
      importSource && this.sourceArchiveDownloadersBySourceKind.get(importSource.kind);

    if (!importSource || !downloadSourceArchive)
      throw new ForbiddenException("nativeArchive.error.invalidJob");

    const download = await this.tenantDbRunnerService.runWithTenant(actor.tenantId, () =>
      downloadSourceArchive(importSource),
    );

    if (
      download.contentLength !== null &&
      download.contentLength > NATIVE_ARCHIVE_LIMITS.MAX_ARCHIVE_BYTES
    ) {
      download.stream.destroy();
      throw new BadRequestException("nativeArchive.error.archiveTooLarge");
    }

    await pipeline(download.stream, createSizeLimitedArchiveStream(), createWriteStream(filename));
  }

  private async processExportJob(
    action: NativeArchiveJob["action"],
    rootId: UUIDType | undefined,
    actor: CurrentUserType,
    exportAccess: NativeArchiveExportAccess = NATIVE_ARCHIVE_EXPORT_ACCESS.ACTOR_PERMISSIONS,
  ): Promise<NativeArchiveJobResult> {
    if (
      !rootId ||
      (action !== NATIVE_ARCHIVE_JOB_ACTION.EXPORT_COURSE &&
        action !== NATIVE_ARCHIVE_JOB_ACTION.EXPORT_LEARNING_PATH)
    ) {
      throw new ForbiddenException("nativeArchive.error.invalidJob");
    }

    const kind =
      action === NATIVE_ARCHIVE_JOB_ACTION.EXPORT_COURSE
        ? NATIVE_ARCHIVE_KIND.COURSE
        : NATIVE_ARCHIVE_KIND.LEARNING_PATH;

    const archive = await this.tenantDbRunnerService.runWithTenant(actor.tenantId, async () => {
      const snapshot =
        kind === NATIVE_ARCHIVE_KIND.COURSE
          ? await this.nativeArchiveSnapshotService.buildCourseExportSnapshot(
              rootId,
              actor,
              exportAccess,
            )
          : await this.nativeArchiveSnapshotService.buildLearningPathExportSnapshot(rootId, actor);

      return buildNativeArchive({ kind, rootId, ...snapshot });
    });
    const exportKey = getNativeArchiveExportKey(actor.tenantId, randomUUID());

    try {
      await this.s3Service.uploadStreamMultipart(archive.stream, exportKey, "application/zip");

      return { key: exportKey, kind, rootId };
    } finally {
      await archive.cleanup();
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.archiveWorker.close();
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
