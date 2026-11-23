/** Materializes an approved pre-course export and its durable placeholder mapping. */
import { randomUUID } from "node:crypto";

import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  ServiceUnavailableException,
} from "@nestjs/common";
import {
  ALLOWED_LESSON_IMAGE_FILE_TYPES,
  COURSE_STATUSES,
  PERMISSIONS,
  hasPermission,
} from "@repo/shared";
import { Value } from "@sinclair/typebox/value";

import { CategoryService } from "src/category/category.service";
import { CourseService } from "src/courses/course.service";
import { isOutboxProcessingEnabled } from "src/outbox/outbox.constants";
import { PermissionsService } from "src/permissions/permissions.service";

import { CourseAuthoringApplicationRepository } from "./course-authoring-application.repository";
import { CourseAuthoringDraftRepository } from "./course-authoring-draft.repository";
import {
  stripAuthoringHtmlStyles,
  validateAuthoringHtml,
  validateAuthoringMedia,
} from "./course-authoring-html";
import { authoringCourseCreateOperationSchema } from "./schema/course-authoring-operations.schema";

import type { PreparedCourseAuthoringApplication } from "./course-authoring.types";
import type { CurrentUserType } from "src/common/types/current-user.type";

@Injectable()
export class CourseAuthoringDraftApplyService {
  constructor(
    private readonly courseAuthoringApplicationRepository: CourseAuthoringApplicationRepository,
    private readonly courseAuthoringDraftRepository: CourseAuthoringDraftRepository,
    private readonly categoryService: CategoryService,
    private readonly courseService: CourseService,
    private readonly permissionsService: PermissionsService,
  ) {}

  /** Creates a single draft course, commits native events, and binds the approved session once. */
  async applyPreparedExport(input: PreparedCourseAuthoringApplication, actor: CurrentUserType) {
    const access = await this.permissionsService.getUserAccess(actor.userId);
    const currentActor = { ...actor, ...access };
    if (
      !hasPermission(currentActor.permissions, PERMISSIONS.COURSE_AI_GENERATION) ||
      !hasPermission(currentActor.permissions, PERMISSIONS.COURSE_CREATE)
    ) {
      throw new ForbiddenException("common.toast.noAccess");
    }
    if (!isOutboxProcessingEnabled())
      throw new ServiceUnavailableException("courseAuthoring.errors.outboxUnavailable");

    const [operation] = input.operations;
    if (
      input.operations.length !== 1 ||
      !Value.Check(authoringCourseCreateOperationSchema, operation) ||
      operation.targetId !== input.courseId ||
      operation.language !== operation.payload.language ||
      !operation.payload.title.trim() ||
      !operation.payload.description.trim() ||
      operation.payload.learningOutcomes.some((outcome) => !outcome.trim())
    ) {
      throw new BadRequestException("courseAuthoring.errors.invalidOperations");
    }

    const payload = operation.payload;
    validateAuthoringHtml(payload.description);
    validateAuthoringMedia(payload.description, new Set(), new Set(), new Set());
    const description = stripAuthoringHtmlStyles(payload.description);
    const thumbnailAssetId = payload.thumbnailAssetId;
    const thumbnailS3Key = thumbnailAssetId ? input.assetMappings[thumbnailAssetId] : undefined;
    const stagedKeys = Object.values(input.assetMappings);
    if (
      (thumbnailAssetId &&
        (!thumbnailS3Key ||
          !ALLOWED_LESSON_IMAGE_FILE_TYPES.includes(input.assetMimeTypes[thumbnailAssetId]))) ||
      stagedKeys.length !== (thumbnailS3Key ? 1 : 0)
    ) {
      throw new BadRequestException("courseAuthoring.errors.invalidOperations");
    }

    const identity = {
      tenantId: currentActor.tenantId,
      placeholderCourseId: input.courseId,
      sessionId: input.sessionId,
      ownerId: currentActor.userId,
    };
    return this.courseAuthoringApplicationRepository.applyOnce(
      {
        tenantId: identity.tenantId,
        actorId: identity.ownerId,
        courseId: identity.placeholderCourseId,
        draftCourseId: identity.placeholderCourseId,
        sessionId: identity.sessionId,
        exportId: input.exportId,
        exportHash: input.exportHash,
      },
      async (transaction) => {
        await this.courseAuthoringDraftRepository.lockForCreation(identity, transaction);
        const categoryId = await this.categoryService.resolveForCourseAuthoring(
          payload,
          payload.language,
          currentActor,
          transaction,
        );
        const course = await this.courseService.createCourseInTransaction(
          {
            title: payload.title.trim(),
            description,
            learningOutcomes: payload.learningOutcomes,
            language: payload.language,
            categoryId,
            thumbnailS3Key,
            status: COURSE_STATUSES.DRAFT,
          },
          currentActor,
          false,
          transaction,
          `authoring:${identity.tenantId}:${input.exportId}`,
        );
        await this.courseAuthoringDraftRepository.attachCourse(identity, course.id, transaction);
        await this.courseService.publishCreateCourseEvent(
          course.id,
          payload.language,
          currentActor,
          transaction,
        );
        return {
          applicationId: randomUUID(),
          exportHash: input.exportHash,
          status: "applied",
          exportId: input.exportId,
          courseId: identity.placeholderCourseId,
          sessionId: identity.sessionId,
          appliedOperationIds: [operation.operationId],
          entityMappings: { [identity.placeholderCourseId]: course.id },
          assetMappings: input.assetMappings,
        };
      },
      stagedKeys,
    );
  }
}
