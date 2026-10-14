import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PERMISSIONS } from "@repo/shared";
import { Value } from "@sinclair/typebox/value";

import { UUIDSchema, type UUIDType } from "src/common";
import { hasPermission } from "src/common/permissions/permission.utils";
import { COURSE_TRANSFER_KINDS } from "src/course-transfer/course-transfer.constants";
import { CourseTransferSnapshotService } from "src/course-transfer/services/course-transfer-snapshot.service";
import { CourseTransferService } from "src/course-transfer/services/course-transfer.service";

import { LEARNING_PATH_ERRORS } from "../constants/learning-path.errors";
import { LearningPathQueueService } from "../learning-path.queue.service";
import { LearningPathRepository } from "../learning-path.repository";

import type { ExportQueueItem } from "./learning-path-export.types";
import type { LearningPathExportCandidatesPage } from "../learning-path.schema";
import type { CurrentUserType } from "src/common/types/current-user.type";
import type { CourseTransferExportCandidatesSearch } from "src/course-transfer/course-transfer.types";
import type { LearningPathExportJobData, LearningPathSyncJobData } from "src/queue/queue.types";

@Injectable()
export class LearningPathExportService {
  constructor(
    private readonly learningPathRepository: LearningPathRepository,
    private readonly learningPathQueueService: LearningPathQueueService,
    private readonly courseTransferService: CourseTransferService,
    private readonly courseTransferSnapshotService: CourseTransferSnapshotService,
  ) {}

  async exportLearningPathToTenants(
    sourceLearningPathId: UUIDType,
    targetTenantIds: UUIDType[],
    actor: CurrentUserType,
  ): Promise<{ sourceLearningPathId: UUIDType; jobs: ExportQueueItem[] }> {
    this.assertCanExportLearningPaths(actor);

    const eligibleTargetTenantIds = await this.getEligibleTargetTenantIds(
      actor.tenantId,
      targetTenantIds,
    );
    if (!eligibleTargetTenantIds.length) {
      throw new BadRequestException(LEARNING_PATH_ERRORS.EXPORT_NO_TARGET_TENANTS);
    }

    const sourceSnapshot = await this.courseTransferSnapshotService.readLearningPath({
      tenantId: actor.tenantId,
      learningPathId: sourceLearningPathId,
    });
    if (!sourceSnapshot) throw new NotFoundException(LEARNING_PATH_ERRORS.EXPORT_SOURCE_NOT_FOUND);
    if (!sourceSnapshot.courseLinks.length) {
      throw new BadRequestException(LEARNING_PATH_ERRORS.EXPORT_NO_COURSES);
    }

    const jobs: ExportQueueItem[] = [];
    for (const targetTenantId of eligibleTargetTenantIds) {
      jobs.push(
        await this.courseTransferService.requestExport({
          kind: COURSE_TRANSFER_KINDS.LEARNING_PATH,
          sourceTenantId: actor.tenantId,
          sourceId: sourceLearningPathId,
          targetTenantId,
          actorId: actor.userId,
        }),
      );
    }

    return { sourceLearningPathId, jobs };
  }

  async getLearningPathExports(sourceLearningPathId: UUIDType, actor: CurrentUserType) {
    this.assertCanExportLearningPaths(actor);

    return this.learningPathRepository.getLearningPathExportsForManagingTenant(
      actor.tenantId,
      sourceLearningPathId,
    );
  }

  async getLearningPathExportCandidates(
    sourceLearningPathId: UUIDType,
    actor: CurrentUserType,
    search: CourseTransferExportCandidatesSearch,
  ): Promise<LearningPathExportCandidatesPage> {
    this.assertCanExportLearningPaths(actor);

    const { tenants, summary, pagination } = await this.courseTransferService.listExportCandidates(
      {
        kind: COURSE_TRANSFER_KINDS.LEARNING_PATH,
        sourceTenantId: actor.tenantId,
        sourceId: sourceLearningPathId,
      },
      search,
    );

    return {
      data: {
        tenants: tenants.map(({ targetId, ...tenant }) => ({
          ...tenant,
          targetLearningPathId: targetId,
        })),
        summary,
      },
      pagination,
    };
  }

  async getJobStatus(jobId: string) {
    if (Value.Check(UUIDSchema, jobId)) {
      return this.courseTransferService.findTransferStatus(
        jobId,
        COURSE_TRANSFER_KINDS.LEARNING_PATH,
      );
    }

    return this.learningPathQueueService.getJobStatus(jobId);
  }

  /** Requests a sync into every tenant that receives this learning path. */
  async queueSyncForSourceLearningPath(sourceLearningPathId: UUIDType, triggerEventType: string) {
    const sourcePath = await this.learningPathRepository.findLearningPathById(sourceLearningPathId);
    if (!sourcePath) return;

    const exportLinks =
      await this.learningPathRepository.getSyncableLearningPathExportsBySourcePath(
        sourceLearningPathId,
      );

    await this.courseTransferService.requestSync({
      kind: COURSE_TRANSFER_KINDS.LEARNING_PATH,
      sourceId: sourceLearningPathId,
      relationships: exportLinks.map((exportLink) => ({
        id: exportLink.id,
        sourceTenantId: exportLink.sourceTenantId,
        sourceId: exportLink.sourceLearningPathId,
        targetTenantId: exportLink.targetTenantId,
      })),
      triggerEventType,
    });
  }

  async transferFromLegacyExportJob(job: LearningPathExportJobData) {
    return this.courseTransferService.transferFromJob({
      kind: COURSE_TRANSFER_KINDS.LEARNING_PATH,
      exportId: job.exportId,
      operationId: job.operationId,
      sourceTenantId: job.sourceTenantId,
      sourceId: job.sourceLearningPathId,
      targetTenantId: job.targetTenantId,
      payload: { ...job },
    });
  }

  async transferFromSyncJob(job: LearningPathSyncJobData) {
    return this.courseTransferService.transferFromJob({
      kind: COURSE_TRANSFER_KINDS.LEARNING_PATH,
      exportId: job.exportId,
      operationId: job.operationId,
      sourceTenantId: job.sourceTenantId,
      sourceId: job.sourceLearningPathId,
      targetTenantId: job.targetTenantId,
      payload: { ...job },
    });
  }

  private async getEligibleTargetTenantIds(
    sourceTenantId: UUIDType,
    targetTenantIds: UUIDType[],
  ): Promise<UUIDType[]> {
    const requestedTenantIds = Array.from(
      new Set(targetTenantIds.map((tenantId) => tenantId.trim())),
    ).filter((tenantId) => Value.Check(UUIDSchema, tenantId));

    return this.courseTransferService.findEligibleTargetTenantIds(
      sourceTenantId,
      requestedTenantIds,
    );
  }

  private assertCanExportLearningPaths(actor: CurrentUserType) {
    if (!hasPermission(actor.permissions, PERMISSIONS.LEARNING_PATH_EXPORT)) {
      throw new ForbiddenException(LEARNING_PATH_ERRORS.MISSING_PERMISSION);
    }
  }
}
