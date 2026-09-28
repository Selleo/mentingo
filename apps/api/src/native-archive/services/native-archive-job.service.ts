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

import { isRecord } from "src/common/utils/object.utils";
import { QUEUE_NAMES, QueueService } from "src/queue";
import { S3Service } from "src/s3/s3.service";
import { TenantDbRunnerService } from "src/storage/db/tenant-db-runner.service";

import {
  NATIVE_ARCHIVE_EXPORT_TTL_MS,
  NATIVE_ARCHIVE_JOB_ACTION,
  NATIVE_ARCHIVE_JOB_PAGE_SIZE,
  NATIVE_ARCHIVE_JOB_STATE,
  NATIVE_ARCHIVE_KIND,
} from "../native-archive.constants";

import { NativeArchiveImportService } from "./native-archive-import.service";
import { NativeArchiveSnapshotService } from "./native-archive-snapshot.service";
import { buildNativeArchive } from "./native-archive-zip.service";

import type {
  NativeArchiveJob,
  NativeArchiveJobReceipt,
  NativeArchiveJobResult,
  NativeArchiveJobStatus,
} from "../native-archive.types";
import type { OnModuleDestroy } from "@nestjs/common";
import type { UUIDType } from "src/common";
import type { CurrentUserType } from "src/common/types/current-user.type";
import type { FileStreamPayload } from "src/file/types/file-stream.type";

@Injectable()
export class NativeArchiveJobService implements OnModuleDestroy {
  private readonly archiveWorker: Worker<NativeArchiveJob>;

  constructor(
    private readonly queueService: QueueService,
    private readonly s3Service: S3Service,
    private readonly tenantDbRunnerService: TenantDbRunnerService,
    private readonly nativeArchiveSnapshotService: NativeArchiveSnapshotService,
    private readonly nativeArchiveImportService: NativeArchiveImportService,
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

    const key = `native-archive/uploads/${actor.tenantId}/${randomUUID()}.zip`;

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
  ): Promise<NativeArchiveJobReceipt> {
    if (!key.startsWith(`native-archive/uploads/${actor.tenantId}/`)) {
      throw new ForbiddenException("nativeArchive.error.invalidUpload");
    }

    const job = await this.queueService.enqueue(
      QUEUE_NAMES.NATIVE_ARCHIVE,
      NATIVE_ARCHIVE_JOB_ACTION.IMPORT,
      {
        action: NATIVE_ARCHIVE_JOB_ACTION.IMPORT,
        key,
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
      failedReason: job.failedReason ?? null,
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

    if (!key || !key.startsWith(`native-archive/exports/${actor.tenantId}/`)) {
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
    const { action, actor, rootId, key } = job.data;

    if (action === NATIVE_ARCHIVE_JOB_ACTION.IMPORT) {
      return this.processImportJob(key, actor);
    }

    return this.processExportJob(action, rootId, actor);
  }

  private async processImportJob(
    key: string | undefined,
    actor: CurrentUserType,
  ): Promise<NativeArchiveJobResult> {
    if (!key || !key.startsWith(`native-archive/uploads/${actor.tenantId}/`)) {
      throw new ForbiddenException("nativeArchive.error.invalidUpload");
    }

    const directory = await mkdtemp(path.join(tmpdir(), "mentingo-native-upload-"));
    const filename = path.join(directory, "archive.zip");

    try {
      await pipeline((await this.s3Service.getFileStream(key)).stream, createWriteStream(filename));

      return await this.tenantDbRunnerService.runWithTenant(actor.tenantId, () =>
        this.nativeArchiveImportService.importArchive(filename, actor),
      );
    } finally {
      await rm(directory, { recursive: true, force: true });

      await this.s3Service.deleteFile(key);
    }
  }

  private async processExportJob(
    action: NativeArchiveJob["action"],
    rootId: UUIDType | undefined,
    actor: CurrentUserType,
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

    const snapshot = await this.tenantDbRunnerService.runWithTenant(actor.tenantId, () =>
      kind === NATIVE_ARCHIVE_KIND.COURSE
        ? this.nativeArchiveSnapshotService.buildCourseExportSnapshot(rootId, actor)
        : this.nativeArchiveSnapshotService.buildLearningPathExportSnapshot(rootId, actor),
    );

    const archive = await buildNativeArchive({ kind, rootId, ...snapshot });
    const exportKey = `native-archive/exports/${actor.tenantId}/${randomUUID()}.zip`;

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
    const expiredJobs: Job[] = [];

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

  private async removeExpiredArchiveJob(job: Job): Promise<void> {
    const key = this.getArchiveExportKey(job.returnvalue);

    try {
      if (key?.startsWith("native-archive/exports/")) {
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
}
