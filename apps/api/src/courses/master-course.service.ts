import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { COURSE_ORIGIN_TYPES, PERMISSIONS } from "@repo/shared";
import { Value } from "@sinclair/typebox/value";

import { UUIDSchema } from "src/common";
import { hasPermission } from "src/common/permissions/permission.utils";
import { COURSE_TRANSFER_KINDS } from "src/course-transfer/course-transfer.constants";
import { CourseTransferService } from "src/course-transfer/services/course-transfer.service";
import { MasterCourseQueueService } from "src/courses/master-course.queue.service";
import { MasterCourseRepository } from "src/courses/master-course.repository";

import type { UUIDType } from "src/common";
import type { CurrentUserType } from "src/common/types/current-user.type";
import type { CourseTransferExportCandidatesSearch } from "src/course-transfer/course-transfer.types";
import type {
  MasterCourseExportBody,
  MasterCourseExportCandidatesPage,
  MasterCourseExportLink,
  MasterCourseExportResponse,
} from "src/courses/schemas/masterCourse.schema";
import type { MasterCourseExportJobData, MasterCourseSyncJobData } from "src/queue";

@Injectable()
export class MasterCourseService {
  constructor(
    private readonly masterCourseRepository: MasterCourseRepository,
    private readonly masterCourseQueueService: MasterCourseQueueService,
    private readonly courseTransferService: CourseTransferService,
  ) {}

  async exportCourseToTenants(
    sourceCourseId: UUIDType,
    body: MasterCourseExportBody,
    actor: CurrentUserType,
  ): Promise<MasterCourseExportResponse> {
    await this.assertManagingTenantAdmin(actor);

    const targetTenantIds = this.getUniqueTargetTenantIds(body.targetTenantIds, actor.tenantId);
    if (!targetTenantIds.length) {
      throw new BadRequestException("masterCourse.error.noTargetTenants");
    }

    const sourceCourse = await this.masterCourseRepository.getCourseById(sourceCourseId);
    if (!sourceCourse) throw new NotFoundException("masterCourse.error.sourceCourseNotFound");
    if (sourceCourse.originType === COURSE_ORIGIN_TYPES.EXPORTED) {
      throw new BadRequestException("masterCourse.error.exportedCourseCannotBeSource");
    }

    const eligibleTenantIds = await this.courseTransferService.findEligibleTargetTenantIds(
      actor.tenantId,
      targetTenantIds,
    );
    if (eligibleTenantIds.length !== targetTenantIds.length) {
      throw new BadRequestException("masterCourse.error.noTargetTenants");
    }

    const jobs: MasterCourseExportResponse["jobs"] = [];
    for (const targetTenantId of targetTenantIds) {
      jobs.push(
        await this.courseTransferService.requestExport({
          kind: COURSE_TRANSFER_KINDS.COURSE,
          sourceTenantId: actor.tenantId,
          sourceId: sourceCourseId,
          targetTenantId,
          actorId: actor.userId,
        }),
      );
    }

    return { sourceCourseId, jobs };
  }

  async getCourseExports(
    sourceCourseId: UUIDType,
    actor: CurrentUserType,
  ): Promise<MasterCourseExportLink[]> {
    await this.assertManagingTenantAdmin(actor);

    return this.masterCourseRepository.getCourseExportsForManagingTenant(
      actor.tenantId,
      sourceCourseId,
    );
  }

  async getCourseExportCandidates(
    sourceCourseId: UUIDType,
    actor: CurrentUserType,
    search: CourseTransferExportCandidatesSearch,
  ): Promise<MasterCourseExportCandidatesPage> {
    await this.assertManagingTenantAdmin(actor);

    const { tenants, summary, pagination } = await this.courseTransferService.listExportCandidates(
      {
        kind: COURSE_TRANSFER_KINDS.COURSE,
        sourceTenantId: actor.tenantId,
        sourceId: sourceCourseId,
      },
      search,
    );

    return {
      data: {
        tenants: tenants.map(({ targetId, ...tenant }) => ({
          ...tenant,
          targetCourseId: targetId,
        })),
        summary,
      },
      pagination,
    };
  }

  async getJobStatus(jobId: string) {
    if (Value.Check(UUIDSchema, jobId)) {
      return this.courseTransferService.findTransferStatus(jobId, COURSE_TRANSFER_KINDS.COURSE);
    }

    return this.masterCourseQueueService.getJobStatus(jobId);
  }

  async assertCourseContentEditable(
    courseId: UUIDType,
    allowedFieldKeys: string[] = [],
    attemptedFieldKeys: string[] = [],
  ): Promise<void> {
    const originType = await this.masterCourseRepository.findCourseOriginType(courseId);

    if (!originType) throw new NotFoundException("masterCourse.error.courseNotFound");
    if (originType !== COURSE_ORIGIN_TYPES.EXPORTED) return;

    const editsOnlyAllowedFields =
      attemptedFieldKeys.length > 0 &&
      attemptedFieldKeys.every((field) => allowedFieldKeys.includes(field));

    if (!editsOnlyAllowedFields) {
      throw new ForbiddenException("masterCourse.error.exportedCourseReadonly");
    }
  }

  async assertCourseContentEditableByChapterId(chapterId: UUIDType): Promise<void> {
    const courseId = await this.masterCourseRepository.findCourseIdByChapterId(chapterId);

    if (!courseId) throw new NotFoundException("masterCourse.error.chapterNotFound");
    await this.assertCourseContentEditable(courseId);
  }

  async assertCourseContentEditableByLessonId(lessonId: UUIDType): Promise<void> {
    const courseId = await this.masterCourseRepository.findCourseIdByLessonId(lessonId);

    if (!courseId) throw new NotFoundException("masterCourse.error.lessonNotFound");
    await this.assertCourseContentEditable(courseId);
  }

  /** Requests a sync into every tenant that receives this master course. */
  async queueSyncForSourceCourse(sourceCourseId: UUIDType, triggerEventType: string) {
    const originType = await this.masterCourseRepository.findCourseOriginType(sourceCourseId);
    if (originType !== COURSE_ORIGIN_TYPES.MASTER) return;

    const exportLinks =
      await this.masterCourseRepository.getActiveExportLinksBySourceCourse(sourceCourseId);

    await this.courseTransferService.requestSync({
      kind: COURSE_TRANSFER_KINDS.COURSE,
      sourceId: sourceCourseId,
      relationships: exportLinks.map((exportLink) => ({
        id: exportLink.id,
        sourceTenantId: exportLink.sourceTenantId,
        sourceId: exportLink.sourceCourseId,
        targetTenantId: exportLink.targetTenantId,
      })),
      triggerEventType,
    });
  }

  async transferFromLegacyExportJob(job: MasterCourseExportJobData) {
    return this.courseTransferService.transferFromJob({
      kind: COURSE_TRANSFER_KINDS.COURSE,
      operationId: job.operationId,
      sourceTenantId: job.sourceTenantId,
      sourceId: job.sourceCourseId,
      targetTenantId: job.targetTenantId,
      payload: { ...job },
    });
  }

  async transferFromSyncJob(job: MasterCourseSyncJobData) {
    return this.courseTransferService.transferFromJob({
      kind: COURSE_TRANSFER_KINDS.COURSE,
      exportId: job.exportId,
      operationId: job.operationId,
      sourceTenantId: job.sourceTenantId,
      sourceId: job.sourceCourseId,
      targetTenantId: job.targetTenantId,
      payload: { ...job },
    });
  }

  private getUniqueTargetTenantIds(
    targetTenantIds: UUIDType[],
    sourceTenantId: UUIDType,
  ): UUIDType[] {
    return Array.from(new Set(targetTenantIds)).filter((tenantId) => tenantId !== sourceTenantId);
  }

  private async assertManagingTenantAdmin(actor: CurrentUserType) {
    if (!hasPermission(actor.permissions, PERMISSIONS.TENANT_MANAGE)) {
      throw new ForbiddenException("auth.error.adminRoleRequired");
    }

    const tenant = await this.masterCourseRepository.getTenantManagingStatus(actor.tenantId);
    if (!tenant?.isManaging) {
      throw new ForbiddenException("superAdminTenants.error.managingTenantRequired");
    }
  }
}
