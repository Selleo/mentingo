import { randomUUID } from "node:crypto";
import { createWriteStream } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pipeline } from "node:stream/promises";

import { BadRequestException, ForbiddenException, Injectable } from "@nestjs/common";
import { match } from "ts-pattern";

import { OutboxPublisher } from "src/outbox/outbox.publisher";
import { S3Service } from "src/s3/s3.service";
import { TenantDbRunnerService } from "src/storage/db/tenant-db-runner.service";

import { NativeArchiveImportFinishedEvent } from "../events/native-archive-import-finished.event";
import {
  getNativeArchiveExportKey,
  getNativeArchiveUploadPrefix,
} from "../native-archive-storage-paths";
import {
  NATIVE_ARCHIVE_EXPORT_ACCESS,
  NATIVE_ARCHIVE_IMPORT_ARCHIVE_ORIGINS,
  NATIVE_ARCHIVE_IMPORT_OUTCOMES,
  NATIVE_ARCHIVE_JOB_ACTION,
  NATIVE_ARCHIVE_JOB_STAGES,
  NATIVE_ARCHIVE_KIND,
  NATIVE_ARCHIVE_LIMITS,
} from "../native-archive.constants";
import { buildNativeArchiveFilename } from "../utils/native-archive-filename.utils";
import {
  createByteProgressStream,
  SILENT_NATIVE_ARCHIVE_PROGRESS,
} from "../utils/native-archive-job-progress.utils";

import { NativeArchiveExportReuseService } from "./native-archive-export-reuse.service";
import { NativeArchiveImportService } from "./native-archive-import.service";
import { toPublicArchiveFailureCode } from "./native-archive-job-error.utils";
import { NativeArchiveSnapshotService } from "./native-archive-snapshot.service";
import { buildNativeArchive } from "./native-archive-zip.service";
import {
  createSizeLimitedArchiveStream,
  fingerprintArchiveInput,
} from "./native-archive-zip.utils";

import type {
  NativeArchiveBuildInput,
  NativeArchiveExportAccess,
  NativeArchiveImportArchive,
  NativeArchiveImportOptions,
  NativeArchiveImportSource,
  NativeArchiveJob,
  NativeArchiveJobResult,
  NativeArchiveProgressReporter,
  NativeArchiveSourceArchiveDownloader,
} from "../native-archive.types";
import type { UUIDType } from "src/common";
import type { CurrentUserType } from "src/common/types/current-user.type";

/**
 * Does the work of a queued native-archive job: building an export or importing an archive.
 * In compiled builds it runs in the queue's sandbox process, off the API's event loop.
 */
@Injectable()
export class NativeArchiveJobFulfillmentService {
  private readonly sourceArchiveDownloadersBySourceKind = new Map<
    string,
    NativeArchiveSourceArchiveDownloader
  >();

  constructor(
    private readonly s3Service: S3Service,
    private readonly tenantDbRunnerService: TenantDbRunnerService,
    private readonly nativeArchiveSnapshotService: NativeArchiveSnapshotService,
    private readonly nativeArchiveImportService: NativeArchiveImportService,
    private readonly nativeArchiveExportReuseService: NativeArchiveExportReuseService,
    private readonly outboxPublisher: OutboxPublisher,
  ) {}

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

  async fulfillArchiveJob(
    jobId: string,
    jobData: NativeArchiveJob,
    progress: NativeArchiveProgressReporter = SILENT_NATIVE_ARCHIVE_PROGRESS,
  ): Promise<NativeArchiveJobResult> {
    const { action, actor, rootId, key, archiveOrigin, exportAccess, importSource, importMode } =
      jobData;

    if (action === NATIVE_ARCHIVE_JOB_ACTION.IMPORT) {
      return this.importArchiveAndReportOutcome(
        jobId,
        { key, archiveOrigin },
        actor,
        { importSource, importMode },
        progress,
      );
    }

    return this.exportArchiveToStorage(action, rootId, actor, exportAccess, progress);
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
    progress: NativeArchiveProgressReporter,
  ): Promise<NativeArchiveJobResult> {
    try {
      return await this.downloadAndImportArchive(
        jobId,
        archive,
        actor,
        { importMode, importSource },
        progress,
      );
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

  private async downloadAndImportArchive(
    jobId: string,
    {
      key,
      archiveOrigin = NATIVE_ARCHIVE_IMPORT_ARCHIVE_ORIGINS.UPLOAD,
    }: NativeArchiveImportArchive,
    actor: CurrentUserType,
    { importMode, importSource }: NativeArchiveImportOptions,
    progress: NativeArchiveProgressReporter,
  ): Promise<NativeArchiveJobResult> {
    const uploadKey = match(archiveOrigin)
      .with(NATIVE_ARCHIVE_IMPORT_ARCHIVE_ORIGINS.UPLOAD, () => this.getTenantUploadKey(key, actor))
      .with(NATIVE_ARCHIVE_IMPORT_ARCHIVE_ORIGINS.IMPORT_SOURCE, () => null)
      .exhaustive();

    const directory = await mkdtemp(path.join(tmpdir(), "mentingo-native-upload-"));
    const filename = path.join(directory, "archive.zip");

    const reportDownloadedBytes = (downloadedBytes: number, totalBytes: number) =>
      progress.reportStageWork(NATIVE_ARCHIVE_JOB_STAGES.DOWNLOADING, downloadedBytes, totalBytes);

    try {
      progress.enterStage(NATIVE_ARCHIVE_JOB_STAGES.DOWNLOADING);

      if (uploadKey) {
        const upload = await this.s3Service.getFileStream(uploadKey);

        await pipeline(
          upload.stream,
          createByteProgressStream(upload.contentLength, reportDownloadedBytes),
          createWriteStream(filename),
        );
      } else {
        await this.downloadImportSourceArchive(
          importSource,
          actor,
          filename,
          reportDownloadedBytes,
        );
      }

      return await this.tenantDbRunnerService.runWithTenant(actor.tenantId, () =>
        this.nativeArchiveImportService.importArchive(
          filename,
          actor,
          importMode,
          importSource && { jobId, importSource },
          progress,
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
    reportDownloadedBytes: (downloadedBytes: number, totalBytes: number) => void,
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

    await pipeline(
      download.stream,
      createSizeLimitedArchiveStream(),
      createByteProgressStream(download.contentLength, reportDownloadedBytes),
      createWriteStream(filename),
    );
  }

  private async exportArchiveToStorage(
    action: NativeArchiveJob["action"],
    rootId: UUIDType | undefined,
    actor: CurrentUserType,
    exportAccess: NativeArchiveExportAccess = NATIVE_ARCHIVE_EXPORT_ACCESS.ACTOR_PERMISSIONS,
    progress: NativeArchiveProgressReporter = SILENT_NATIVE_ARCHIVE_PROGRESS,
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

    const exportKey = getNativeArchiveExportKey(actor.tenantId, randomUUID());

    progress.enterStage(NATIVE_ARCHIVE_JOB_STAGES.COLLECTING_CONTENT);

    const filename = await this.tenantDbRunnerService.runWithTenant(
      actor.tenantId,
      async () => {
        const snapshot =
          kind === NATIVE_ARCHIVE_KIND.COURSE
            ? await this.nativeArchiveSnapshotService.buildCourseExportSnapshot(
                rootId,
                actor,
                exportAccess,
              )
            : await this.nativeArchiveSnapshotService.buildLearningPathExportSnapshot(
                rootId,
                actor,
              );
        const archiveInput = { kind, rootId, ...snapshot };
        const fingerprint = fingerprintArchiveInput(archiveInput);
        const archiveFilename = buildNativeArchiveFilename(archiveInput);

        if (
          await this.nativeArchiveExportReuseService.copyRememberedExport(
            actor.tenantId,
            fingerprint,
            exportKey,
          )
        ) {
          progress.enterStage(NATIVE_ARCHIVE_JOB_STAGES.PACKAGING);
          return archiveFilename;
        }

        await this.uploadBuiltArchive(archiveInput, exportKey, progress);
        await this.nativeArchiveExportReuseService.rememberExport(
          actor.tenantId,
          fingerprint,
          exportKey,
        );

        return archiveFilename;
      },
    );

    return { key: exportKey, kind, rootId, filename };
  }

  private async uploadBuiltArchive(
    archiveInput: NativeArchiveBuildInput,
    exportKey: string,
    progress: NativeArchiveProgressReporter,
  ) {
    progress.enterStage(NATIVE_ARCHIVE_JOB_STAGES.COPYING_FILES);
    const archive = await buildNativeArchive(archiveInput, {
      onAssetStaged: (stagedCount, totalCount) =>
        progress.reportStageWork(NATIVE_ARCHIVE_JOB_STAGES.COPYING_FILES, stagedCount, totalCount),
    });
    progress.enterStage(NATIVE_ARCHIVE_JOB_STAGES.PACKAGING);

    try {
      await this.s3Service.uploadStreamMultipart(archive.stream, exportKey, "application/zip", {
        partSize: NATIVE_ARCHIVE_LIMITS.EXPORT_UPLOAD_PART_BYTES,
        onUploadedBytes: (uploadedBytes) =>
          progress.reportStageWork(
            NATIVE_ARCHIVE_JOB_STAGES.PACKAGING,
            uploadedBytes,
            archive.estimatedByteLength,
          ),
      });
    } finally {
      await archive.cleanup();
    }
  }
}
