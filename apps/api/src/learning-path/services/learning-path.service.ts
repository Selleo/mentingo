import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from "@nestjs/common";
import {
  ALLOWED_CERTIFICATE_SIGNATURE_FILE_TYPES,
  ALLOWED_LESSON_IMAGE_FILE_TYPES,
  LEARNING_PATH_ENROLLMENT_TYPES,
  LEARNING_PATH_PROGRESS_STATUSES,
  LEARNING_PATH_STATUSES,
  PERMISSIONS,
  type PermissionKey,
  type SupportedLanguages,
} from "@repo/shared";
import { match } from "ts-pattern";

import { DatabasePg, type Pagination, type UUIDType } from "src/common";
import { setJsonbField } from "src/common/helpers/sqlHelpers";
import { hasAnyPermission, hasPermission } from "src/common/permissions/permission.utils";
import {
  LearningPathCourseAddedEvent,
  LearningPathCourseRemovedEvent,
  LearningPathCourseSyncEvent,
} from "src/events";
import { MAX_FILE_SIZE } from "src/file/file.constants";
import { FileService } from "src/file/file.service";
import { SEARCH_ENTITY_TYPES } from "src/global-search/global-search.constants";
import { SearchIndexService } from "src/global-search/search-index.service";
import { OutboxPublisher } from "src/outbox/outbox.publisher";
import { learningPaths } from "src/storage/schema";
import { hasDataToUpdate } from "src/utils/hasDataToUpdate";
import { PROGRESS_STATUSES, type ProgressStatus } from "src/utils/types/progress.type";

import { LEARNING_PATH_ERRORS } from "../constants/learning-path.errors";
import { LearningPathRepository } from "../learning-path.repository";
import { DEFAULT_LEARNING_PATH_SETTINGS } from "../types/learning-path-settings.types";

import { LearningPathCourseSyncService } from "./learning-path-course-sync.service";
import { LearningPathExportService } from "./learning-path-export.service";

import type {
  CreateLearningPathBody,
  LearningPathCourseIdsBody,
  LearningPathCourseDetailSchema,
  LearningPathCourseOptionSchema,
  LearningPathDetailSchema,
  LearningPathDisplaySchema,
  LearningPathListItemSchema,
  LearningPathGroupIdsBody,
  LearningPathSchema,
  LearningPathStudentIdsBody,
  UpdateLearningPathBody,
} from "../learning-path.schema";
import type {
  ExistingLearningPath,
  LearningPathCourseProgressRow,
  LearningPathCoursePreviewGroup,
  LearningPathProgressState,
  LearningPathUpdateData,
} from "../learning-path.types";
import type { CurrentUserType } from "src/common/types/current-user.type";
import type { SortEnrolledStudentsOptions } from "src/courses/schemas/courseQuery";

@Injectable()
export class LearningPathService {
  private readonly logger = new Logger(LearningPathService.name);

  constructor(
    @Inject("DB") private readonly db: DatabasePg,
    private readonly learningPathRepository: LearningPathRepository,
    private readonly outboxPublisher: OutboxPublisher,
    private readonly fileService: FileService,
    private readonly learningPathCourseSyncService: LearningPathCourseSyncService,
    private readonly learningPathExportService: LearningPathExportService,
    private readonly searchIndexService: SearchIndexService,
  ) {}

  private assertPermission(currentUser: CurrentUserType, permission: PermissionKey) {
    if (!hasPermission(currentUser.permissions, permission)) {
      throw new ForbiddenException(LEARNING_PATH_ERRORS.MISSING_PERMISSION);
    }
  }

  private assertReadPermission(currentUser: CurrentUserType) {
    this.assertPermission(currentUser, PERMISSIONS.LEARNING_PATH_READ);
  }

  private assertUpdatePermission(currentUser: CurrentUserType, learningPath: ExistingLearningPath) {
    if (hasPermission(currentUser.permissions, PERMISSIONS.LEARNING_PATH_UPDATE)) return;

    if (
      hasPermission(currentUser.permissions, PERMISSIONS.LEARNING_PATH_UPDATE_OWN) &&
      learningPath.authorId === currentUser.userId
    ) {
      return;
    }

    throw new ForbiddenException(LEARNING_PATH_ERRORS.MISSING_PERMISSION);
  }

  private assertCourseUpdatePermission(
    currentUser: CurrentUserType,
    learningPath: ExistingLearningPath,
  ) {
    if (hasPermission(currentUser.permissions, PERMISSIONS.LEARNING_PATH_COURSE_UPDATE)) return;

    if (
      hasPermission(currentUser.permissions, PERMISSIONS.LEARNING_PATH_COURSE_UPDATE_OWN) &&
      learningPath.authorId === currentUser.userId
    ) {
      return;
    }

    throw new ForbiddenException(LEARNING_PATH_ERRORS.MISSING_PERMISSION);
  }

  private canReadAllLearningPaths(currentUser: CurrentUserType) {
    return hasAnyPermission(currentUser.permissions, [
      PERMISSIONS.LEARNING_PATH_UPDATE,
      PERMISSIONS.LEARNING_PATH_DELETE,
      PERMISSIONS.LEARNING_PATH_COURSE_UPDATE,
      PERMISSIONS.LEARNING_PATH_ENROLLMENT,
      PERMISSIONS.LEARNING_PATH_EXPORT,
    ]);
  }

  private canReadOwnLearningPaths(currentUser: CurrentUserType) {
    return hasAnyPermission(currentUser.permissions, [
      PERMISSIONS.LEARNING_PATH_UPDATE_OWN,
      PERMISSIONS.LEARNING_PATH_COURSE_UPDATE_OWN,
    ]);
  }

  private canUpdateLearningPathCourses(
    currentUser: CurrentUserType,
    learningPath: Pick<ExistingLearningPath, "authorId">,
  ) {
    return (
      hasPermission(currentUser.permissions, PERMISSIONS.LEARNING_PATH_COURSE_UPDATE) ||
      (hasPermission(currentUser.permissions, PERMISSIONS.LEARNING_PATH_COURSE_UPDATE_OWN) &&
        learningPath.authorId === currentUser.userId)
    );
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

  private async ensureLocalizedLearningPathExists(
    learningPathId: UUIDType,
    language?: SupportedLanguages,
  ): Promise<LearningPathSchema> {
    const learningPath = await this.learningPathRepository.findLocalizedLearningPathById(
      learningPathId,
      language,
    );

    if (!learningPath) {
      throw new NotFoundException(LEARNING_PATH_ERRORS.NOT_FOUND);
    }

    return learningPath;
  }

  private buildUpdateData(
    existingLearningPath: ExistingLearningPath,
    updateLearningPathData: Partial<
      Omit<UpdateLearningPathBody, "language" | "certificateSignature">
    > & {
      certificateSignature?: string | null;
    },
    language?: SupportedLanguages,
  ): LearningPathUpdateData {
    const directFields: Array<
      keyof Omit<UpdateLearningPathBody, "language" | "title" | "description">
    > = ["thumbnailReference", "status", "includesCertificate", "sequenceEnabled"];

    const updateData: LearningPathUpdateData = {};

    if (language) {
      const titleUpdate = setJsonbField(
        learningPaths.title,
        language,
        updateLearningPathData.title,
      );
      const descriptionUpdate = setJsonbField(
        learningPaths.description,
        language,
        updateLearningPathData.description,
      );

      if (titleUpdate) updateData.title = titleUpdate;
      if (descriptionUpdate) updateData.description = descriptionUpdate;
    }

    directFields.forEach((field) => {
      if (field in updateLearningPathData && updateLearningPathData[field] !== undefined) {
        Object.assign(updateData, { [field]: updateLearningPathData[field] });
      }
    });

    const settingsUpdates = updateLearningPathData.settings ?? {};
    const hasSettingsUpdate =
      updateLearningPathData.certificateSignature !== undefined ||
      settingsUpdates.certificateFontColor !== undefined ||
      settingsUpdates.removeCertificateSignature !== undefined;

    if (hasSettingsUpdate) {
      const currentSettings = existingLearningPath.settings ?? DEFAULT_LEARNING_PATH_SETTINGS;
      updateData.settings = {
        ...DEFAULT_LEARNING_PATH_SETTINGS,
        ...currentSettings,
        ...(settingsUpdates.certificateFontColor !== undefined
          ? { certificateFontColor: settingsUpdates.certificateFontColor }
          : {}),
        ...(updateLearningPathData.certificateSignature !== undefined
          ? { certificateSignature: updateLearningPathData.certificateSignature }
          : {}),
        ...(settingsUpdates.removeCertificateSignature ? { certificateSignature: null } : {}),
      };
    }

    return updateData;
  }

  private validateUploadFile(
    file: Express.Multer.File | null | undefined,
    allowedTypes: readonly string[],
  ) {
    if (!file) return;

    if (file.size > MAX_FILE_SIZE || !allowedTypes.includes(file.mimetype)) {
      throw new BadRequestException(LEARNING_PATH_ERRORS.UPDATE_FAILED);
    }
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

  async createLearningPath(
    body: CreateLearningPathBody,
    currentUser: CurrentUserType,
    thumbnail?: Express.Multer.File | null,
    certificateSignature?: Express.Multer.File | null,
  ) {
    this.assertPermission(currentUser, PERMISSIONS.LEARNING_PATH_CREATE);

    const {
      thumbnail: _thumbnailField,
      certificateSignature: _signatureField,
      ...rawCreateData
    } = body;
    const createData = rawCreateData as typeof rawCreateData & {
      certificateSignature?: string;
    };

    this.validateUploadFile(thumbnail, ALLOWED_LESSON_IMAGE_FILE_TYPES);
    this.validateUploadFile(certificateSignature, ALLOWED_CERTIFICATE_SIGNATURE_FILE_TYPES);

    if (thumbnail) {
      const { fileKey } = await this.fileService.uploadFile(
        thumbnail,
        "learning-path",
        currentUser.tenantId,
      );
      createData.thumbnailReference = fileKey;
    }

    if (certificateSignature) {
      const { fileKey } = await this.fileService.uploadFile(
        certificateSignature,
        "learning-path-certificate",
        currentUser.tenantId,
      );
      createData.certificateSignature = fileKey;
    }

    const createdLearningPath = await this.learningPathRepository.createLearningPath(
      createData,
      currentUser,
    );

    if (!createdLearningPath) {
      throw new UnprocessableEntityException(LEARNING_PATH_ERRORS.CREATE_FAILED);
    }

    await this.searchIndexService.refreshLearningPath(createdLearningPath.id);

    return this.ensureLocalizedLearningPathExists(createdLearningPath.id, body.language);
  }

  async getLearningPaths(
    currentUser: CurrentUserType,
    page?: number,
    perPage?: number,
    language?: SupportedLanguages,
    searchQuery?: string,
  ): Promise<{ data: LearningPathListItemSchema[]; pagination: Pagination }> {
    this.assertReadPermission(currentUser);

    const canReadAll = this.canReadAllLearningPaths(currentUser);
    const canReadOwn = this.canReadOwnLearningPaths(currentUser);
    const studentScopedUserId = canReadAll ? undefined : currentUser.userId;

    const learningPaths = await this.learningPathRepository.getLearningPaths({
      page,
      perPage,
      language,
      searchQuery,
      visibility: {
        canReadAll,
        canReadOwn,
        studentId: currentUser.userId,
      },
    });

    const learningPathIds = learningPaths.data.map((learningPath) => learningPath.id);

    const enrolledLearningPathIds = new Set(
      await this.learningPathRepository.getEnrolledLearningPathIds(
        learningPathIds,
        studentScopedUserId,
      ),
    );
    const editableCourseLearningPathIds = learningPaths.data
      .filter((learningPath) => this.canUpdateLearningPathCourses(currentUser, learningPath))
      .map((learningPath) => learningPath.id);
    const availableCourseOptionsByPathId =
      editableCourseLearningPathIds.length > 0
        ? await this.buildLearningPathAvailableCourseOptions(
            editableCourseLearningPathIds,
            language,
          )
        : new Map();

    const coursePreviews = await this.learningPathRepository.getLearningPathCoursePreviews(
      learningPathIds,
      studentScopedUserId,
      language,
    );

    const coursePreviewsByPathId =
      await this.buildLearningPathCoursePreviewsByPathId(coursePreviews);

    return {
      ...learningPaths,
      data: await Promise.all(
        learningPaths.data.map(async (learningPath) => ({
          ...(await this.buildLearningPathDisplay(
            learningPath,
            enrolledLearningPathIds.has(learningPath.id),
          )),
          courses: coursePreviewsByPathId.get(learningPath.id) ?? [],
          availableCourseOptions: availableCourseOptionsByPathId.get(learningPath.id) ?? [],
        })),
      ),
    };
  }

  async getLearningPathById(
    learningPathId: UUIDType,
    currentUser: CurrentUserType,
    language?: SupportedLanguages,
  ): Promise<LearningPathDetailSchema> {
    this.assertReadPermission(currentUser);

    const learningPath = await this.ensureLearningPathExists(learningPathId);
    const progressState = await this.learningPathRepository.getLearningPathProgressState(
      learningPathId,
      currentUser.userId,
    );

    if (
      !this.canReadAllLearningPaths(currentUser) &&
      !(
        this.canReadOwnLearningPaths(currentUser) && learningPath.authorId === currentUser.userId
      ) &&
      learningPath.status !== LEARNING_PATH_STATUSES.PUBLISHED &&
      !progressState.isEnrolled
    ) {
      throw new NotFoundException(LEARNING_PATH_ERRORS.NOT_FOUND);
    }

    const progressSummary = this.buildLearningPathProgressSummary(progressState);
    const canUpdateCourses = this.canUpdateLearningPathCourses(currentUser, learningPath);
    const availableCourseOptionsByPathId = canUpdateCourses
      ? await this.buildLearningPathAvailableCourseOptions([learningPathId], language)
      : new Map();

    const localizedLearningPath = await this.learningPathRepository.findLocalizedLearningPathById(
      learningPathId,
      language,
    );

    if (!localizedLearningPath) throw new NotFoundException(LEARNING_PATH_ERRORS.NOT_FOUND);

    return {
      ...(await this.buildLearningPathDisplay(localizedLearningPath, progressState.isEnrolled)),
      ...progressSummary,
      availableCourseOptions: availableCourseOptionsByPathId.get(learningPathId) ?? [],
      certificateReady:
        learningPath.includesCertificate &&
        progressSummary.progress === LEARNING_PATH_PROGRESS_STATUSES.COMPLETED,
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
    thumbnail?: Express.Multer.File | null,
    certificateSignature?: Express.Multer.File | null,
  ) {
    const existingLearningPath = await this.ensureLearningPathExists(learningPathId);
    this.assertUpdatePermission(currentUser, existingLearningPath);

    const {
      language,
      thumbnail: _thumbnailField,
      certificateSignature: _signatureField,
      ...rawUpdateLearningPathData
    } = body;
    const updateLearningPathData = rawUpdateLearningPathData as typeof rawUpdateLearningPathData & {
      certificateSignature?: string | null;
    };

    this.validateUploadFile(thumbnail, ALLOWED_LESSON_IMAGE_FILE_TYPES);
    this.validateUploadFile(certificateSignature, ALLOWED_CERTIFICATE_SIGNATURE_FILE_TYPES);

    if (thumbnail) {
      const { fileKey } = await this.fileService.uploadFile(
        thumbnail,
        "learning-path",
        currentUser.tenantId,
      );
      updateLearningPathData.thumbnailReference = fileKey;
    }

    if (certificateSignature) {
      const { fileKey } = await this.fileService.uploadFile(
        certificateSignature,
        "learning-path-certificate",
        currentUser.tenantId,
      );
      updateLearningPathData.certificateSignature = fileKey;
    }

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

    await this.searchIndexService.refreshLearningPath(learningPathId);

    return this.ensureLocalizedLearningPathExists(
      updatedLearningPath.id,
      language ?? updatedLearningPath.baseLanguage,
    );
  }

  async createLanguage(
    learningPathId: UUIDType,
    language: SupportedLanguages,
    currentUser: CurrentUserType,
  ) {
    const learningPath = await this.ensureLearningPathExists(learningPathId);
    this.assertUpdatePermission(currentUser, learningPath);

    if (learningPath.availableLocales.includes(language)) {
      throw new BadRequestException(LEARNING_PATH_ERRORS.LANGUAGE_ALREADY_EXISTS);
    }

    const updatedLearningPath = await this.learningPathRepository.updateLearningPath(
      learningPathId,
      {
        availableLocales: [...learningPath.availableLocales, language],
      },
    );

    if (!updatedLearningPath) {
      throw new UnprocessableEntityException(LEARNING_PATH_ERRORS.UPDATE_FAILED);
    }

    await this.searchIndexService.refreshLearningPath(learningPathId);

    return this.ensureLocalizedLearningPathExists(updatedLearningPath.id, language);
  }

  async deleteLearningPath(learningPathId: UUIDType, currentUser: CurrentUserType) {
    this.assertPermission(currentUser, PERMISSIONS.LEARNING_PATH_DELETE);

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

    await this.searchIndexService.deleteEntityDocuments({
      entityType: SEARCH_ENTITY_TYPES.LEARNING_PATH,
      entityId: learningPathId,
    });
  }

  async addCoursesToLearningPath(
    learningPathId: UUIDType,
    body: LearningPathCourseIdsBody,
    currentUser: CurrentUserType,
  ) {
    if (body.courseIds.length === 0) {
      throw new BadRequestException(LEARNING_PATH_ERRORS.COURSE_IDS_EMPTY);
    }

    const addedCourses = await this.db.transaction(async (trx) => {
      const learningPath = await this.ensureLearningPathExists(learningPathId, trx);
      this.assertCourseUpdatePermission(currentUser, learningPath);

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
    this.assertPermission(currentUser, PERMISSIONS.LEARNING_PATH_ENROLLMENT);

    if (body.studentIds.length === 0) {
      throw new BadRequestException(LEARNING_PATH_ERRORS.STUDENT_IDS_EMPTY);
    }

    const uniqueStudentIds = Array.from(new Set(body.studentIds));

    return this.enrollStudentIdsToLearningPath(
      learningPathId,
      uniqueStudentIds,
      currentUser.tenantId,
    );
  }

  async enrollCurrentUserToLearningPath(learningPathId: UUIDType, currentUser: CurrentUserType) {
    this.assertReadPermission(currentUser);

    const learningPath = await this.ensureLearningPathExists(learningPathId);

    if (learningPath.status !== LEARNING_PATH_STATUSES.PUBLISHED) {
      throw new ForbiddenException(LEARNING_PATH_ERRORS.MISSING_PERMISSION);
    }

    return this.enrollStudentIdsToLearningPath(
      learningPathId,
      [currentUser.userId],
      currentUser.tenantId,
    );
  }

  private async enrollStudentIdsToLearningPath(
    learningPathId: UUIDType,
    studentIds: UUIDType[],
    tenantId: UUIDType,
  ) {
    if (studentIds.length === 0) {
      throw new BadRequestException(LEARNING_PATH_ERRORS.STUDENT_IDS_EMPTY);
    }

    return this.db.transaction(async (trx) => {
      await this.ensureLearningPathExists(learningPathId, trx);

      const newStudentIds = await this.learningPathRepository.getNotEnrolledUserIds(
        learningPathId,
        studentIds,
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
        tenantId,
        trx,
      );

      await this.learningPathRepository.insertStudentLearningPathCourses(
        learningPathId,
        newStudentIds,
        courseIds,
        tenantId,
        trx,
      );

      await this.publishLearningPathCourseSyncEvent(learningPathId, tenantId, trx);

      return {
        learningPathId,
        studentIds: newStudentIds,
      };
    });
  }

  async getStudentsWithEnrollmentDate(
    learningPathId: UUIDType,
    query: {
      keyword?: string;
      sort?: SortEnrolledStudentsOptions;
      groups?: string[];
      page?: number;
      perPage?: number;
    },
    currentUser: CurrentUserType,
  ) {
    this.assertPermission(currentUser, PERMISSIONS.LEARNING_PATH_ENROLLMENT);
    await this.ensureLearningPathExists(learningPathId);

    return this.learningPathRepository.getStudentsWithEnrollmentDate({
      learningPathId,
      ...query,
    });
  }

  async unenrollUsersFromLearningPath(
    learningPathId: UUIDType,
    body: LearningPathStudentIdsBody,
    currentUser: CurrentUserType,
  ) {
    this.assertPermission(currentUser, PERMISSIONS.LEARNING_PATH_ENROLLMENT);

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
    this.assertPermission(currentUser, PERMISSIONS.LEARNING_PATH_ENROLLMENT);

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
    this.assertPermission(currentUser, PERMISSIONS.LEARNING_PATH_ENROLLMENT);

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
    const removedCourse = await this.db.transaction(async (trx) => {
      const learningPath = await this.ensureLearningPathExists(learningPathId, trx);
      this.assertCourseUpdatePermission(currentUser, learningPath);

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
    if (body.courseIds.length === 0) {
      throw new BadRequestException(LEARNING_PATH_ERRORS.COURSE_IDS_EMPTY);
    }

    const result = await this.db.transaction(async (trx) => {
      const learningPath = await this.ensureLearningPathExists(learningPathId, trx);
      this.assertCourseUpdatePermission(currentUser, learningPath);

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

  private async buildLearningPathDisplay(
    learningPath: LearningPathSchema,
    isEnrolled = false,
  ): Promise<LearningPathDisplaySchema> {
    return {
      ...learningPath,
      thumbnailReference: await this.resolveFileUrl(learningPath.thumbnailReference),
      settings: {
        certificateSignatureUrl: await this.resolveFileUrl(
          learningPath.settings?.certificateSignature,
        ),
        certificateFontColor: learningPath.settings?.certificateFontColor ?? null,
      },
      isEnrolled,
      title: learningPath.title,
      description: learningPath.description,
    };
  }

  private async buildLearningPathAvailableCourseOptions(
    learningPathIds: UUIDType[],
    language?: SupportedLanguages,
  ): Promise<Map<string, LearningPathCourseOptionSchema[]>> {
    if (learningPathIds.length === 0) return new Map();

    const [linkedCourseRows, courseOptions] = await Promise.all([
      this.learningPathRepository.getLearningPathCourseIdsForPaths(learningPathIds),
      this.learningPathRepository.getLearningPathCourseOptions(language),
    ]);

    const linkedCourseIdsByPath = new Map<string, Set<string>>();
    for (const row of linkedCourseRows) {
      const currentSet = linkedCourseIdsByPath.get(row.learningPathId);
      if (currentSet) {
        currentSet.add(row.courseId);
      } else {
        linkedCourseIdsByPath.set(row.learningPathId, new Set([row.courseId]));
      }
    }

    const resolvedCourseOptions = await Promise.all(
      courseOptions.map(async (courseOption) => ({
        ...courseOption,
        imageUrl: await this.resolveFileUrl(courseOption.imageUrl),
      })),
    );

    const result = new Map<string, LearningPathCourseOptionSchema[]>();

    for (const learningPathId of learningPathIds) {
      const linkedCourseIds = linkedCourseIdsByPath.get(learningPathId) ?? new Set();
      result.set(
        learningPathId,
        resolvedCourseOptions.filter((option) => !linkedCourseIds.has(option.value)),
      );
    }

    return result;
  }

  private async buildLearningPathCoursePreviewsByPathId(groups: LearningPathCoursePreviewGroup[]) {
    const result = new Map<string, LearningPathCoursePreviewGroup["courses"]>();

    for (const group of groups) {
      result.set(
        group.learningPathId,
        await Promise.all(
          group.courses.map(async (course) => ({
            ...course,
            thumbnailUrl: await this.resolveFileUrl(course.thumbnailUrl),
          })),
        ),
      );
    }

    return result;
  }

  private async resolveFileUrl(reference: string | null) {
    if (!reference) return null;

    try {
      return await this.fileService.getFileUrl(reference);
    } catch (error) {
      this.logger.error(`Failed to get signed URL for ${reference}:`, error);
      return reference;
    }
  }

  private buildLearningPathProgressSummary(progressState: LearningPathProgressState) {
    const completedCourseCount = progressState.studentCourseProgressRows.filter(
      (row) => row.completedAt !== null,
    ).length;
    const totalCourseCount = progressState.courses.length;

    const progress = match({
      courseCount: totalCourseCount,
      completedCourseCount,
    })
      .with({ courseCount: 0 }, () => LEARNING_PATH_PROGRESS_STATUSES.NOT_STARTED)
      .with({ completedCourseCount: 0 }, () => LEARNING_PATH_PROGRESS_STATUSES.NOT_STARTED)
      .with({ courseCount: completedCourseCount }, () => LEARNING_PATH_PROGRESS_STATUSES.COMPLETED)
      .otherwise(() => LEARNING_PATH_PROGRESS_STATUSES.IN_PROGRESS);

    return {
      progress,
      progressValue: totalCourseCount
        ? Math.round((completedCourseCount / totalCourseCount) * 100)
        : 0,
      completedCourseCount,
      totalCourseCount,
    };
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
