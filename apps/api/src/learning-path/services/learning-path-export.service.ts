import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { COURSE_ORIGIN_TYPES, PERMISSIONS } from "@repo/shared";
import { eq } from "drizzle-orm";
import { validate as uuidValidate } from "uuid";

import { DatabasePg, type UUIDType } from "src/common";
import { buildJsonbFieldWithMultipleEntries } from "src/common/helpers/sqlHelpers";
import { hasPermission } from "src/common/permissions/permission.utils";
import { MasterCourseService } from "src/courses/master-course.service";
import { TenantDbRunnerService } from "src/storage/db/tenant-db-runner.service";
import { learningPaths } from "src/storage/schema";

import { LEARNING_PATH_ERRORS } from "../constants/learning-path.errors";
import { LearningPathQueueService } from "../learning-path.queue.service";
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
    private readonly queueService: LearningPathQueueService,
    private readonly tenantRunner: TenantDbRunnerService,
  ) {}

  async exportLearningPathToTenants(
    sourceLearningPathId: UUIDType,
    targetTenantIds: UUIDType[],
    actor: CurrentUserType,
  ): Promise<{ sourceLearningPathId: UUIDType; jobs: ExportQueueItem[] }> {
    this.assertManagingTenantAdmin(actor);

    const uniqueTargetTenantIds = await this.getUniqueTargetTenantIds(
      actor.tenantId,
      sourceLearningPathId,
      targetTenantIds,
    );

    if (!uniqueTargetTenantIds.length) {
      throw new BadRequestException(LEARNING_PATH_ERRORS.EXPORT_NO_TARGET_TENANTS);
    }

    const sourceSnapshot = await this.learningPathRepository.getLearningPathExportSourceSnapshot(
      actor.tenantId,
      sourceLearningPathId,
    );

    if (!sourceSnapshot) {
      throw new NotFoundException(LEARNING_PATH_ERRORS.NOT_FOUND);
    }

    if (!sourceSnapshot.courseLinks.length) {
      throw new BadRequestException(LEARNING_PATH_ERRORS.EXPORT_NO_COURSES);
    }

    const jobs: ExportQueueItem[] = [];

    for (const targetTenantId of uniqueTargetTenantIds) {
      const existingExportLink = await this.learningPathRepository.findLearningPathExportByPair(
        actor.tenantId,
        sourceLearningPathId,
        targetTenantId,
        this.db,
      );

      if (existingExportLink) {
        jobs.push({
          targetTenantId,
          queued: false,
          reason: "already-linked",
          exportId: existingExportLink.id,
        });
        continue;
      }

      const exportLink = await this.learningPathRepository.createLearningPathExport(
        actor.tenantId,
        sourceLearningPathId,
        targetTenantId,
        this.db,
      );

      const queuedJob = await this.queueService.enqueueExport({
        exportId: exportLink.id,
        sourceLearningPathId,
        sourceTenantId: actor.tenantId,
        targetTenantId,
        actorId: actor.userId,
      });

      jobs.push({
        targetTenantId,
        queued: true,
        reason: String(queuedJob.id),
        exportId: exportLink.id,
      });
    }

    await this.learningPathRepository.markLearningPathAsMaster(sourceLearningPathId, this.db);

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
    return this.queueService.getJobStatus(jobId);
  }

  async processExportJob(data: LearningPathExportJobData) {
    if (
      !uuidValidate(data.exportId) ||
      !uuidValidate(data.sourceLearningPathId) ||
      !uuidValidate(data.sourceTenantId) ||
      !uuidValidate(data.targetTenantId) ||
      !uuidValidate(data.actorId)
    ) {
      throw new BadRequestException("Invalid learning path export job data");
    }

    const exportId = await this.resolveExportIdForJob(data);

    await this.syncLearningPathExport(exportId);
  }

  async processSyncJob(data: LearningPathSyncJobData) {
    await this.syncLearningPathExport(data.exportId);
  }

  async queueSyncForSourceLearningPath(sourceLearningPathId: UUIDType, triggerEventType: string) {
    const [sourcePath] = await this.db
      .select({ originType: learningPaths.originType })
      .from(learningPaths)
      .where(eq(learningPaths.id, sourceLearningPathId))
      .limit(1);

    if (!sourcePath) {
      return;
    }

    const exportLinks = await this.learningPathRepository.getActiveLearningPathExportsBySourcePath(
      sourceLearningPathId,
      this.db,
    );

    if (sourcePath.originType !== COURSE_ORIGIN_TYPES.MASTER && exportLinks.length === 0) {
      return;
    }

    if (sourcePath.originType !== COURSE_ORIGIN_TYPES.MASTER) {
      await this.learningPathRepository.markLearningPathAsMaster(sourceLearningPathId, this.db);
    }

    for (const exportLink of exportLinks) {
      if (
        !uuidValidate(exportLink.targetTenantId) ||
        !uuidValidate(exportLink.sourceTenantId) ||
        !uuidValidate(exportLink.sourceLearningPathId)
      ) {
        await this.learningPathRepository.markLearningPathExportSyncFailed(exportLink.id, this.db);
        continue;
      }

      await this.queueService.enqueueSync({
        exportId: exportLink.id,
        sourceLearningPathId: exportLink.sourceLearningPathId,
        sourceTenantId: exportLink.sourceTenantId,
        targetTenantId: exportLink.targetTenantId,
        triggerEventType,
      });
    }
  }

  private async syncLearningPathExport(exportId: UUIDType) {
    try {
      const trimmedExportId = String(exportId ?? "").trim();

      if (!uuidValidate(trimmedExportId)) {
        throw new BadRequestException("Invalid learning path export id");
      }

      const exportLink = await this.learningPathRepository.getLearningPathExportById(
        trimmedExportId,
        this.db,
      );

      if (!exportLink) {
        throw new NotFoundException(LEARNING_PATH_ERRORS.EXPORT_LINK_MISSING);
      }

      const syncExportLink = {
        ...exportLink,
        sourceTenantId: String(exportLink.sourceTenantId ?? "").trim(),
        sourceLearningPathId: String(exportLink.sourceLearningPathId ?? "").trim(),
        targetTenantId: String(exportLink.targetTenantId ?? "").trim(),
      };

      if (
        !uuidValidate(syncExportLink.sourceTenantId) ||
        !uuidValidate(syncExportLink.targetTenantId) ||
        !uuidValidate(syncExportLink.sourceLearningPathId)
      ) {
        await this.learningPathRepository.markLearningPathExportSyncFailed(
          trimmedExportId,
          this.db,
        );
        throw new BadRequestException("Invalid learning path export link");
      }

      const sourceSnapshot = await this.learningPathRepository.getLearningPathExportSourceSnapshot(
        syncExportLink.sourceTenantId,
        syncExportLink.sourceLearningPathId,
      );

      if (!sourceSnapshot) {
        throw new NotFoundException(LEARNING_PATH_ERRORS.NOT_FOUND);
      }

      if (!sourceSnapshot.courseLinks.length) {
        throw new BadRequestException(LEARNING_PATH_ERRORS.EXPORT_NO_COURSES);
      }

      const targetLearningPathId = await this.tenantRunner.runWithTenant(
        syncExportLink.targetTenantId,
        async () => this.syncSourceSnapshotToTarget(syncExportLink, sourceSnapshot),
      );

      await this.learningPathRepository.markLearningPathExportSyncSuccess(
        exportId,
        targetLearningPathId,
        this.db,
      );
    } catch (error) {
      if (exportId) {
        await this.learningPathRepository.markLearningPathExportSyncFailed(exportId, this.db);
      }
      throw error;
    }
  }

  private async resolveExportIdForJob(data: LearningPathExportJobData): Promise<UUIDType> {
    const exportLinkById = await this.learningPathRepository.getLearningPathExportById(
      data.exportId,
      this.db,
    );

    if (exportLinkById) {
      return exportLinkById.id;
    }

    const exportLinkByPair = await this.learningPathRepository.findLearningPathExportByPair(
      data.sourceTenantId,
      data.sourceLearningPathId,
      data.targetTenantId,
      this.db,
    );

    if (exportLinkByPair) {
      return exportLinkByPair.id;
    }

    const sourceSnapshot = await this.learningPathRepository.getLearningPathExportSourceSnapshot(
      data.sourceTenantId,
      data.sourceLearningPathId,
    );

    if (!sourceSnapshot) {
      throw new NotFoundException(LEARNING_PATH_ERRORS.NOT_FOUND);
    }

    if (!sourceSnapshot.courseLinks.length) {
      throw new BadRequestException(LEARNING_PATH_ERRORS.EXPORT_NO_COURSES);
    }

    const recreatedExport = await this.learningPathRepository.createLearningPathExport(
      data.sourceTenantId,
      data.sourceLearningPathId,
      data.targetTenantId,
      this.db,
    );

    return recreatedExport.id;
  }

  private async syncSourceSnapshotToTarget(
    exportLink: {
      id: UUIDType;
      sourceTenantId: UUIDType;
      targetTenantId: UUIDType;
      sourceLearningPathId: UUIDType;
    },
    sourceSnapshot: NonNullable<
      Awaited<ReturnType<LearningPathRepository["getLearningPathExportSourceSnapshot"]>>
    >,
  ) {
    const { learningPath, courseLinks } = sourceSnapshot;
    const targetTenantId = exportLink.targetTenantId;
    const targetAuthor = await this.learningPathRepository.findTargetAuthor(this.db);

    if (!targetAuthor) {
      throw new BadRequestException(LEARNING_PATH_ERRORS.EXPORT_TARGET_AUTHOR_MISSING);
    }

    const targetCourseIds: UUIDType[] = [];

    for (const courseLink of courseLinks) {
      const targetCourseId = await this.masterCourseService.ensureCourseExportSynced({
        sourceCourseId: courseLink.courseId,
        sourceTenantId: learningPath.tenantId,
        targetTenantId,
      });

      if (!targetCourseId) {
        throw new BadRequestException(LEARNING_PATH_ERRORS.EXPORT_COURSE_FAILED);
      }

      targetCourseIds.push(targetCourseId);

      await this.learningPathRepository.upsertLearningPathEntityMap(
        exportLink.id,
        "course",
        courseLink.courseId,
        targetCourseId,
        this.db,
      );
    }

    const existingTargetLearningPath =
      await this.learningPathRepository.getTargetLearningPathBySourceId(
        exportLink.sourceTenantId,
        exportLink.sourceLearningPathId,
        targetTenantId,
        this.db,
      );

    const targetValues = {
      title: buildJsonbFieldWithMultipleEntries(
        learningPath.title,
      ) as typeof learningPaths.$inferInsert.title,
      description: buildJsonbFieldWithMultipleEntries(
        learningPath.description,
      ) as typeof learningPaths.$inferInsert.description,
      thumbnailReference: learningPath.thumbnailReference,
      status: learningPath.status,
      includesCertificate: learningPath.includesCertificate,
      settings: learningPath.settings,
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

  private async getUniqueTargetTenantIds(
    sourceTenantId: UUIDType,
    sourceLearningPathId: UUIDType,
    targetTenantIds: UUIDType[],
  ): Promise<UUIDType[]> {
    const candidates = await this.learningPathRepository.getLearningPathExportCandidates(
      sourceTenantId,
      sourceLearningPathId,
      this.db,
    );

    const candidateTenantIds = new Set(candidates.map((candidate) => candidate.id));

    return Array.from(new Set(targetTenantIds.map((tenantId) => tenantId.trim()))).filter(
      (tenantId) =>
        uuidValidate(tenantId) && tenantId !== sourceTenantId && candidateTenantIds.has(tenantId),
    );
  }

  private assertManagingTenantAdmin(currentUser: CurrentUserType) {
    if (!hasPermission(currentUser.permissions, PERMISSIONS.LEARNING_PATH_EXPORT)) {
      throw new ForbiddenException(LEARNING_PATH_ERRORS.MISSING_PERMISSION);
    }
  }
}
