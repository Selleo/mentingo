import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { COURSE_ORIGIN_TYPES, PERMISSIONS } from "@repo/shared";

import { DatabasePg, type UUIDType } from "src/common";
import { hasPermission } from "src/common/permissions/permission.utils";
import { MasterCourseService } from "src/courses/master-course.service";
import { QUEUE_NAMES, QueueService } from "src/queue";
import { TenantDbRunnerService } from "src/storage/db/tenant-db-runner.service";

import { LEARNING_PATH_ERRORS } from "../constants/learning-path.errors";
import { LearningPathRepository } from "../learning-path.repository";

import type { CurrentUserType } from "src/common/types/current-user.type";
import type { LearningPathExportJobData, LearningPathSyncJobData } from "src/queue/queue.types";

type ExportQueueItem = {
  targetTenantId: UUIDType;
  queued: boolean;
  reason?: string;
  exportId?: UUIDType;
};

@Injectable()
export class LearningPathExportService {
  constructor(
    @Inject("DB") private readonly db: DatabasePg,
    private readonly learningPathRepository: LearningPathRepository,
    private readonly masterCourseService: MasterCourseService,
    private readonly queueService: QueueService,
    private readonly tenantRunner: TenantDbRunnerService,
  ) {}

  async exportLearningPathToTenants(
    sourceLearningPathId: UUIDType,
    targetTenantIds: UUIDType[],
    actor: CurrentUserType,
  ): Promise<{ sourceLearningPathId: UUIDType; jobs: ExportQueueItem[] }> {
    this.assertManagingTenantAdmin(actor);

    const uniqueTargetTenantIds = Array.from(new Set(targetTenantIds)).filter(
      (tenantId) => tenantId !== actor.tenantId,
    );

    if (!uniqueTargetTenantIds.length) {
      throw new BadRequestException(LEARNING_PATH_ERRORS.EXPORT_NO_TARGET_TENANTS);
    }

    const sourceSnapshot = await this.learningPathRepository.getLearningPathSourceSnapshot(
      sourceLearningPathId,
      this.db,
    );

    if (!sourceSnapshot) {
      throw new NotFoundException(LEARNING_PATH_ERRORS.NOT_FOUND);
    }

    const jobs: ExportQueueItem[] = [];

    for (const targetTenantId of uniqueTargetTenantIds) {
      const exportLink =
        (await this.learningPathRepository.findLearningPathExportByPair(
          actor.tenantId,
          sourceLearningPathId,
          targetTenantId,
          this.db,
        )) ??
        (await this.learningPathRepository.createLearningPathExport(
          actor.tenantId,
          sourceLearningPathId,
          targetTenantId,
          this.db,
        ));

      const queuedJob = await this.queueService.enqueue<LearningPathExportJobData>(
        QUEUE_NAMES.LEARNING_PATH_EXPORT,
        "learning-path-export",
        {
          exportId: exportLink.id,
          sourceLearningPathId,
          sourceTenantId: actor.tenantId,
          targetTenantId,
          actorId: actor.userId,
        },
        { attempts: 3, backoff: { type: "exponential", delay: 1000 } },
      );

      jobs.push({
        targetTenantId,
        queued: true,
        reason: String(queuedJob.id),
        exportId: exportLink.id,
      });
    }

    return {
      sourceLearningPathId,
      jobs,
    };
  }

  async getLearningPathExports(sourceLearningPathId: UUIDType, actor: CurrentUserType) {
    this.assertManagingTenantAdmin(actor);

    return this.learningPathRepository.getLearningPathExportsForManagingTenant(
      actor.tenantId,
      sourceLearningPathId,
      this.db,
    );
  }

  async getLearningPathExportCandidates(sourceLearningPathId: UUIDType, actor: CurrentUserType) {
    this.assertManagingTenantAdmin(actor);

    const candidates = await this.learningPathRepository.getLearningPathExportCandidates(
      actor.tenantId,
      sourceLearningPathId,
      this.db,
    );

    const tenants = candidates.map((candidate) => ({
      id: candidate.id,
      name: candidate.name,
      host: candidate.host,
      isExported: Boolean(candidate.exportId),
      targetLearningPathId: candidate.targetLearningPathId,
      syncStatus: candidate.syncStatus,
      lastSyncedAt: candidate.lastSyncedAt,
    }));

    const exportedCount = tenants.filter((tenant) => tenant.isExported).length;
    const totalTenants = tenants.length;

    return {
      tenants,
      summary: {
        totalTenants,
        exportedCount,
        remainingCount: Math.max(totalTenants - exportedCount, 0),
      },
    };
  }

  async getJobStatus(jobId: string) {
    const [exportJob, syncJob] = await Promise.all([
      this.queueService.getQueue(QUEUE_NAMES.LEARNING_PATH_EXPORT).getJob(jobId),
      this.queueService.getQueue(QUEUE_NAMES.LEARNING_PATH_SYNC).getJob(jobId),
    ]);

    const job = exportJob ?? syncJob;
    if (!job) return null;

    return {
      id: String(job.id),
      name: job.name,
      state: await job.getState(),
      attemptsMade: job.attemptsMade,
      failedReason: job.failedReason ?? null,
    };
  }

  async processExportJob(data: LearningPathExportJobData) {
    const exportLink = await this.learningPathRepository.getLearningPathExportById(
      data.exportId,
      this.db,
    );

    if (!exportLink) {
      throw new NotFoundException(LEARNING_PATH_ERRORS.EXPORT_LINK_MISSING);
    }

    await this.syncLearningPathExport(exportLink.id);
  }

  async processSyncJob(data: LearningPathSyncJobData) {
    await this.syncLearningPathExport(data.exportId);
  }

  async queueSyncForSourceLearningPath(sourceLearningPathId: UUIDType, triggerEventType: string) {
    const exportLinks = await this.learningPathRepository.getActiveLearningPathExportsBySourcePath(
      sourceLearningPathId,
      this.db,
    );

    for (const exportLink of exportLinks) {
      await this.queueService.enqueue<LearningPathSyncJobData>(
        QUEUE_NAMES.LEARNING_PATH_SYNC,
        "learning-path-sync",
        {
          exportId: exportLink.id,
          sourceLearningPathId: exportLink.sourceLearningPathId,
          sourceTenantId: exportLink.sourceTenantId,
          targetTenantId: exportLink.targetTenantId,
          triggerEventType,
        },
        { attempts: 3, backoff: { type: "exponential", delay: 1000 } },
      );
    }
  }

  private async syncLearningPathExport(exportId: UUIDType) {
    const exportLink = await this.learningPathRepository.getLearningPathExportById(
      exportId,
      this.db,
    );

    if (!exportLink) {
      throw new NotFoundException(LEARNING_PATH_ERRORS.EXPORT_LINK_MISSING);
    }

    const sourceSnapshot = await this.learningPathRepository.getLearningPathSourceSnapshot(
      exportLink.sourceLearningPathId,
      this.db,
    );

    if (!sourceSnapshot) {
      throw new NotFoundException(LEARNING_PATH_ERRORS.NOT_FOUND);
    }

    try {
      const targetLearningPathId = await this.tenantRunner.runWithTenant(
        exportLink.targetTenantId,
        () => this.syncSourceSnapshotToTarget(exportLink, sourceSnapshot),
      );

      await this.learningPathRepository.markLearningPathExportSyncSuccess(
        exportId,
        targetLearningPathId,
        this.db,
      );
    } catch (error) {
      await this.learningPathRepository.markLearningPathExportSyncFailed(exportId, this.db);
      throw error;
    }
  }

  private async syncSourceSnapshotToTarget(
    exportLink: {
      id: UUIDType;
      sourceTenantId: UUIDType;
      targetTenantId: UUIDType;
      sourceLearningPathId: UUIDType;
    },
    sourceSnapshot: NonNullable<
      Awaited<ReturnType<LearningPathRepository["getLearningPathSourceSnapshot"]>>
    >,
  ) {
    const { learningPath, courseLinks } = sourceSnapshot;
    const targetTenantId = exportLink.targetTenantId;
    const targetAuthor = await this.learningPathRepository.findTargetAuthor(this.db);

    if (!targetAuthor) {
      throw new BadRequestException(LEARNING_PATH_ERRORS.EXPORT_TARGET_AUTHOR_MISSING);
    }

    const existingTargetLearningPath =
      await this.learningPathRepository.getTargetLearningPathBySourceId(
        exportLink.sourceTenantId,
        exportLink.sourceLearningPathId,
        targetTenantId,
        this.db,
      );

    const targetValues = {
      title: learningPath.title,
      description: learningPath.description,
      thumbnailReference: learningPath.thumbnailReference,
      status: learningPath.status,
      includesCertificate: learningPath.includesCertificate,
      sequenceEnabled: learningPath.sequenceEnabled,
      authorId: targetAuthor.id,
      originType: COURSE_ORIGIN_TYPES.EXPORTED,
      sourceLearningPathId: learningPath.id,
      sourceTenantId: exportLink.sourceTenantId,
      baseLanguage: learningPath.baseLanguage,
      availableLocales: learningPath.availableLocales,
      tenantId: targetTenantId,
    } as const;

    const targetLearningPath =
      existingTargetLearningPath ??
      (await this.learningPathRepository.createTargetLearningPath(targetValues, this.db));

    if (existingTargetLearningPath) {
      await this.learningPathRepository.updateTargetLearningPath(
        targetLearningPath.id,
        targetValues,
        this.db,
      );
    }

    const targetCourseIds: UUIDType[] = [];

    for (const courseLink of courseLinks) {
      const existingCourseExport = await this.learningPathRepository.findMasterCourseExportByPair(
        learningPath.tenantId,
        courseLink.courseId,
        targetTenantId,
        this.db,
      );

      let targetCourseId = existingCourseExport?.targetCourseId ?? null;

      if (!targetCourseId) {
        const createdExport =
          existingCourseExport ??
          (await this.learningPathRepository.createMasterCourseExportLink(
            learningPath.tenantId,
            courseLink.courseId,
            targetTenantId,
            this.db,
          ));

        await this.masterCourseService.processExportJob({
          sourceCourseId: courseLink.courseId,
          sourceTenantId: learningPath.tenantId,
          targetTenantId,
          actorId: learningPath.authorId,
        });

        const syncedExport = await this.learningPathRepository.findMasterCourseExportByPair(
          learningPath.tenantId,
          courseLink.courseId,
          targetTenantId,
          this.db,
        );

        targetCourseId = syncedExport?.targetCourseId ?? createdExport.targetCourseId ?? null;
      }

      if (!targetCourseId) throw new BadRequestException(LEARNING_PATH_ERRORS.EXPORT_COURSE_FAILED);

      targetCourseIds.push(targetCourseId);

      await this.learningPathRepository.upsertLearningPathEntityMap(
        exportLink.id,
        "course",
        courseLink.courseId,
        targetCourseId,
        this.db,
      );
    }

    await this.learningPathRepository.deleteLearningPathCoursesByPathId(
      targetLearningPath.id,
      this.db,
    );

    await this.learningPathRepository.insertLearningPathCourses(
      targetLearningPath.id,
      targetCourseIds,
      0,
      targetTenantId,
      this.db,
    );

    return targetLearningPath.id;
  }

  private assertManagingTenantAdmin(currentUser: CurrentUserType) {
    if (!hasPermission(currentUser.permissions, PERMISSIONS.LEARNING_PATH_MANAGE)) {
      throw new ForbiddenException(LEARNING_PATH_ERRORS.MISSING_PERMISSION);
    }
  }
}
