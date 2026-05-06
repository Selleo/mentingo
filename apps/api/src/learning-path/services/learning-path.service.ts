import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from "@nestjs/common";
import {
  LEARNING_PATH_ENROLLMENT_TYPES,
  LEARNING_PATH_PROGRESS_STATUSES,
  PERMISSIONS,
  type SupportedLanguages,
} from "@repo/shared";
import { match } from "ts-pattern";

import { DatabasePg, type Pagination, type UUIDType } from "src/common";
import { hasPermission } from "src/common/permissions/permission.utils";
import {
  LearningPathCourseAddedEvent,
  LearningPathCourseRemovedEvent,
  LearningPathCourseSyncEvent,
} from "src/events";
import { LocalizationService } from "src/localization/localization.service";
import { OutboxPublisher } from "src/outbox/outbox.publisher";
import { hasDataToUpdate } from "src/utils/hasDataToUpdate";
import { PROGRESS_STATUSES, type ProgressStatus } from "src/utils/types/progress.type";

import { LEARNING_PATH_ERRORS } from "../constants/learning-path.errors";
import { LearningPathRepository } from "../learning-path.repository";

import { LearningPathCourseSyncService } from "./learning-path-course-sync.service";
import { LearningPathExportService } from "./learning-path-export.service";

import type {
  CreateLearningPathBody,
  LearningPathCourseIdsBody,
  LearningPathCourseDetailSchema,
  LearningPathDetailSchema,
  LearningPathGroupIdsBody,
  LearningPathSchema,
  LearningPathStudentIdsBody,
  UpdateLearningPathBody,
} from "../learning-path.schema";
import type {
  ExistingLearningPath,
  LearningPathCourseProgressRow,
  LearningPathProgressState,
  LearningPathUpdateData,
} from "../learning-path.types";
import type { CurrentUserType } from "src/common/types/current-user.type";

@Injectable()
export class LearningPathService {
  constructor(
    @Inject("DB") private readonly db: DatabasePg,
    private readonly learningPathRepository: LearningPathRepository,
    private readonly outboxPublisher: OutboxPublisher,
    private readonly localizationService: LocalizationService,
    private readonly learningPathCourseSyncService: LearningPathCourseSyncService,
    private readonly learningPathExportService: LearningPathExportService,
  ) {}

  private assertManagePermission(currentUser: CurrentUserType) {
    if (!hasPermission(currentUser.permissions, PERMISSIONS.LEARNING_PATH_MANAGE)) {
      throw new ForbiddenException(LEARNING_PATH_ERRORS.MISSING_PERMISSION);
    }
  }

  private assertReadPermission(currentUser: CurrentUserType) {
    if (!hasPermission(currentUser.permissions, PERMISSIONS.LEARNING_PATH_READ)) {
      throw new ForbiddenException(LEARNING_PATH_ERRORS.MISSING_PERMISSION);
    }
  }

  private async ensureLearningPathExists(
    learningPathId: UUIDType,
    dbInstance: DatabasePg = this.db,
  ) {
    const learningPath = await this.learningPathRepository.findLearningPathById(
      learningPathId,
      dbInstance,
    );

    if (!learningPath) {
      throw new NotFoundException(LEARNING_PATH_ERRORS.NOT_FOUND);
    }

    return learningPath;
  }

  private buildUpdateData(
    existingLearningPath: ExistingLearningPath,
    updateLearningPathData: Partial<Omit<UpdateLearningPathBody, "language">>,
    language?: SupportedLanguages,
  ): LearningPathUpdateData {
    const localizableFields = ["title", "description"] as const;

    const directFields: Array<
      keyof Omit<UpdateLearningPathBody, "language" | "title" | "description">
    > = ["thumbnailReference", "status", "includesCertificate", "sequenceEnabled"];

    const updateData: LearningPathUpdateData = {};

    if (language) {
      Object.assign(
        updateData,
        this.localizationService.updateLocalizableFields(
          localizableFields,
          existingLearningPath,
          updateLearningPathData,
          language,
        ),
      );
    }

    directFields.forEach((field) => {
      if (field in updateLearningPathData && updateLearningPathData[field] !== undefined) {
        Object.assign(updateData, { [field]: updateLearningPathData[field] });
      }
    });

    return updateData;
  }

  private async publishLearningPathCourseSyncEvent(
    learningPathId: UUIDType,
    tenantId: UUIDType,
    dbInstance: DatabasePg,
  ) {
    await this.outboxPublisher.publish(
      new LearningPathCourseSyncEvent({
        tenantId,
        learningPathId,
      }),
      dbInstance,
    );
  }

  private async publishLearningPathCourseAddedEvent(
    learningPathId: UUIDType,
    courseId: UUIDType,
    tenantId: UUIDType,
    dbInstance: DatabasePg,
  ) {
    await this.outboxPublisher.publish(
      new LearningPathCourseAddedEvent({
        tenantId,
        learningPathId,
        courseId,
      }),
      dbInstance,
    );
  }

  private async publishLearningPathCourseRemovedEvent(
    learningPathId: UUIDType,
    courseId: UUIDType,
    tenantId: UUIDType,
    dbInstance: DatabasePg,
  ) {
    await this.outboxPublisher.publish(
      new LearningPathCourseRemovedEvent({
        tenantId,
        learningPathId,
        courseId,
      }),
      dbInstance,
    );
  }

  async createLearningPath(body: CreateLearningPathBody, currentUser: CurrentUserType) {
    this.assertManagePermission(currentUser);

    const createdLearningPath = await this.learningPathRepository.createLearningPath(
      body,
      currentUser,
    );

    if (!createdLearningPath) {
      throw new UnprocessableEntityException(LEARNING_PATH_ERRORS.CREATE_FAILED);
    }

    return createdLearningPath;
  }

  async getLearningPaths(
    currentUser: CurrentUserType,
    page?: number,
    perPage?: number,
  ): Promise<{ data: LearningPathSchema[]; pagination: Pagination }> {
    this.assertReadPermission(currentUser);

    return this.learningPathRepository.getLearningPaths(page, perPage);
  }

  async getLearningPathById(
    learningPathId: UUIDType,
    currentUser: CurrentUserType,
  ): Promise<LearningPathDetailSchema> {
    this.assertReadPermission(currentUser);

    const learningPath = await this.ensureLearningPathExists(learningPathId);
    const progressState = await this.learningPathRepository.getLearningPathProgressState(
      learningPathId,
      currentUser.userId,
    );

    return {
      ...learningPath,
      progress: this.resolveLearningPathProgress(progressState),
      courses: this.buildLearningPathCourseDetail(
        progressState.courses,
        progressState.studentCourseProgressRows,
        progressState.isEnrolled,
        learningPath.sequenceEnabled,
      ),
    };
  }

  async updateLearningPath(
    learningPathId: UUIDType,
    body: UpdateLearningPathBody,
    currentUser: CurrentUserType,
  ) {
    this.assertManagePermission(currentUser);

    const existingLearningPath = await this.ensureLearningPathExists(learningPathId);

    const { language, ...updateLearningPathData } = body;

    const hasLocalizedUpdates =
      updateLearningPathData.title !== undefined ||
      updateLearningPathData.description !== undefined;

    if (hasLocalizedUpdates && !language) {
      throw new BadRequestException(LEARNING_PATH_ERRORS.UPDATE_MISSING_LANGUAGE);
    }

    if (
      hasLocalizedUpdates &&
      language &&
      !existingLearningPath.availableLocales.includes(language)
    ) {
      throw new BadRequestException(LEARNING_PATH_ERRORS.LANGUAGE_NOT_SUPPORTED);
    }

    const updateData = this.buildUpdateData(existingLearningPath, updateLearningPathData, language);

    if (!hasDataToUpdate(updateData) && updateData.thumbnailReference !== null) {
      throw new BadRequestException(LEARNING_PATH_ERRORS.UPDATE_FAILED);
    }

    const sequenceEnabledChanged =
      updateData.sequenceEnabled !== undefined &&
      updateData.sequenceEnabled !== existingLearningPath.sequenceEnabled;
    const includesCertificateChanged =
      updateData.includesCertificate !== undefined &&
      updateData.includesCertificate !== existingLearningPath.includesCertificate;

    const updatedLearningPath = await this.db.transaction(async (trx) => {
      const learningPath = await this.learningPathRepository.updateLearningPath(
        learningPathId,
        updateData,
        trx,
      );

      if (learningPath && (sequenceEnabledChanged || includesCertificateChanged)) {
        await this.publishLearningPathCourseSyncEvent(learningPathId, currentUser.tenantId, trx);
      }

      return learningPath;
    });

    if (!updatedLearningPath) {
      throw new UnprocessableEntityException(LEARNING_PATH_ERRORS.UPDATE_FAILED);
    }

    await this.learningPathExportService.queueSyncForSourceLearningPath(
      learningPathId,
      "update-learning-path",
    );

    return updatedLearningPath;
  }

  async deleteLearningPath(learningPathId: UUIDType, currentUser: CurrentUserType) {
    this.assertManagePermission(currentUser);

    const [deletedLearningPath] = await this.db.transaction(async (trx) => {
      await this.ensureLearningPathExists(learningPathId, trx);

      const studentIds = await this.learningPathRepository.getLearningPathStudentIds(
        learningPathId,
        trx,
      );

      await this.learningPathCourseSyncService.removeLearningPathCourseAccess(
        learningPathId,
        studentIds,
        trx,
      );

      return this.learningPathRepository.deleteLearningPath(learningPathId, trx);
    });

    if (!deletedLearningPath) {
      throw new NotFoundException(LEARNING_PATH_ERRORS.NOT_FOUND);
    }
  }

  async addCoursesToLearningPath(
    learningPathId: UUIDType,
    body: LearningPathCourseIdsBody,
    currentUser: CurrentUserType,
  ) {
    this.assertManagePermission(currentUser);

    if (body.courseIds.length === 0) {
      throw new BadRequestException(LEARNING_PATH_ERRORS.COURSE_IDS_EMPTY);
    }

    const addedCourses = await this.db.transaction(async (trx) => {
      await this.ensureLearningPathExists(learningPathId, trx);

      const uniqueCourseIds = Array.from(new Set(body.courseIds));

      if (uniqueCourseIds.length !== body.courseIds.length) {
        throw new BadRequestException(LEARNING_PATH_ERRORS.COURSE_IDS_UNIQUE);
      }

      const existingPathCourseIds = await this.learningPathRepository.getLearningPathCourseIds(
        learningPathId,
        trx,
      );

      const alreadyAssignedCourseIds = uniqueCourseIds.filter((courseId) =>
        existingPathCourseIds.includes(courseId),
      );

      if (alreadyAssignedCourseIds.length > 0) {
        throw new ConflictException(LEARNING_PATH_ERRORS.COURSE_ALREADY_EXISTS);
      }

      const existingCourses = await this.learningPathRepository.getCoursesByIds(
        uniqueCourseIds,
        trx,
      );

      if (existingCourses.length !== uniqueCourseIds.length) {
        throw new NotFoundException(LEARNING_PATH_ERRORS.COURSE_NOT_FOUND);
      }

      const maxDisplayOrder = await this.learningPathRepository.getMaxDisplayOrder(
        learningPathId,
        trx,
      );

      const addedCourses = await this.learningPathRepository.insertLearningPathCourses(
        learningPathId,
        uniqueCourseIds,
        maxDisplayOrder,
        currentUser.tenantId,
        trx,
      );

      await Promise.all(
        addedCourses.map((course) =>
          this.publishLearningPathCourseAddedEvent(
            learningPathId,
            course.courseId,
            currentUser.tenantId,
            trx,
          ),
        ),
      );

      return addedCourses;
    });

    await this.learningPathExportService.queueSyncForSourceLearningPath(
      learningPathId,
      "add-learning-path-course",
    );

    return addedCourses;
  }

  async enrollUsersToLearningPath(
    learningPathId: UUIDType,
    body: LearningPathStudentIdsBody,
    currentUser: CurrentUserType,
  ) {
    this.assertManagePermission(currentUser);

    if (body.studentIds.length === 0) {
      throw new BadRequestException(LEARNING_PATH_ERRORS.STUDENT_IDS_EMPTY);
    }

    const uniqueStudentIds = Array.from(new Set(body.studentIds));

    return this.db.transaction(async (trx) => {
      await this.ensureLearningPathExists(learningPathId, trx);

      const newStudentIds = await this.learningPathRepository.getNotEnrolledUserIds(
        learningPathId,
        uniqueStudentIds,
        trx,
      );

      const courseIds = await this.learningPathRepository.getLearningPathCourseIds(
        learningPathId,
        trx,
      );

      await this.learningPathRepository.insertStudentLearningPaths(
        learningPathId,
        newStudentIds,
        LEARNING_PATH_ENROLLMENT_TYPES.DIRECT,
        currentUser.tenantId,
        trx,
      );

      await this.learningPathRepository.insertStudentLearningPathCourses(
        learningPathId,
        newStudentIds,
        courseIds,
        currentUser.tenantId,
        trx,
      );

      await this.publishLearningPathCourseSyncEvent(learningPathId, currentUser.tenantId, trx);

      return {
        learningPathId,
        studentIds: newStudentIds,
      };
    });
  }

  async unenrollUsersFromLearningPath(
    learningPathId: UUIDType,
    body: LearningPathStudentIdsBody,
    currentUser: CurrentUserType,
  ) {
    this.assertManagePermission(currentUser);

    if (body.studentIds.length === 0) {
      throw new BadRequestException(LEARNING_PATH_ERRORS.STUDENT_IDS_EMPTY);
    }

    const uniqueStudentIds = Array.from(new Set(body.studentIds));

    return this.db.transaction(async (trx) => {
      await this.ensureLearningPathExists(learningPathId, trx);

      const studentsToKeepByGroup =
        await this.learningPathRepository.getDirectlyEnrolledStudentIdsWithGroupAccess(
          learningPathId,
          uniqueStudentIds,
          trx,
        );

      const studentsToUnenroll =
        await this.learningPathRepository.getDirectlyEnrolledStudentIdsWithoutGroupAccess(
          learningPathId,
          uniqueStudentIds,
          trx,
        );

      await this.learningPathRepository.updateStudentLearningPathEnrollmentType(
        learningPathId,
        studentsToKeepByGroup,
        LEARNING_PATH_ENROLLMENT_TYPES.GROUP,
        trx,
      );

      await this.learningPathCourseSyncService.removeLearningPathCourseAccess(
        learningPathId,
        studentsToUnenroll,
        trx,
      );

      await this.learningPathRepository.deleteStudentLearningPaths(
        learningPathId,
        studentsToUnenroll,
        trx,
      );

      return {
        learningPathId,
        studentIds: [...studentsToKeepByGroup, ...studentsToUnenroll],
      };
    });
  }

  async enrollGroupsToLearningPath(
    learningPathId: UUIDType,
    body: LearningPathGroupIdsBody,
    currentUser: CurrentUserType,
  ) {
    this.assertManagePermission(currentUser);

    if (body.groupIds.length === 0) {
      throw new BadRequestException(LEARNING_PATH_ERRORS.GROUP_IDS_EMPTY);
    }

    const uniqueGroupIds = Array.from(new Set(body.groupIds));

    return this.db.transaction(async (trx) => {
      await this.ensureLearningPathExists(learningPathId, trx);

      const existingGroupIds = await this.learningPathRepository.getExistingGroupIds(
        uniqueGroupIds,
        trx,
      );

      await this.learningPathRepository.insertGroupLearningPaths(
        learningPathId,
        existingGroupIds,
        currentUser.tenantId,
        trx,
      );

      const studentIds = await this.learningPathRepository.getNotEnrolledStudentIdsByGroupIds(
        learningPathId,
        existingGroupIds,
        trx,
      );

      const courseIds = await this.learningPathRepository.getLearningPathCourseIds(
        learningPathId,
        trx,
      );

      await this.learningPathRepository.insertStudentLearningPaths(
        learningPathId,
        studentIds,
        LEARNING_PATH_ENROLLMENT_TYPES.GROUP,
        currentUser.tenantId,
        trx,
      );

      await this.learningPathRepository.insertStudentLearningPathCourses(
        learningPathId,
        studentIds,
        courseIds,
        currentUser.tenantId,
        trx,
      );

      await this.publishLearningPathCourseSyncEvent(learningPathId, currentUser.tenantId, trx);

      return {
        learningPathId,
        groupIds: existingGroupIds,
        studentIds,
      };
    });
  }

  async unenrollGroupsFromLearningPath(
    learningPathId: UUIDType,
    body: LearningPathGroupIdsBody,
    currentUser: CurrentUserType,
  ) {
    this.assertManagePermission(currentUser);

    if (body.groupIds.length === 0) {
      throw new BadRequestException(LEARNING_PATH_ERRORS.GROUP_IDS_EMPTY);
    }

    const uniqueGroupIds = Array.from(new Set(body.groupIds));

    return this.db.transaction(async (trx) => {
      await this.ensureLearningPathExists(learningPathId, trx);

      const enrolledGroupIds = await this.learningPathRepository.getEnrolledGroupIds(
        learningPathId,
        uniqueGroupIds,
        trx,
      );

      const impactedStudentIds = await this.learningPathRepository.getStudentIdsByGroupIds(
        enrolledGroupIds,
        trx,
      );

      const studentsToUnenroll =
        await this.learningPathRepository.getGroupEnrolledStudentIdsWithoutOtherGroupAccess(
          learningPathId,
          enrolledGroupIds,
          trx,
        );

      await this.learningPathRepository.deleteGroupLearningPaths(
        learningPathId,
        enrolledGroupIds,
        trx,
      );

      await this.learningPathCourseSyncService.removeLearningPathCourseAccess(
        learningPathId,
        studentsToUnenroll,
        trx,
      );

      await this.learningPathRepository.deleteStudentLearningPaths(
        learningPathId,
        studentsToUnenroll,
        trx,
      );

      return {
        learningPathId,
        groupIds: enrolledGroupIds,
        studentIds: impactedStudentIds,
      };
    });
  }

  async removeCourseFromLearningPath(
    learningPathId: UUIDType,
    courseId: UUIDType,
    currentUser: CurrentUserType,
  ) {
    this.assertManagePermission(currentUser);

    const removedCourse = await this.db.transaction(async (trx) => {
      await this.ensureLearningPathExists(learningPathId, trx);

      const removedCourse = await this.learningPathRepository.removeLearningPathCourse(
        learningPathId,
        courseId,
        trx,
      );

      if (!removedCourse) {
        throw new NotFoundException(LEARNING_PATH_ERRORS.COURSE_LINK_NOT_FOUND);
      }

      await this.learningPathRepository.shiftCoursesAfterRemoval(
        learningPathId,
        removedCourse.displayOrder,
        trx,
      );

      await this.publishLearningPathCourseRemovedEvent(
        learningPathId,
        courseId,
        currentUser.tenantId,
        trx,
      );

      return removedCourse;
    });

    await this.learningPathExportService.queueSyncForSourceLearningPath(
      learningPathId,
      "remove-learning-path-course",
    );

    return removedCourse;
  }

  async reorderLearningPathCourses(
    learningPathId: UUIDType,
    body: LearningPathCourseIdsBody,
    currentUser: CurrentUserType,
  ) {
    this.assertManagePermission(currentUser);

    if (body.courseIds.length === 0) {
      throw new BadRequestException(LEARNING_PATH_ERRORS.COURSE_IDS_EMPTY);
    }

    const result = await this.db.transaction(async (trx) => {
      const learningPath = await this.ensureLearningPathExists(learningPathId, trx);

      const currentCourseIds = await this.learningPathRepository.getLearningPathCourseIds(
        learningPathId,
        trx,
      );

      if (currentCourseIds.length !== body.courseIds.length) {
        throw new BadRequestException(LEARNING_PATH_ERRORS.COURSE_IDS_MISMATCH);
      }

      const currentCourseSet = new Set(currentCourseIds);
      const nextCourseSet = new Set(body.courseIds);

      if (currentCourseSet.size !== nextCourseSet.size) {
        throw new BadRequestException(LEARNING_PATH_ERRORS.COURSE_IDS_MISMATCH);
      }

      for (const courseId of currentCourseIds) {
        if (!nextCourseSet.has(courseId)) {
          throw new BadRequestException(LEARNING_PATH_ERRORS.COURSE_IDS_MISMATCH);
        }
      }

      const offset = body.courseIds.length + 1000;

      await this.learningPathRepository.temporarilyOffsetDisplayOrder(learningPathId, offset, trx);

      for (const [index, courseId] of body.courseIds.entries()) {
        await this.learningPathRepository.setDisplayOrder(learningPathId, courseId, index + 1, trx);
      }

      if (learningPath.sequenceEnabled) {
        await this.publishLearningPathCourseSyncEvent(learningPathId, currentUser.tenantId, trx);
      }

      return {
        learningPathId,
        courseIds: body.courseIds,
      };
    });

    await this.learningPathExportService.queueSyncForSourceLearningPath(
      learningPathId,
      "reorder-learning-path-courses",
    );

    return result;
  }

  private resolveLearningPathProgress(progressState: LearningPathProgressState) {
    const completedCourseCount = progressState.studentCourseProgressRows.filter(
      (row) => row.completedAt !== null,
    ).length;

    return match({
      courseCount: progressState.courses.length,
      completedCourseCount,
    })
      .with({ courseCount: 0 }, () => LEARNING_PATH_PROGRESS_STATUSES.NOT_STARTED)
      .with({ completedCourseCount: 0 }, () => LEARNING_PATH_PROGRESS_STATUSES.NOT_STARTED)
      .with({ courseCount: completedCourseCount }, () => LEARNING_PATH_PROGRESS_STATUSES.COMPLETED)
      .otherwise(() => LEARNING_PATH_PROGRESS_STATUSES.IN_PROGRESS);
  }

  private buildLearningPathCourseDetail(
    courses: LearningPathProgressState["courses"],
    studentCourseProgressRows: LearningPathProgressState["studentCourseProgressRows"],
    isPathEnrolled: boolean,
    sequenceEnabled: boolean,
  ): LearningPathCourseDetailSchema[] {
    const progressByCourseId = new Map<string, LearningPathCourseProgressRow>(
      studentCourseProgressRows.map((row) => [row.courseId, row]),
    );

    let lockNextCourse = false;

    return courses.map((course) => {
      const courseProgress = progressByCourseId.get(course.courseId);

      const isCompleted = courseProgress?.completedAt != null;
      const isLocked = isPathEnrolled && sequenceEnabled && lockNextCourse;
      const progress = this.resolveCourseDetailProgress(courseProgress, isCompleted, isLocked);

      lockNextCourse = isPathEnrolled && sequenceEnabled ? lockNextCourse || !isCompleted : false;

      return {
        ...course,
        progress,
        isLocked,
        completedAt: courseProgress?.completedAt ?? null,
      };
    });
  }

  private resolveCourseDetailProgress(
    courseProgress: LearningPathCourseProgressRow | undefined,
    isCompleted: boolean,
    isLocked: boolean,
  ): ProgressStatus {
    return match({
      isLocked,
      isCompleted,
      progress: courseProgress?.progress,
    })
      .with({ isLocked: true }, () => PROGRESS_STATUSES.BLOCKED)
      .with({ isCompleted: true }, () => PROGRESS_STATUSES.COMPLETED)
      .with({ progress: PROGRESS_STATUSES.IN_PROGRESS }, () => PROGRESS_STATUSES.IN_PROGRESS)
      .with({ progress: PROGRESS_STATUSES.BLOCKED }, () => PROGRESS_STATUSES.BLOCKED)
      .otherwise(() => PROGRESS_STATUSES.NOT_STARTED);
  }
}
