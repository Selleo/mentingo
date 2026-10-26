import { createHash } from "crypto";

import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import {
  AI_MENTOR_TYPE,
  COURSE_ORIGIN_TYPES,
  ENTITY_TYPES,
  LESSON_TYPES,
  type LocalizedText,
  MASTER_COURSE_ENTITY_TYPES,
  RESOURCE_VISIBILITY,
  SCORM_PACKAGE_ENTITY_TYPE,
  type MasterCourseEntityType,
} from "@repo/shared";
import { groupBy } from "lodash";
import { v5 as uuidv5 } from "uuid";

import { buildJsonbFieldWithMultipleEntries } from "src/common/helpers/sqlHelpers";
import {
  COURSE_TRANSFER_ENTITY_MAP_SCOPES,
  COURSE_TRANSFER_RESOURCE_GROUPS,
} from "src/course-transfer/course-transfer.constants";
import { CourseTransferVideoMetadataRequestedEvent } from "src/course-transfer/events/course-transfer-video-metadata-requested.event";
import { CourseTransferGraphRepository } from "src/course-transfer/repositories/course-transfer-graph.repository";
import {
  getCopiedInternalReference,
  getExternalResourceReferences,
  normalizeCourseSettings,
  rewriteScormJsonReferences,
  rewriteScormStorageReference,
  shouldSyncLesson,
} from "src/course-transfer/utils/course-transfer-graph.utils";
import { CourseDurationService } from "src/courses/duration/course-duration.service";
import { mergeResourceMetadataPreservingDuration } from "src/courses/master-course/master-course-resource.utils";
import { RESOURCE_RELATIONSHIP_TYPES } from "src/file/file.constants";
import { getBunnyVideoId } from "src/file/video-metadata.utils";
import { LEARNING_PATH_ERRORS } from "src/learning-path/constants/learning-path.errors";
import { LearningPathExportAppliedEvent } from "src/learning-path/events/learning-path-export-applied.event";
import { OutboxPublisher } from "src/outbox/outbox.publisher";
import {
  BLANK_ANSWER_MARKER_REGEX,
  rewriteBlankAnswerIds,
} from "src/questions/fill-in-the-blanks.utils";
import { QUESTION_TYPE } from "src/questions/schema/question.types";
import {
  buildTenantResourceUrl,
  mapLocalizedTextEntries,
  replaceResourceReferencesInRichText,
} from "src/resource-library/resource-library.utils";
import { TenantDbRunnerService } from "src/storage/db/tenant-db-runner.service";
import {
  assessmentQuestionChoiceOptions,
  assessmentQuestions,
  chapters,
  lessons,
} from "src/storage/schema";
import { normalizeJsonb, toJsonbBuildObject, toNullableJsonbBuildObject } from "src/utils/jsonb";

import type { DatabasePg, UUIDType } from "src/common";
import type {
  CourseTransferArchiveSyncPolicy,
  CourseTransferCopyCourseResult,
  CourseTransferDuplicatePolicy,
  CourseTransferEntityMapScope,
  CourseTransferRelationship,
  CourseTransferSyncPolicy,
} from "src/course-transfer/course-transfer.types";
import type {
  QuestionJsonbInsert,
  ResourceJsonbInsert,
  CourseSelect,
  CourseTransferMaterializeLearningPathInput,
  CourseTransferMirrorCourseOptions,
  CourseTransferMirroredCourse,
  CourseTransferPreparedCourse,
  CreateTargetCourseFromSourceParams,
  DuplicateResourcesParams,
  DuplicateChaptersParams,
  DuplicateLessonsParams,
  DuplicateOptionsParams,
  DuplicateQuestionsParams,
  AssessmentUpsertValues,
  GetTargetResourceEntityIdParams,
  GetTargetScormPackageEntityIdParams,
  CourseTransferExternalResourceReference,
  CourseTransferResourceCollection,
  SourceSnapshot,
  SyncAiMentorsParams,
  SyncAssessmentQuestionDetailsParams,
  SyncChaptersParams,
  SyncFillInTheBlanksQuestionReferencesParams,
  SyncLessonResourceReferencesParams,
  SyncLessonsParams,
  SyncOptionsParams,
  SyncQuestionsParams,
  SyncResourcesParams,
  SyncScormPackagesParams,
  UpdateTargetCourseFromSourceParams,
} from "src/course-transfer/types/course-transfer-graph.types";
import type { CoursesSettings } from "src/courses/types/settings";
import type { learningPaths } from "src/storage/schema";

@Injectable()
export class CourseTransferMaterializerService {
  constructor(
    private readonly courseTransferGraphRepository: CourseTransferGraphRepository,
    private readonly tenantDbRunnerService: TenantDbRunnerService,
    private readonly courseDurationService: CourseDurationService,
    private readonly outboxPublisher: OutboxPublisher,
  ) {}

  /**
   * Mirrors a prepared course into its tracked destination course.
   */
  async syncCourse(
    prepared: CourseTransferPreparedCourse,
    policy: CourseTransferSyncPolicy,
    transaction: DatabasePg,
  ): Promise<UUIDType> {
    const targetAuthor = await this.courseTransferGraphRepository.findTargetAuthor();

    if (!targetAuthor) throw new BadRequestException("masterCourse.error.targetAuthorMissing");

    const { courseId } = await this.mirrorCourse(
      prepared,
      {
        entityMapScope: {
          kind: COURSE_TRANSFER_ENTITY_MAP_SCOPES.EXPORT,
          exportId: policy.exportId,
        },
        targetAuthorId: targetAuthor.id,
        linksToSource: true,
      },
      transaction,
    );

    return courseId;
  }

  /**
   * Mirrors a course read from an archive into an existing course. Entities earlier imports of
   * the same archive created are updated in place, so the IDs learner progress points at survive.
   */
  async syncArchiveCourse(
    prepared: CourseTransferPreparedCourse,
    policy: CourseTransferArchiveSyncPolicy,
    transaction: DatabasePg,
  ): Promise<CourseTransferCopyCourseResult> {
    const targetCourse = await this.findDuplicateDestination(prepared.destination.courseId);
    const { chapterMap, lessonMap } = await this.mirrorCourse(
      prepared,
      {
        entityMapScope: {
          kind: COURSE_TRANSFER_ENTITY_MAP_SCOPES.ARCHIVE_COURSE,
          courseId: targetCourse.id,
        },
        targetAuthorId: policy.actorId,
        linksToSource: false,
        uploadedResourceIdsByFileKey: policy.uploadedResourceIdsByFileKey,
      },
      transaction,
    );

    return { chapterMap, lessonMap };
  }

  private async mirrorCourse(
    prepared: CourseTransferPreparedCourse,
    options: CourseTransferMirrorCourseOptions,
    transaction: DatabasePg,
  ): Promise<CourseTransferMirroredCourse> {
    const { snapshot: sourceSnapshot, resourceCollection, scormPackages } = prepared;
    const { entityMapScope, targetAuthorId } = options;
    const targetCourseId = prepared.destination.courseId;
    const targetTenantHost = prepared.destination.host;
    const sourceTenantId = prepared.source.tenantId;
    const targetTenantId = prepared.destination.tenantId;
    const sourceLanguage = sourceSnapshot.course.baseLanguage;
    const courseSettings = normalizeCourseSettings(sourceSnapshot.course.settings);

    const categoryId = await this.syncCategoryFromSource(sourceSnapshot);

    const existingTargetCourse =
      await this.courseTransferGraphRepository.findCourseByIdInTenant(targetCourseId);

    let syncedTargetCourseId = existingTargetCourse?.id;

    if (!syncedTargetCourseId) {
      syncedTargetCourseId = await this.createTargetCourseFromSource(
        {
          targetCourseId,
          entityMapScope,
          sourceTenantId,
          sourceSnapshot,
          sourceLanguage,
          courseSettings,
          categoryId,
          targetAuthorId,
          resourceCollection,
        },
        transaction,
      );
    } else {
      await this.updateTargetCourseFromSource({
        targetCourseId: syncedTargetCourseId,
        sourceSnapshot,
        sourceLanguage,
        courseSettings,
        categoryId,
        sourceCourseId: options.linksToSource ? sourceSnapshot.course.id : null,
        sourceTenantId: options.linksToSource ? sourceTenantId : null,
        resourceCollection,
        targetAuthorId,
      });
    }

    if (!syncedTargetCourseId) {
      throw new BadRequestException("masterCourse.error.targetCourseMissing");
    }

    const resolvedTargetCourseId = syncedTargetCourseId;

    const chapterMap = await this.syncChapters(
      {
        entityMapScope,
        sourceLanguage,
        sourceSnapshot,
        targetCourseId: resolvedTargetCourseId,
        targetAuthorId,
      },
      transaction,
    );

    const lessonMap = await this.syncLessons(
      {
        entityMapScope,
        sourceLanguage,
        sourceSnapshot,
        chapterMap,
        resourceCollection,
      },
      transaction,
    );

    const questionMap = await this.syncQuestions(
      {
        entityMapScope,
        sourceLanguage,
        sourceSnapshot,
        lessonMap,
        targetAuthorId,
        resourceCollection,
      },
      transaction,
    );

    const optionMap = await this.syncOptions(
      {
        entityMapScope,
        sourceLanguage,
        sourceSnapshot,
        questionMap,
      },
      transaction,
    );
    const blankMap = await this.syncAssessmentQuestionDetails({
      sourceSnapshot,
      questionMap,
      targetCourseId: resolvedTargetCourseId,
    });

    const aiMentorMap = await this.syncAiMentors({
      sourceSnapshot,
      lessonMap,
      resourceCollection,
    });
    await this.syncAiJudgeConfigurations(sourceSnapshot, aiMentorMap);
    await this.syncAiMentorConfigurations(sourceSnapshot, aiMentorMap);
    await this.syncAiMentorContexts(sourceSnapshot, aiMentorMap, targetTenantId);
    await this.syncScormPackages({
      scormPackages,
      sourceSnapshot,
      lessonMap,
      targetCourseId: resolvedTargetCourseId,
    });

    await this.syncResources(
      {
        entityMapScope,
        lessonMap,
        questionMap,
        targetCourseId: resolvedTargetCourseId,
        targetTenantId: targetTenantId,
        targetAuthorId,
        resourceCollection,
        uploadedResourceIdsByFileKey: options.uploadedResourceIdsByFileKey,
      },
      transaction,
    );

    await this.syncLessonResourceReferences({
      sourceSnapshot,
      lessonMap,
      resourceCollection,
      targetTenantHost,
    });

    await this.syncFillInTheBlanksQuestionReferences({
      sourceSnapshot,
      questionMap,
      optionMap,
      blankMap,
    });

    await this.cleanupMissingMirroredEntities(entityMapScope, sourceSnapshot, transaction);

    await this.courseTransferGraphRepository.updateTargetCourseChapterCount(
      resolvedTargetCourseId,
      sourceSnapshot.chapters.length,
    );

    await this.courseDurationService.refreshCourseDurationEstimates(
      resolvedTargetCourseId,
      transaction,
    );
    return { courseId: resolvedTargetCourseId, chapterMap, lessonMap };
  }

  async findDuplicateDestination(courseId: UUIDType) {
    const targetCourse = await this.courseTransferGraphRepository.findCourseByIdInTenant(courseId);
    if (!targetCourse) throw new NotFoundException("courseDuplication.error.targetCourseNotFound");

    return targetCourse;
  }

  /** Copies a prepared course once into an existing draft course in the current tenant. */
  async duplicateCourse(
    prepared: CourseTransferPreparedCourse,
    policy: CourseTransferDuplicatePolicy,
    targetCourse: CourseSelect,
  ): Promise<CourseTransferCopyCourseResult> {
    const { snapshot: sourceSnapshot, resourceCollection, scormPackages } = prepared;
    const targetCourseId = prepared.destination.courseId;
    const tenantId = prepared.destination.tenantId;
    const tenantHost = prepared.destination.host;

    const sourceCourseSettings = normalizeCourseSettings(sourceSnapshot.course.settings);

    const copiedCourseSettings = this.applyCopiedCourseSettingsReferences(
      sourceCourseSettings,
      sourceSnapshot.course.id,
      resourceCollection,
    );
    const duplicatedCourseValues = this.omitCopiedRowFields(sourceSnapshot.course, [
      "id",
      "shortId",
      "createdAt",
      "updatedAt",
      "tenantId",
      "originalId",
    ] as const);

    await this.courseTransferGraphRepository.updateTargetCourse(targetCourseId, {
      ...duplicatedCourseValues,
      authorMetadata: toNullableJsonbBuildObject(duplicatedCourseValues.authorMetadata),
      title: toJsonbBuildObject(targetCourse.title),
      description: toJsonbBuildObject(sourceSnapshot.course.description),
      thumbnailS3Key: getCopiedInternalReference(
        resourceCollection,
        COURSE_TRANSFER_RESOURCE_GROUPS.COURSES,
        ENTITY_TYPES.COURSE,
        sourceSnapshot.course.id,
        "thumbnailS3Key",
        sourceSnapshot.course.thumbnailS3Key,
      ),
      status: "draft",
      hasCertificate: sourceSnapshot.course.hasCertificate,
      priceInCents: 0,
      currency: policy.targetCurrency ?? sourceSnapshot.course.currency,
      chapterCount: sourceSnapshot.course.chapterCount,
      courseType: sourceSnapshot.course.courseType,
      authorId: policy.actorId,
      categoryId: policy.targetCategoryId ?? sourceSnapshot.course.categoryId,
      stripeProductId: null,
      stripePriceId: null,
      settings: toJsonbBuildObject(copiedCourseSettings),
      baseLanguage: sourceSnapshot.course.baseLanguage,
      availableLocales: sourceSnapshot.course.availableLocales,
      originType: COURSE_ORIGIN_TYPES.REGULAR,
      sourceCourseId: null,
      sourceTenantId: null,
    });

    const chapterMap = await this.duplicateChapters({
      sourceSnapshot,
      targetCourseId,
      targetAuthorId: policy.actorId,
    });

    const lessonMap = await this.duplicateLessons({
      sourceSnapshot,
      chapterMap,
      resourceCollection,
    });

    const questionMap = await this.duplicateQuestions({
      sourceSnapshot,
      lessonMap,
      targetAuthorId: policy.actorId,
      resourceCollection,
    });

    const optionMap = await this.duplicateOptions({ sourceSnapshot, questionMap });
    const blankMap = await this.syncAssessmentQuestionDetails({
      sourceSnapshot,
      questionMap,
      targetCourseId,
    });
    const aiMentorMap = await this.syncAiMentors({
      sourceSnapshot,
      lessonMap,
      resourceCollection,
    });

    await this.syncAiJudgeConfigurations(sourceSnapshot, aiMentorMap);
    await this.syncAiMentorConfigurations(sourceSnapshot, aiMentorMap);
    await this.syncAiMentorContexts(sourceSnapshot, aiMentorMap, tenantId);
    await this.syncScormPackages({
      scormPackages,
      sourceSnapshot,
      lessonMap,
      targetCourseId,
    });

    await this.duplicateResources({
      lessonMap,
      questionMap,
      targetCourseId,
      targetTenantId: tenantId,
      targetAuthorId: policy.actorId,
      resourceCollection,
      uploadedResourceIdsByFileKey: policy.uploadedResourceIdsByFileKey,
    });

    await this.syncLessonResourceReferences({
      sourceSnapshot,
      lessonMap,
      resourceCollection,
      targetTenantHost: tenantHost,
    });

    await this.syncFillInTheBlanksQuestionReferences({
      sourceSnapshot,
      questionMap,
      optionMap,
      blankMap,
    });

    await this.courseTransferGraphRepository.updateTargetCourseChapterCount(
      targetCourseId,
      sourceSnapshot.chapters.length,
    );

    await this.courseDurationService.refreshCourseDurationEstimates(targetCourseId);
    return { chapterMap, lessonMap };
  }

  /** Saves a learning path whose courses were already transferred into the destination tenant. */
  async syncLearningPath(
    input: CourseTransferMaterializeLearningPathInput,
    transaction: DatabasePg,
  ): Promise<UUIDType> {
    const { learningPath } = input.snapshot;
    const existingTarget = await this.findTargetLearningPath(input, transaction);
    const targetAuthor =
      await this.courseTransferGraphRepository.findLearningPathTargetAuthor(transaction);
    if (!targetAuthor) {
      throw new BadRequestException(LEARNING_PATH_ERRORS.EXPORT_TARGET_AUTHOR_MISSING);
    }

    const targetValues = {
      title: buildJsonbFieldWithMultipleEntries(
        learningPath.title,
      ) as typeof learningPaths.$inferInsert.title,
      description: buildJsonbFieldWithMultipleEntries(
        learningPath.description,
      ) as typeof learningPaths.$inferInsert.description,
      thumbnailReference: learningPath.thumbnailReference,
      status: existingTarget?.status ?? learningPath.status,
      includesCertificate: learningPath.includesCertificate,
      settings: learningPath.settings,
      sequenceEnabled: learningPath.sequenceEnabled,
      authorId: existingTarget?.authorId ?? targetAuthor.id,
      originType: COURSE_ORIGIN_TYPES.EXPORTED,
      sourceLearningPathId: learningPath.id,
      sourceTenantId: input.sourceTenantId,
      baseLanguage: learningPath.baseLanguage,
      availableLocales: learningPath.availableLocales,
      tenantId: input.targetTenantId,
    } as const;

    const targetLearningPathId =
      existingTarget?.id ?? (uuidv5("learning-path-target", input.exportId) as UUIDType);
    if (existingTarget) {
      await this.courseTransferGraphRepository.updateTargetLearningPath(
        targetLearningPathId,
        targetValues,
        transaction,
      );
    } else {
      await this.courseTransferGraphRepository.createTargetLearningPath(
        { ...targetValues, id: targetLearningPathId },
        transaction,
      );
    }

    await this.courseTransferGraphRepository.deleteLearningPathCourses(
      targetLearningPathId,
      transaction,
    );
    await this.courseTransferGraphRepository.insertLearningPathCourses(
      input.courses.map(({ targetCourseId }, index) => ({
        learningPathId: targetLearningPathId,
        courseId: targetCourseId,
        displayOrder: index + 1,
        tenantId: input.targetTenantId,
      })),
      transaction,
    );
    for (const { sourceCourseId, targetCourseId } of input.courses) {
      await this.courseTransferGraphRepository.upsertLearningPathEntityMap(
        input.exportId,
        "course",
        sourceCourseId,
        targetCourseId,
        transaction,
      );
    }

    await this.outboxPublisher.publishDurable(
      new LearningPathExportAppliedEvent({
        tenantId: input.targetTenantId,
        learningPathId: targetLearningPathId,
      }),
      transaction,
    );

    return targetLearningPathId;
  }

  async resolveSyncTargetCourseId(
    relationship: CourseTransferRelationship,
    sourceCourseId: UUIDType,
  ): Promise<UUIDType> {
    if (relationship.targetId) return relationship.targetId;

    const mappedTargetCourseId = await this.courseTransferGraphRepository.getMappedTargetEntityId(
      { kind: COURSE_TRANSFER_ENTITY_MAP_SCOPES.EXPORT, exportId: relationship.id },
      MASTER_COURSE_ENTITY_TYPES.COURSE,
      sourceCourseId,
    );

    if (mappedTargetCourseId) return mappedTargetCourseId;

    return uuidv5(relationship.id, relationship.targetTenantId) as UUIDType;
  }

  private async findTargetLearningPath(
    input: CourseTransferMaterializeLearningPathInput,
    transaction: DatabasePg,
  ) {
    const linkedTargetId =
      await this.courseTransferGraphRepository.findLearningPathTargetIdByExportId(
        input.exportId,
        transaction,
      );
    const linkedTarget = linkedTargetId
      ? await this.courseTransferGraphRepository.findLearningPathById(linkedTargetId, transaction)
      : undefined;
    if (linkedTarget) return linkedTarget;

    // Recover target paths created by older workers before the export link was saved.
    return this.courseTransferGraphRepository.findOldestExportedLearningPath(
      input.sourceTenantId,
      input.snapshot.learningPath.id,
      input.targetTenantId,
      transaction,
    );
  }

  private async createTargetQuestion(
    values: QuestionJsonbInsert,
    assessmentValues: AssessmentUpsertValues,
  ): Promise<UUIDType> {
    await this.courseTransferGraphRepository.insertTargetAssessmentIfMissing(assessmentValues);
    const assessmentId = await this.courseTransferGraphRepository.findAssessmentIdByLessonId(
      values.lessonId,
    );
    if (!assessmentId) throw new Error("Target assessment was not created");

    return this.courseTransferGraphRepository.createTargetQuestion(assessmentId, values);
  }

  /** Moves existing options to unused negative orders so reordered options cannot collide. */
  private async releaseTargetOptionDisplayOrders(questionIds: UUIDType[]) {
    const options = await this.courseTransferGraphRepository.findOptionDisplayOrders(questionIds);
    let temporaryOrder = Math.min(0, ...options.map(({ displayOrder }) => displayOrder));

    for (const option of options) {
      temporaryOrder -= 1;
      await this.courseTransferGraphRepository.updateOptionDisplayOrder(option.id, temporaryOrder);
    }
  }

  private async createTargetCourseFromSource(
    params: CreateTargetCourseFromSourceParams,
    transaction: DatabasePg,
  ): Promise<UUIDType> {
    const courseSettings = this.applyCopiedCourseSettingsReferences(
      params.courseSettings,
      params.sourceSnapshot.course.id,
      params.resourceCollection,
    );

    const targetCourseId = await this.courseTransferGraphRepository.createTargetCourse({
      id: params.targetCourseId,
      title: toJsonbBuildObject(params.sourceSnapshot.course.title),
      description: toJsonbBuildObject(params.sourceSnapshot.course.description),
      thumbnailS3Key: getCopiedInternalReference(
        params.resourceCollection,
        COURSE_TRANSFER_RESOURCE_GROUPS.COURSES,
        ENTITY_TYPES.COURSE,
        params.sourceSnapshot.course.id,
        "thumbnailS3Key",
        params.sourceSnapshot.course.thumbnailS3Key,
      ),
      thumbnailPositionY: params.sourceSnapshot.course.thumbnailPositionY,
      learningOutcomes: params.sourceSnapshot.course.learningOutcomes,
      showAuthorSection: params.sourceSnapshot.course.showAuthorSection,
      status: "draft",
      hasCertificate: params.sourceSnapshot.course.hasCertificate,
      priceInCents: 0,
      currency: params.sourceSnapshot.course.currency,
      chapterCount: params.sourceSnapshot.course.chapterCount,
      courseType: params.sourceSnapshot.course.courseType,
      authorId: params.targetAuthorId,
      authorMetadata: toNullableJsonbBuildObject(params.sourceSnapshot.course.authorMetadata),
      categoryId: params.categoryId,
      stripeProductId: null,
      stripePriceId: null,
      settings: toJsonbBuildObject(courseSettings),
      baseLanguage: params.sourceSnapshot.course.baseLanguage,
      availableLocales: params.sourceSnapshot.course.availableLocales,
      originType: COURSE_ORIGIN_TYPES.EXPORTED,
      sourceCourseId: params.sourceSnapshot.course.id,
      sourceTenantId: params.sourceTenantId,
    });

    await this.courseTransferGraphRepository.ensureCourseSummaryStats(
      targetCourseId,
      params.targetAuthorId,
    );

    await this.courseTransferGraphRepository.upsertMap(
      params.entityMapScope,
      MASTER_COURSE_ENTITY_TYPES.COURSE,
      params.sourceSnapshot.course.id,
      targetCourseId,
      transaction,
    );

    return targetCourseId;
  }

  private async syncCategoryFromSource(sourceSnapshot: SourceSnapshot): Promise<UUIDType> {
    const categoryValues = {
      title: toJsonbBuildObject(sourceSnapshot.category.title),
      baseLanguage: sourceSnapshot.category.baseLanguage,
      availableLocales: sourceSnapshot.category.availableLocales,
    };

    const existingCategory = await this.courseTransferGraphRepository.findCategoryByBaseTitle(
      sourceSnapshot.categoryBaseTitle,
      sourceSnapshot.category.baseLanguage,
    );

    if (existingCategory) {
      await this.courseTransferGraphRepository.updateCategoryFromSource(
        existingCategory.id,
        categoryValues,
      );

      return existingCategory.id;
    }

    const createdCategory =
      await this.courseTransferGraphRepository.createCategoryFromSource(categoryValues);

    if (createdCategory) return createdCategory.id;

    const conflictingCategory =
      await this.courseTransferGraphRepository.findCategoryByLocalizedTitle(
        sourceSnapshot.categoryBaseTitle,
      );

    if (!conflictingCategory) {
      throw new BadRequestException("masterCourse.error.targetCategoryMissing");
    }

    await this.courseTransferGraphRepository.updateCategoryFromSource(
      conflictingCategory.id,
      categoryValues,
    );

    return conflictingCategory.id;
  }

  private async updateTargetCourseFromSource(
    params: UpdateTargetCourseFromSourceParams,
  ): Promise<void> {
    const {
      sourceCourseId,
      sourceTenantId,
      sourceSnapshot: { course },
      courseSettings,
      categoryId,
    } = params;
    const copiedCourseSettings = this.applyCopiedCourseSettingsReferences(
      courseSettings,
      course.id,
      params.resourceCollection,
    );

    await this.courseTransferGraphRepository.updateTargetCourse(params.targetCourseId, {
      title: toJsonbBuildObject(course.title),
      description: toJsonbBuildObject(course.description),
      thumbnailS3Key: getCopiedInternalReference(
        params.resourceCollection,
        COURSE_TRANSFER_RESOURCE_GROUPS.COURSES,
        ENTITY_TYPES.COURSE,
        course.id,
        "thumbnailS3Key",
        course.thumbnailS3Key,
      ),
      thumbnailPositionY: course.thumbnailPositionY,
      learningOutcomes: course.learningOutcomes,
      showAuthorSection: course.showAuthorSection,
      hasCertificate: course.hasCertificate,
      priceInCents: 0,
      currency: course.currency,
      chapterCount: course.chapterCount,
      courseType: course.courseType,
      authorId: params.targetAuthorId,
      authorMetadata: toNullableJsonbBuildObject(course.authorMetadata),
      categoryId,
      stripeProductId: null,
      stripePriceId: null,
      settings: toJsonbBuildObject(copiedCourseSettings),
      baseLanguage: course.baseLanguage,
      availableLocales: course.availableLocales,
      originType: COURSE_ORIGIN_TYPES.EXPORTED,
      sourceCourseId,
      sourceTenantId,
    });
  }

  private async syncChapters(params: SyncChaptersParams, transaction: DatabasePg) {
    const chapterMap = new Map<UUIDType, UUIDType>();

    for (const sourceChapter of params.sourceSnapshot.chapters) {
      const syncedLessonCount = this.getSyncedLessonCountForChapter(
        params.sourceSnapshot,
        sourceChapter.id,
      );
      const mappedId = await this.resolveOrCreateMappedTargetId(
        params.entityMapScope,
        MASTER_COURSE_ENTITY_TYPES.CHAPTER,
        sourceChapter.id,
        () =>
          this.courseTransferGraphRepository.createTargetChapter({
            title: toJsonbBuildObject(sourceChapter.title),
            courseId: params.targetCourseId,
            authorId: params.targetAuthorId,
            isFreemium: sourceChapter.isFreemium,
            displayOrder: sourceChapter.displayOrder,
            lessonCount: syncedLessonCount,
          }),
        transaction,
      );

      await this.courseTransferGraphRepository.updateTargetChapter(mappedId, {
        title: toJsonbBuildObject(sourceChapter.title),
        courseId: params.targetCourseId,
        authorId: params.targetAuthorId,
        isFreemium: sourceChapter.isFreemium,
        displayOrder: sourceChapter.displayOrder,
        lessonCount: syncedLessonCount,
      });

      chapterMap.set(sourceChapter.id, mappedId);
    }

    return chapterMap;
  }

  private async duplicateChapters(params: DuplicateChaptersParams) {
    const chapterMap = new Map<UUIDType, UUIDType>();

    for (const sourceChapter of params.sourceSnapshot.chapters) {
      const syncedLessonCount = this.getSyncedLessonCountForChapter(
        params.sourceSnapshot,
        sourceChapter.id,
      );

      const duplicatedChapterValues = this.omitCopiedRowFields(sourceChapter, [
        "id",
        "createdAt",
        "updatedAt",
        "courseId",
        "authorId",
        "tenantId",
      ] as const);

      const targetChapterId = await this.courseTransferGraphRepository.createTargetChapter({
        ...duplicatedChapterValues,
        title: toJsonbBuildObject(sourceChapter.title),
        courseId: params.targetCourseId,
        authorId: params.targetAuthorId,
        lessonCount: syncedLessonCount,
      });

      chapterMap.set(sourceChapter.id, targetChapterId);
    }

    return chapterMap;
  }

  private async syncLessons(params: SyncLessonsParams, transaction: DatabasePg) {
    const lessonMap = new Map<UUIDType, UUIDType>();

    for (const sourceLesson of params.sourceSnapshot.lessons) {
      if (!shouldSyncLesson(sourceLesson)) continue;

      const mappedChapterId = params.chapterMap.get(sourceLesson.chapterId);
      if (!mappedChapterId) continue;

      const mappedId = await this.resolveOrCreateMappedTargetId(
        params.entityMapScope,
        MASTER_COURSE_ENTITY_TYPES.LESSON,
        sourceLesson.id,
        () =>
          this.courseTransferGraphRepository.createTargetLesson({
            chapterId: mappedChapterId,
            type: sourceLesson.type,
            title: toJsonbBuildObject(sourceLesson.title),
            description: toNullableJsonbBuildObject(sourceLesson.description),
            thresholdScore: sourceLesson.thresholdScore,
            attemptsLimit: sourceLesson.attemptsLimit,
            quizCooldownInHours: sourceLesson.quizCooldownInHours,
            displayOrder: sourceLesson.displayOrder,
            fileS3Key: getCopiedInternalReference(
              params.resourceCollection,
              COURSE_TRANSFER_RESOURCE_GROUPS.LESSONS,
              ENTITY_TYPES.LESSON,
              sourceLesson.id,
              "fileS3Key",
              sourceLesson.fileS3Key,
            ),
            fileType: sourceLesson.fileType,
            isExternal: sourceLesson.isExternal,
          }),
        transaction,
      );

      await this.courseTransferGraphRepository.updateTargetLesson(mappedId, {
        chapterId: mappedChapterId,
        type: sourceLesson.type,
        title: toJsonbBuildObject(sourceLesson.title),
        description: toNullableJsonbBuildObject(sourceLesson.description),
        thresholdScore: sourceLesson.thresholdScore,
        attemptsLimit: sourceLesson.attemptsLimit,
        quizCooldownInHours: sourceLesson.quizCooldownInHours,
        displayOrder: sourceLesson.displayOrder,
        fileS3Key: getCopiedInternalReference(
          params.resourceCollection,
          COURSE_TRANSFER_RESOURCE_GROUPS.LESSONS,
          ENTITY_TYPES.LESSON,
          sourceLesson.id,
          "fileS3Key",
          sourceLesson.fileS3Key,
        ),
        fileType: sourceLesson.fileType,
        isExternal: sourceLesson.isExternal,
      });

      lessonMap.set(sourceLesson.id, mappedId);
    }

    return lessonMap;
  }

  private async duplicateLessons(params: DuplicateLessonsParams) {
    const lessonMap = new Map<UUIDType, UUIDType>();

    for (const sourceLesson of params.sourceSnapshot.lessons) {
      if (!shouldSyncLesson(sourceLesson)) continue;

      const mappedChapterId = params.chapterMap.get(sourceLesson.chapterId);
      if (!mappedChapterId) continue;

      const duplicatedLessonValues = this.omitCopiedRowFields(sourceLesson, [
        "id",
        "createdAt",
        "updatedAt",
        "chapterId",
        "tenantId",
      ] as const);

      const targetLessonId = await this.courseTransferGraphRepository.createTargetLesson({
        ...duplicatedLessonValues,
        chapterId: mappedChapterId,
        title: toJsonbBuildObject(sourceLesson.title),
        description: toNullableJsonbBuildObject(sourceLesson.description),
        fileS3Key: getCopiedInternalReference(
          params.resourceCollection,
          COURSE_TRANSFER_RESOURCE_GROUPS.LESSONS,
          ENTITY_TYPES.LESSON,
          sourceLesson.id,
          "fileS3Key",
          sourceLesson.fileS3Key,
        ),
      });

      lessonMap.set(sourceLesson.id, targetLessonId);
    }

    return lessonMap;
  }

  private getSyncedLessonCountForChapter(
    sourceSnapshot: SourceSnapshot,
    sourceChapterId: UUIDType,
  ) {
    return sourceSnapshot.lessons.filter(
      (sourceLesson) =>
        sourceLesson.chapterId === sourceChapterId && shouldSyncLesson(sourceLesson),
    ).length;
  }

  private async syncQuestions(params: SyncQuestionsParams, transaction: DatabasePg) {
    const questionMap = new Map<UUIDType, UUIDType>();

    await this.syncAssessmentSettings(params.sourceSnapshot, params.lessonMap);

    for (const sourceQuestion of params.sourceSnapshot.questions) {
      const mappedLessonId = params.lessonMap.get(sourceQuestion.lessonId);
      if (!mappedLessonId) continue;
      const sourceAssessment = params.sourceSnapshot.assessments.find(
        (assessment) => assessment.lessonId === sourceQuestion.lessonId,
      );
      if (!sourceAssessment) continue;

      const mappedId = await this.resolveOrCreateMappedTargetId(
        params.entityMapScope,
        MASTER_COURSE_ENTITY_TYPES.QUESTION,
        sourceQuestion.id,
        () =>
          this.createTargetQuestion(
            {
              lessonId: mappedLessonId,
              type: sourceQuestion.type,
              prompt: toJsonbBuildObject(sourceQuestion.prompt),
              description: toNullableJsonbBuildObject(sourceQuestion.description),
              title: toJsonbBuildObject(sourceQuestion.title),
              displayOrder: sourceQuestion.displayOrder,
              gradingMode: sourceQuestion.gradingMode,
              solutionExplanation: toNullableJsonbBuildObject(sourceQuestion.solutionExplanation),
              photoS3Key: getCopiedInternalReference(
                params.resourceCollection,
                COURSE_TRANSFER_RESOURCE_GROUPS.QUESTIONS,
                ENTITY_TYPES.QUESTION,
                sourceQuestion.id,
                "photoS3Key",
                sourceQuestion.photoS3Key,
              ),
              authorId: params.targetAuthorId,
            },
            this.mapTargetAssessmentValues(sourceAssessment, mappedLessonId),
          ),
        transaction,
      );

      await this.courseTransferGraphRepository.updateTargetQuestion(mappedId, {
        lessonId: mappedLessonId,
        type: sourceQuestion.type,
        prompt: toJsonbBuildObject(sourceQuestion.prompt),
        description: toNullableJsonbBuildObject(sourceQuestion.description),
        title: toJsonbBuildObject(sourceQuestion.title),
        displayOrder: sourceQuestion.displayOrder,
        gradingMode: sourceQuestion.gradingMode,
        solutionExplanation: toNullableJsonbBuildObject(sourceQuestion.solutionExplanation),
        photoS3Key: getCopiedInternalReference(
          params.resourceCollection,
          COURSE_TRANSFER_RESOURCE_GROUPS.QUESTIONS,
          ENTITY_TYPES.QUESTION,
          sourceQuestion.id,
          "photoS3Key",
          sourceQuestion.photoS3Key,
        ),
      });

      questionMap.set(sourceQuestion.id, mappedId);
    }

    return questionMap;
  }

  private async duplicateQuestions(params: DuplicateQuestionsParams) {
    const questionMap = new Map<UUIDType, UUIDType>();

    await this.syncAssessmentSettings(params.sourceSnapshot, params.lessonMap);

    for (const sourceQuestion of params.sourceSnapshot.questions) {
      const mappedLessonId = params.lessonMap.get(sourceQuestion.lessonId);
      if (!mappedLessonId) continue;
      const sourceAssessment = params.sourceSnapshot.assessments.find(
        (assessment) => assessment.lessonId === sourceQuestion.lessonId,
      );
      if (!sourceAssessment) continue;

      const duplicatedQuestionValues = this.omitCopiedRowFields(sourceQuestion, [
        "id",
        "createdAt",
        "updatedAt",
        "lessonId",
        "authorId",
        "tenantId",
      ] as const);

      const targetQuestionId = await this.createTargetQuestion(
        {
          ...duplicatedQuestionValues,
          lessonId: mappedLessonId,
          prompt: toJsonbBuildObject(sourceQuestion.prompt),
          description: toNullableJsonbBuildObject(sourceQuestion.description),
          title: toJsonbBuildObject(sourceQuestion.title),
          solutionExplanation: toNullableJsonbBuildObject(sourceQuestion.solutionExplanation),
          photoS3Key: getCopiedInternalReference(
            params.resourceCollection,
            COURSE_TRANSFER_RESOURCE_GROUPS.QUESTIONS,
            ENTITY_TYPES.QUESTION,
            sourceQuestion.id,
            "photoS3Key",
            sourceQuestion.photoS3Key,
          ),
          authorId: params.targetAuthorId,
        },
        this.mapTargetAssessmentValues(sourceAssessment, mappedLessonId),
      );

      questionMap.set(sourceQuestion.id, targetQuestionId);
    }

    return questionMap;
  }

  private async syncAssessmentSettings(
    sourceSnapshot: SourceSnapshot,
    lessonMap: Map<UUIDType, UUIDType>,
  ) {
    for (const sourceAssessment of sourceSnapshot.assessments) {
      const targetLessonId = lessonMap.get(sourceAssessment.lessonId);

      if (!targetLessonId) continue;

      await this.courseTransferGraphRepository.upsertTargetAssessment({
        lessonId: targetLessonId,
        passingScorePercentage: sourceAssessment.passingScorePercentage,
        attemptLimitMode: sourceAssessment.attemptLimitMode,
        maximumAttempts: sourceAssessment.maximumAttempts,
        attemptCooldown: sourceAssessment.attemptCooldown,
        feedbackMode: sourceAssessment.feedbackMode,
        baseLanguage: sourceAssessment.baseLanguage,
        availableLocales: sourceAssessment.availableLocales,
      });
    }
  }

  private mapTargetAssessmentValues(
    sourceAssessment: SourceSnapshot["assessments"][number],
    targetLessonId: UUIDType,
  ): AssessmentUpsertValues {
    return {
      lessonId: targetLessonId,
      passingScorePercentage: sourceAssessment.passingScorePercentage,
      attemptLimitMode: sourceAssessment.attemptLimitMode,
      maximumAttempts: sourceAssessment.maximumAttempts,
      attemptCooldown: sourceAssessment.attemptCooldown,
      feedbackMode: sourceAssessment.feedbackMode,
      baseLanguage: sourceAssessment.baseLanguage,
      availableLocales: sourceAssessment.availableLocales,
    };
  }

  private async syncOptions(
    { entityMapScope, sourceSnapshot, questionMap }: SyncOptionsParams,
    transaction: DatabasePg,
  ) {
    await this.cleanupMissingMappings(
      entityMapScope,
      MASTER_COURSE_ENTITY_TYPES.OPTION,
      sourceSnapshot.options.map(({ id }) => id),
      assessmentQuestionChoiceOptions,
      transaction,
    );

    const mappings = await this.courseTransferGraphRepository.getMappings(
      entityMapScope,
      MASTER_COURSE_ENTITY_TYPES.OPTION,
      transaction,
    );

    const existingOptionMap = new Map(
      mappings.map(({ sourceEntityId, targetEntityId }) => [sourceEntityId, targetEntityId]),
    );

    const optionMap = await this.tenantDbRunnerService.transaction(async () => {
      await this.releaseTargetOptionDisplayOrders([...questionMap.values()]);

      const syncedOptions = new Map<UUIDType, UUIDType>();
      for (const sourceOption of sourceSnapshot.options) {
        const targetQuestionId = questionMap.get(sourceOption.questionId);
        if (!targetQuestionId) continue;

        const targetOptionId = await this.syncTargetOption(
          sourceOption,
          targetQuestionId,
          existingOptionMap.get(sourceOption.id),
        );
        syncedOptions.set(sourceOption.id, targetOptionId);
      }
      return syncedOptions;
    });

    for (const [sourceId, targetId] of optionMap) {
      await this.courseTransferGraphRepository.upsertMap(
        entityMapScope,
        MASTER_COURSE_ENTITY_TYPES.OPTION,
        sourceId,
        targetId,
        transaction,
      );
    }
    return optionMap;
  }

  private async syncTargetOption(
    sourceOption: SourceSnapshot["options"][number],
    targetQuestionId: UUIDType,
    targetOptionId?: UUIDType,
  ): Promise<UUIDType> {
    const values = {
      questionId: targetQuestionId,
      optionText: toJsonbBuildObject(sourceOption.optionText),
      isCorrect: sourceOption.isCorrect,
      displayOrder: sourceOption.displayOrder,
      matchedWord: toNullableJsonbBuildObject(sourceOption.matchedWord),
      scaleAnswer: sourceOption.scaleAnswer,
    };

    if (!targetOptionId) return this.courseTransferGraphRepository.createTargetOption(values);

    await this.courseTransferGraphRepository.updateTargetOption(targetOptionId, values);
    return targetOptionId;
  }

  private async duplicateOptions(params: DuplicateOptionsParams) {
    const optionMap = new Map<UUIDType, UUIDType>();

    for (const sourceOption of params.sourceSnapshot.options) {
      const mappedQuestionId = params.questionMap.get(sourceOption.questionId);
      if (!mappedQuestionId) continue;

      const duplicatedOptionValues = this.omitCopiedRowFields(sourceOption, [
        "id",
        "createdAt",
        "updatedAt",
        "questionId",
        "tenantId",
      ] as const);

      const targetOptionId = await this.courseTransferGraphRepository.createTargetOption({
        ...duplicatedOptionValues,
        questionId: mappedQuestionId,
        optionText: toJsonbBuildObject(sourceOption.optionText),
        matchedWord: toNullableJsonbBuildObject(sourceOption.matchedWord),
      });

      optionMap.set(sourceOption.id, targetOptionId);
    }

    return optionMap;
  }

  private async syncAssessmentQuestionDetails(params: SyncAssessmentQuestionDetailsParams) {
    const blankMap = new Map<UUIDType, UUIDType>();
    const targetQuestionIds = [...params.questionMap.values()];
    const targetScaleOptionIds = params.sourceSnapshot.assessmentQuestionScaleOptions.map(
      ({ id }) => uuidv5(id, params.targetCourseId) as UUIDType,
    );
    const targetTrueFalseStatementIds =
      params.sourceSnapshot.assessmentQuestionTrueFalseStatements.map(
        ({ id }) => uuidv5(id, params.targetCourseId) as UUIDType,
      );
    const targetBlankIds = params.sourceSnapshot.assessmentQuestionBlanks.map(
      ({ id }) => uuidv5(id, params.targetCourseId) as UUIDType,
    );
    const targetDragAndDropOptionIds =
      params.sourceSnapshot.assessmentQuestionDragAndDropOptions.map(
        ({ id }) => uuidv5(id, params.targetCourseId) as UUIDType,
      );

    await this.courseTransferGraphRepository.deleteStaleTargetQuestionDetails({
      questionIds: targetQuestionIds,
      scaleOptionIds: targetScaleOptionIds,
      trueFalseStatementIds: targetTrueFalseStatementIds,
      blankIds: targetBlankIds,
      dragAndDropOptionIds: targetDragAndDropOptionIds,
    });

    for (const sourceOption of params.sourceSnapshot.assessmentQuestionScaleOptions) {
      const targetQuestionId = params.questionMap.get(sourceOption.questionId);

      if (!targetQuestionId) continue;

      await this.courseTransferGraphRepository.upsertTargetScaleOption({
        id: uuidv5(sourceOption.id, params.targetCourseId) as UUIDType,
        questionId: targetQuestionId,
        scaleValue: sourceOption.scaleValue,
        displayOrder: sourceOption.displayOrder,
        label: sourceOption.label as LocalizedText,
      });
    }

    for (const sourceSettings of params.sourceSnapshot.assessmentQuestionOpenTextSettings) {
      const targetQuestionId = params.questionMap.get(sourceSettings.questionId);

      if (!targetQuestionId) continue;

      await this.courseTransferGraphRepository.upsertTargetOpenTextSettings({
        questionId: targetQuestionId,
        minimumCharacters: sourceSettings.minimumCharacters,
        maximumCharacters: sourceSettings.maximumCharacters,
        reviewerInstructions: sourceSettings.reviewerInstructions,
      });
    }

    for (const sourceStatement of params.sourceSnapshot.assessmentQuestionTrueFalseStatements) {
      const targetQuestionId = params.questionMap.get(sourceStatement.questionId);

      if (!targetQuestionId) continue;

      await this.courseTransferGraphRepository.upsertTargetTrueFalseStatement({
        id: uuidv5(sourceStatement.id, params.targetCourseId) as UUIDType,
        questionId: targetQuestionId,
        language: sourceStatement.language,
        displayOrder: sourceStatement.displayOrder,
        correctValue: sourceStatement.correctValue,
        statement: sourceStatement.statement,
      });
    }

    for (const sourceBlank of params.sourceSnapshot.assessmentQuestionBlanks) {
      const targetQuestionId = params.questionMap.get(sourceBlank.questionId);

      if (!targetQuestionId) continue;

      const targetBlankId = uuidv5(sourceBlank.id, params.targetCourseId) as UUIDType;

      await this.courseTransferGraphRepository.upsertTargetBlank({
        id: targetBlankId,
        questionId: targetQuestionId,
        textComparisonMode: sourceBlank.textComparisonMode,
      });

      blankMap.set(sourceBlank.id, targetBlankId);
    }

    for (const sourceAnswerSet of params.sourceSnapshot.assessmentQuestionBlankAnswerSets) {
      const targetBlankId = blankMap.get(sourceAnswerSet.blankId);

      if (!targetBlankId) continue;

      await this.courseTransferGraphRepository.upsertTargetBlankAnswerSet({
        blankId: targetBlankId,
        language: sourceAnswerSet.language,
        preferredAnswer: sourceAnswerSet.preferredAnswer,
        acceptedAnswers: sourceAnswerSet.acceptedAnswers,
      });
    }

    for (const sourceOption of params.sourceSnapshot.assessmentQuestionDragAndDropOptions) {
      const targetQuestionId = params.questionMap.get(sourceOption.questionId);

      if (!targetQuestionId) continue;

      const targetBlankId = sourceOption.targetBlankId
        ? (blankMap.get(sourceOption.targetBlankId) ?? null)
        : null;

      if (targetBlankId) blankMap.set(sourceOption.id, targetBlankId);

      await this.courseTransferGraphRepository.upsertTargetDragAndDropOption({
        id: uuidv5(sourceOption.id, params.targetCourseId) as UUIDType,
        questionId: targetQuestionId,
        language: sourceOption.language,
        label: sourceOption.label,
        targetBlankId,
        displayOrder: sourceOption.displayOrder,
      });
    }

    return blankMap;
  }

  private omitCopiedRowFields<T extends object, K extends keyof T>(
    source: T,
    keys: readonly K[],
  ): Omit<T, K> {
    const copied = { ...source };

    for (const key of keys) {
      delete (copied as Partial<T>)[key];
    }

    return copied as Omit<T, K>;
  }

  private async syncAiMentors(params: SyncAiMentorsParams) {
    const { lessonMap, sourceSnapshot, resourceCollection } = params;

    const aiMentorMap = new Map<UUIDType, UUIDType>();

    for (const sourceAiMentor of sourceSnapshot.aiMentors) {
      const mappedLessonId = lessonMap.get(sourceAiMentor.lessonId);
      if (!mappedLessonId) continue;

      const existingAiMentor =
        await this.courseTransferGraphRepository.findAiMentorByLessonId(mappedLessonId);
      const avatarReference = getCopiedInternalReference(
        resourceCollection,
        COURSE_TRANSFER_RESOURCE_GROUPS.LESSONS,
        ENTITY_TYPES.LESSON,
        sourceAiMentor.lessonId,
        "aiMentorLessons.avatarReference",
        sourceAiMentor.avatarReference,
      );
      const customTtsReference = this.buildCopiedAiMentorCustomTtsReference(sourceAiMentor);

      if (!existingAiMentor) {
        const targetAiMentorId = await this.courseTransferGraphRepository.createAiMentor({
          lessonId: mappedLessonId,
          name: toJsonbBuildObject(sourceAiMentor.name),
          avatarReference,
          voiceMode: sourceAiMentor.voiceMode,
          ttsPreset: sourceAiMentor.ttsPreset,
          customTtsReference,
        });
        aiMentorMap.set(sourceAiMentor.id, targetAiMentorId);
        continue;
      }

      await this.courseTransferGraphRepository.updateAiMentor(existingAiMentor.id, {
        name: toJsonbBuildObject(sourceAiMentor.name),
        avatarReference,
        voiceMode: sourceAiMentor.voiceMode,
        ttsPreset: sourceAiMentor.ttsPreset,
        customTtsReference,
      });
      aiMentorMap.set(sourceAiMentor.id, existingAiMentor.id);
    }

    return aiMentorMap;
  }

  private async syncAiMentorConfigurations(
    sourceSnapshot: SourceSnapshot,
    aiMentorMap: Map<UUIDType, UUIDType>,
  ) {
    const teacherByConfigurationId = new Map(
      sourceSnapshot.aiMentorTeacherConfigurations.map((configuration) => [
        configuration.configurationId,
        configuration,
      ]),
    );
    const roleplayByConfigurationId = new Map(
      sourceSnapshot.aiMentorRoleplayConfigurations.map((configuration) => [
        configuration.configurationId,
        configuration,
      ]),
    );

    for (const sourceConfiguration of sourceSnapshot.aiMentorConfigurations) {
      if (!sourceConfiguration.aiMentorLessonId) continue;
      const targetAiMentorLessonId = aiMentorMap.get(sourceConfiguration.aiMentorLessonId);
      if (!targetAiMentorLessonId) continue;

      await this.tenantDbRunnerService.transactionWithHandle(async (transaction) => {
        const existingConfiguration =
          await this.courseTransferGraphRepository.findAiMentorConfigurationByAiMentorLessonId(
            targetAiMentorLessonId,
            transaction,
          );
        const rootValues = {
          type: sourceConfiguration.type,
          openingInstruction: toNullableJsonbBuildObject(sourceConfiguration.openingInstruction),
          additionalInstructions: toNullableJsonbBuildObject(
            sourceConfiguration.additionalInstructions,
          ),
        };
        const targetConfigurationId = existingConfiguration
          ? existingConfiguration.id
          : await this.courseTransferGraphRepository.createAiMentorConfiguration(
              { ...rootValues, aiMentorLessonId: targetAiMentorLessonId },
              transaction,
            );

        if (existingConfiguration)
          await this.courseTransferGraphRepository.updateAiMentorConfiguration(
            targetConfigurationId,
            rootValues,
            transaction,
          );

        const sourceTeacher = teacherByConfigurationId.get(sourceConfiguration.id);
        const sourceRoleplay = roleplayByConfigurationId.get(sourceConfiguration.id);
        const teacher =
          sourceConfiguration.type === AI_MENTOR_TYPE.TEACHER && sourceTeacher
            ? {
                taskGoal: toJsonbBuildObject(sourceTeacher.taskGoal),
                expertise: toJsonbBuildObject(sourceTeacher.expertise),
                contentScope: toJsonbBuildObject(sourceTeacher.contentScope),
                teachingStyle: sourceTeacher.teachingStyle,
                feedbackGuidance: toNullableJsonbBuildObject(sourceTeacher.feedbackGuidance),
              }
            : null;
        const roleplay =
          sourceConfiguration.type === AI_MENTOR_TYPE.ROLEPLAY && sourceRoleplay
            ? {
                scenario: toJsonbBuildObject(sourceRoleplay.scenario),
                aiRole: toJsonbBuildObject(sourceRoleplay.aiRole),
                learnerRole: toJsonbBuildObject(sourceRoleplay.learnerRole),
                characterGoal: toJsonbBuildObject(sourceRoleplay.characterGoal),
                difficulty: sourceRoleplay.difficulty,
                factsAndConstraints: toNullableJsonbBuildObject(sourceRoleplay.factsAndConstraints),
              }
            : null;

        await this.courseTransferGraphRepository.deleteAiMentorConfigurationSubtypes(
          targetConfigurationId,
          transaction,
        );
        if (teacher) {
          await this.courseTransferGraphRepository.createAiMentorTeacherConfiguration(
            { ...teacher, configurationId: targetConfigurationId },
            transaction,
          );
        }
        if (roleplay) {
          await this.courseTransferGraphRepository.createAiMentorRoleplayConfiguration(
            { ...roleplay, configurationId: targetConfigurationId },
            transaction,
          );
        }
      });
    }
  }

  private async syncAiJudgeConfigurations(
    sourceSnapshot: SourceSnapshot,
    aiMentorMap: Map<UUIDType, UUIDType>,
  ) {
    const criteriaByConfiguration = groupBy(
      sourceSnapshot.aiJudgeCriteria,
      ({ configurationId }) => configurationId,
    );
    const guidanceByCriterion = groupBy(
      sourceSnapshot.aiJudgeScoreGuidance,
      ({ criterionId }) => criterionId,
    );
    const blockingErrorsByConfiguration = groupBy(
      sourceSnapshot.aiJudgeBlockingErrors,
      ({ configurationId }) => configurationId,
    );

    for (const sourceConfiguration of sourceSnapshot.aiJudgeConfigurations) {
      if (!sourceConfiguration.aiMentorLessonId) continue;
      const targetAiMentorLessonId = aiMentorMap.get(sourceConfiguration.aiMentorLessonId);
      if (!targetAiMentorLessonId) continue;

      await this.tenantDbRunnerService.transactionWithHandle(async (transaction) => {
        const existingConfiguration =
          await this.courseTransferGraphRepository.findAiJudgeConfigurationByAiMentorLessonId(
            targetAiMentorLessonId,
            transaction,
          );

        let targetConfigurationId: UUIDType;
        if (existingConfiguration) {
          targetConfigurationId = existingConfiguration.id;
          await this.courseTransferGraphRepository.updateAiJudgeConfiguration(
            targetConfigurationId,
            {
              taskGoal: toJsonbBuildObject(sourceConfiguration.taskGoal),
              passingThresholdPercent: sourceConfiguration.passingThresholdPercent,
            },
            transaction,
          );
        } else {
          targetConfigurationId =
            await this.courseTransferGraphRepository.createAiJudgeConfiguration(
              {
                aiMentorLessonId: targetAiMentorLessonId,
                taskGoal: toJsonbBuildObject(sourceConfiguration.taskGoal),
                passingThresholdPercent: sourceConfiguration.passingThresholdPercent,
              },
              transaction,
            );
        }

        await this.courseTransferGraphRepository.deleteAiJudgeCriteria(
          targetConfigurationId,
          transaction,
        );
        await this.courseTransferGraphRepository.deleteAiJudgeBlockingErrors(
          targetConfigurationId,
          transaction,
        );

        for (const sourceCriterion of criteriaByConfiguration[sourceConfiguration.id] ?? []) {
          const targetCriterionId = await this.courseTransferGraphRepository.createAiJudgeCriterion(
            {
              configurationId: targetConfigurationId,
              maxScore: sourceCriterion.maxScore,
              title: toJsonbBuildObject(sourceCriterion.title),
              expectedBehavior: toJsonbBuildObject(sourceCriterion.expectedBehavior),
              createdAt: sourceCriterion.createdAt,
              updatedAt: sourceCriterion.updatedAt,
            },
            transaction,
          );

          for (const sourceGuidance of guidanceByCriterion[sourceCriterion.id] ?? [])
            await this.courseTransferGraphRepository.createAiJudgeScoreGuidance(
              {
                criterionId: targetCriterionId,
                score: sourceGuidance.score,
                description: toJsonbBuildObject(sourceGuidance.description),
                example: toNullableJsonbBuildObject(sourceGuidance.example),
                createdAt: sourceGuidance.createdAt,
                updatedAt: sourceGuidance.updatedAt,
              },
              transaction,
            );
        }

        for (const sourceBlockingError of blockingErrorsByConfiguration[sourceConfiguration.id] ??
          [])
          await this.courseTransferGraphRepository.createAiJudgeBlockingError(
            {
              configurationId: targetConfigurationId,
              description: toJsonbBuildObject(sourceBlockingError.description),
              createdAt: sourceBlockingError.createdAt,
              updatedAt: sourceBlockingError.updatedAt,
            },
            transaction,
          );
      });
    }
  }

  private async syncAiMentorContexts(
    sourceSnapshot: SourceSnapshot,
    aiMentorMap: Map<UUIDType, UUIDType>,
    targetTenantId: UUIDType,
  ) {
    const targetAiMentorIds = Array.from(aiMentorMap.values());
    await this.courseTransferGraphRepository.removeAiMentorDocumentLinks(targetAiMentorIds);

    const documentMap = new Map<UUIDType, UUIDType>();
    const sourceDocumentsById = new Map(
      sourceSnapshot.aiMentorDocuments.map((document) => [document.id, document]),
    );

    for (const sourceDocument of sourceSnapshot.aiMentorDocuments) {
      const checksum = this.buildTargetDocumentChecksum(
        sourceDocument.checksum,
        sourceDocument.id,
        targetTenantId,
      );
      const documentValues = {
        fileName: sourceDocument.fileName,
        contentType: sourceDocument.contentType,
        byteSize: sourceDocument.byteSize,
        checksum,
        status: sourceDocument.status,
        errorMessage: sourceDocument.errorMessage,
        metadata: normalizeJsonb(sourceDocument.metadata, {}),
      };
      const existingDocument =
        await this.courseTransferGraphRepository.findDocumentByChecksum(checksum);
      const targetDocumentId =
        existingDocument?.id ??
        (await this.courseTransferGraphRepository.createDocument(documentValues));

      if (existingDocument) {
        await this.courseTransferGraphRepository.updateDocument(targetDocumentId, documentValues);
      }

      documentMap.set(sourceDocument.id, targetDocumentId);
    }

    await this.courseTransferGraphRepository.removeDocumentChunks(Array.from(documentMap.values()));

    for (const sourceChunk of sourceSnapshot.aiMentorDocChunks) {
      const targetDocumentId = documentMap.get(sourceChunk.documentId);
      if (!targetDocumentId) continue;

      await this.courseTransferGraphRepository.createDocumentChunk({
        documentId: targetDocumentId,
        chunkIndex: sourceChunk.chunkIndex,
        metadata: normalizeJsonb(sourceChunk.metadata, {}),
        content: sourceChunk.content,
        embedding: sourceChunk.embedding,
      });
    }

    for (const sourceLink of sourceSnapshot.aiMentorDocumentLinks) {
      const targetDocumentId = documentMap.get(sourceLink.documentId);
      const targetAiMentorLessonId = aiMentorMap.get(sourceLink.aiMentorLessonId);

      if (!targetDocumentId || !targetAiMentorLessonId) continue;
      if (!sourceDocumentsById.has(sourceLink.documentId)) continue;

      await this.courseTransferGraphRepository.createAiMentorDocumentLink({
        documentId: targetDocumentId,
        aiMentorLessonId: targetAiMentorLessonId,
      });
    }
  }

  private buildTargetDocumentChecksum(
    sourceChecksum: string,
    sourceDocumentId: UUIDType,
    targetTenantId: UUIDType,
  ) {
    return createHash("sha256")
      .update(`master-course:${targetTenantId}:${sourceDocumentId}:${sourceChecksum}`)
      .digest("hex");
  }

  /**
   * Upserts mirrored SCORM packages and SCOs under stable ids so learner attempts survive a sync,
   * removing only packages and SCOs that no longer exist in the source.
   */
  private async syncScormPackages(params: SyncScormPackagesParams) {
    const sourceScosByPackageId = groupBy(params.sourceSnapshot.scormScos, (sco) => sco.packageId);
    const targetPackages = params.scormPackages.flatMap((preparedPackage) => {
      const targetEntityId = this.getTargetScormPackageEntityId(preparedPackage.sourcePackage, {
        lessonMap: params.lessonMap,
        targetCourseId: params.targetCourseId,
      });

      return targetEntityId ? [{ ...preparedPackage, targetEntityId }] : [];
    });

    await this.courseTransferGraphRepository.removeScormPackagesForMappedTargets({
      targetCourseId: params.targetCourseId,
      targetLessonIds: Array.from(params.lessonMap.values()),
      retainedPackageIds: targetPackages.map(({ targetPackageId }) => targetPackageId),
    });

    for (const targetPackage of targetPackages) {
      const {
        sourcePackage,
        targetPackageId,
        targetEntityId,
        targetOriginalFileReference,
        targetExtractedFilesReference,
      } = targetPackage;

      await this.courseTransferGraphRepository.upsertScormPackage({
        id: targetPackageId,
        entityType: sourcePackage.entityType,
        entityId: targetEntityId,
        language: sourcePackage.language,
        standard: sourcePackage.standard,
        originalFileReference: targetOriginalFileReference,
        extractedFilesReference: targetExtractedFilesReference,
        manifestEntryPoint: rewriteScormStorageReference(
          sourcePackage.manifestEntryPoint,
          sourcePackage.extractedFilesReference,
          targetExtractedFilesReference,
        ),
        manifestJson: rewriteScormJsonReferences(
          sourcePackage.manifestJson,
          sourcePackage.extractedFilesReference,
          targetExtractedFilesReference,
        ),
        status: sourcePackage.status,
      });

      const syncedScos = (sourceScosByPackageId[sourcePackage.id] ?? []).flatMap((sourceSco) => {
        const targetLessonId = params.lessonMap.get(sourceSco.lessonId);

        return targetLessonId ? [{ sourceSco, targetLessonId }] : [];
      });

      await this.courseTransferGraphRepository.removeScormScosMissingFromPackage(
        targetPackageId,
        syncedScos.map(({ sourceSco }) => sourceSco.identifier),
      );

      for (const { sourceSco, targetLessonId } of syncedScos) {
        await this.courseTransferGraphRepository.upsertScormSco({
          packageId: targetPackageId,
          lessonId: targetLessonId,
          organizationIdentifier: sourceSco.organizationIdentifier,
          identifier: sourceSco.identifier,
          identifierRef: sourceSco.identifierRef,
          resourceIdentifier: sourceSco.resourceIdentifier,
          resourceType: sourceSco.resourceType,
          scormType: sourceSco.scormType,
          title: sourceSco.title,
          href: sourceSco.href,
          launchPath: rewriteScormStorageReference(
            sourceSco.launchPath,
            sourcePackage.extractedFilesReference,
            targetExtractedFilesReference,
          ),
          parameters: sourceSco.parameters,
          displayOrder: sourceSco.displayOrder,
          parentIdentifier: sourceSco.parentIdentifier,
          isVisible: sourceSco.isVisible,
          itemMetadataJson: sourceSco.itemMetadataJson,
          resourceMetadataJson: rewriteScormJsonReferences(
            sourceSco.resourceMetadataJson,
            sourcePackage.extractedFilesReference,
            targetExtractedFilesReference,
          ),
        });
      }
    }
  }

  private getTargetScormPackageEntityId(
    sourcePackage: SourceSnapshot["scormPackages"][number],
    params: GetTargetScormPackageEntityIdParams,
  ) {
    if (sourcePackage.entityType === SCORM_PACKAGE_ENTITY_TYPE.COURSE) return params.targetCourseId;
    if (sourcePackage.entityType === SCORM_PACKAGE_ENTITY_TYPE.LESSON) {
      return params.lessonMap.get(sourcePackage.entityId);
    }

    return undefined;
  }

  private async syncLessonResourceReferences(params: SyncLessonResourceReferencesParams) {
    for (const sourceLesson of params.sourceSnapshot.lessons) {
      if (sourceLesson.type !== LESSON_TYPES.CONTENT) continue;

      const mappedLessonId = params.lessonMap.get(sourceLesson.id);
      if (!mappedLessonId) continue;

      const resourceIdMap = this.getLessonResourceIdMap(sourceLesson.id, params.resourceCollection);
      if (!resourceIdMap.size) continue;

      const description = this.rewriteLocalizedRichTextResourceIds(
        sourceLesson.description,
        resourceIdMap,
        params.targetTenantHost,
      );

      await this.courseTransferGraphRepository.updateTargetLesson(mappedLessonId, {
        description: toNullableJsonbBuildObject(description),
      });
    }
  }

  private async syncFillInTheBlanksQuestionReferences(
    params: SyncFillInTheBlanksQuestionReferencesParams,
  ) {
    if (!params.optionMap.size && !params.blankMap.size) return;

    for (const sourceQuestion of params.sourceSnapshot.questions) {
      if (!this.shouldRewriteBlankAnswerReferences(sourceQuestion)) continue;

      const mappedQuestionId = params.questionMap.get(sourceQuestion.id);
      if (!mappedQuestionId) continue;

      const blankMap = this.getQuestionBlankMarkerMap(sourceQuestion, params);
      const description = this.rewriteLocalizedBlankAnswerIds(sourceQuestion.description, {
        ...params,
        blankMap,
      });
      const prompt = this.rewriteLocalizedBlankAnswerIds(sourceQuestion.prompt, {
        ...params,
        blankMap,
      });

      await this.courseTransferGraphRepository.updateTargetQuestion(mappedQuestionId, {
        prompt: toJsonbBuildObject(prompt),
        description: toNullableJsonbBuildObject(description),
      });
    }
  }

  private getLessonResourceIdMap(
    sourceLessonId: UUIDType,
    resourceCollection: CourseTransferResourceCollection,
  ) {
    const resourceIdMap = new Map<string, string>();

    for (const resourceReference of Object.values(
      resourceCollection[COURSE_TRANSFER_RESOURCE_GROUPS.LESSONS].external,
    )) {
      if (resourceReference.source.entityId !== sourceLessonId) continue;
      if (!resourceReference.target.resourceId) continue;

      resourceIdMap.set(resourceReference.source.resourceId, resourceReference.target.resourceId);
    }

    return resourceIdMap;
  }

  private rewriteLocalizedRichTextResourceIds(
    value: unknown,
    resourceIdMap: Map<string, string>,
    targetTenantHost: string,
  ) {
    return mapLocalizedTextEntries(value, (content) =>
      replaceResourceReferencesInRichText(content, resourceIdMap, {
        buildResourceUrl: (resourceId, route) =>
          buildTenantResourceUrl(targetTenantHost, resourceId, route),
      }),
    );
  }

  private shouldRewriteBlankAnswerReferences(sourceQuestion: SourceSnapshot["questions"][number]) {
    return (
      sourceQuestion.type === QUESTION_TYPE.FILL_IN_THE_BLANKS_TEXT ||
      sourceQuestion.type === QUESTION_TYPE.FILL_IN_THE_BLANKS_DND
    );
  }

  private rewriteLocalizedBlankAnswerIds(
    value: unknown,
    params: Pick<SyncFillInTheBlanksQuestionReferencesParams, "optionMap" | "blankMap">,
  ) {
    const idMap = new Map(params.optionMap);

    for (const [sourceBlankId, targetBlankId] of params.blankMap) {
      idMap.set(sourceBlankId, targetBlankId);
    }

    return mapLocalizedTextEntries(value, (content) => rewriteBlankAnswerIds(content, idMap));
  }

  private getQuestionBlankMarkerMap(
    sourceQuestion: SourceSnapshot["questions"][number],
    params: Pick<SyncFillInTheBlanksQuestionReferencesParams, "blankMap" | "sourceSnapshot">,
  ) {
    const questionBlanks = params.sourceSnapshot.assessmentQuestionBlanks.filter(
      (blank) => blank.questionId === sourceQuestion.id,
    );

    const markerIds = [
      ...new Set(
        Object.values(sourceQuestion.description ?? {}).flatMap((content) =>
          [...content.matchAll(BLANK_ANSWER_MARKER_REGEX)].map(([, markerId]) => markerId),
        ),
      ),
    ];

    const markerMap = new Map(params.blankMap);

    markerIds.forEach((markerId, index) => {
      const sourceBlank =
        questionBlanks.find((blank) => blank.id === markerId) ?? questionBlanks[index];
      const targetBlankId = sourceBlank ? params.blankMap.get(sourceBlank.id) : undefined;

      if (targetBlankId) markerMap.set(markerId, targetBlankId);
    });

    return markerMap;
  }

  private applyCopiedCourseSettingsReferences(
    courseSettings: CoursesSettings,
    sourceCourseId: UUIDType,
    resourceCollection: CourseTransferResourceCollection,
  ): CoursesSettings {
    return {
      ...courseSettings,
      certificateSignature: getCopiedInternalReference(
        resourceCollection,
        COURSE_TRANSFER_RESOURCE_GROUPS.COURSES,
        ENTITY_TYPES.COURSE,
        sourceCourseId,
        "settings.certificateSignature",
        courseSettings.certificateSignature,
      ),
    };
  }

  private buildCopiedAiMentorCustomTtsReference(
    sourceAiMentor: SourceSnapshot["aiMentors"][number],
  ) {
    return toNullableJsonbBuildObject(sourceAiMentor.customTtsReference);
  }

  private getTargetResourceEntityId(
    resourceReference: CourseTransferExternalResourceReference,
    params: GetTargetResourceEntityIdParams,
  ) {
    if (resourceReference.source.entityType === ENTITY_TYPES.COURSE) return params.targetCourseId;
    if (resourceReference.source.entityType === ENTITY_TYPES.LESSON) {
      return params.lessonMap.get(resourceReference.source.entityId);
    }
    if (resourceReference.source.entityType === ENTITY_TYPES.ASSESSMENT_QUESTION) {
      return params.questionMap.get(resourceReference.source.entityId);
    }

    return undefined;
  }

  private async syncResources(params: SyncResourcesParams, transaction: DatabasePg) {
    const targetLessonIds = Array.from(params.lessonMap.values());
    const targetQuestionIds = Array.from(params.questionMap.values());

    await this.courseTransferGraphRepository.removeLessonResourceRelations(targetLessonIds);
    await this.courseTransferGraphRepository.removeQuestionResourceRelations(targetQuestionIds);
    await this.courseTransferGraphRepository.removeCourseResourceRelations(params.targetCourseId);

    const externalReferences = getExternalResourceReferences(params.resourceCollection);
    const resourceBySourceId = new Map<UUIDType, CourseTransferExternalResourceReference>();

    for (const resourceReference of externalReferences) {
      if (!resourceBySourceId.has(resourceReference.source.resourceId)) {
        resourceBySourceId.set(resourceReference.source.resourceId, resourceReference);
      }
    }

    await this.cleanupMissingResourceMappings(
      params.entityMapScope,
      Array.from(resourceBySourceId.keys()),
      transaction,
    );

    const targetResourceIds = new Map<UUIDType, UUIDType>();

    for (const [sourceResourceId, resourceReference] of resourceBySourceId) {
      const sourceResource = resourceReference.source.resource;
      const existingTargetResourceId =
        await this.courseTransferGraphRepository.getMappedTargetEntityId(
          params.entityMapScope,
          MASTER_COURSE_ENTITY_TYPES.RESOURCE,
          sourceResourceId,
          transaction,
        );
      const existingTargetResource = existingTargetResourceId
        ? await this.courseTransferGraphRepository.getResourceById(existingTargetResourceId)
        : undefined;
      const resourceValues = {
        title: toJsonbBuildObject(sourceResource.title),
        description: toJsonbBuildObject(sourceResource.description),
        reference: resourceReference.target.reference ?? resourceReference.source.reference,
        contentType: sourceResource.contentType,
        metadata: toJsonbBuildObject(
          mergeResourceMetadataPreservingDuration(
            sourceResource.metadata,
            existingTargetResource?.metadata,
          ),
        ),
        uploadedBy: params.targetAuthorId,
        visibility: RESOURCE_VISIBILITY.HIDDEN,
        archived: false,
      };

      const uploadedResourceId = params.uploadedResourceIdsByFileKey?.get(resourceValues.reference);
      const targetResourceId = uploadedResourceId
        ? await this.adoptUploadedResource(
            uploadedResourceId,
            existingTargetResourceId,
            resourceValues,
          )
        : (existingTargetResourceId ??
          (await this.courseTransferGraphRepository.createResource(resourceValues)));

      if (existingTargetResourceId && !uploadedResourceId) {
        await this.courseTransferGraphRepository.updateResource(targetResourceId, resourceValues);
      } else if (!existingTargetResourceId) {
        await this.courseTransferGraphRepository.upsertMap(
          params.entityMapScope,
          MASTER_COURSE_ENTITY_TYPES.RESOURCE,
          sourceResourceId,
          targetResourceId,
          transaction,
        );
      }

      await this.requestBunnyDurationDiscovery(
        resourceValues.reference,
        targetResourceId,
        params.targetTenantId,
        transaction,
      );

      targetResourceIds.set(sourceResourceId, targetResourceId);
    }

    for (const resourceReference of externalReferences) {
      const targetResourceId = targetResourceIds.get(resourceReference.source.resourceId);

      const targetEntityId = this.getTargetResourceEntityId(resourceReference, {
        lessonMap: params.lessonMap,
        questionMap: params.questionMap,
        targetCourseId: params.targetCourseId,
      });

      if (!targetResourceId || !targetEntityId) continue;

      resourceReference.target.resourceId = targetResourceId;
      resourceReference.target.entityId = targetEntityId;

      await this.courseTransferGraphRepository.createResourceRelation({
        resourceId: targetResourceId,
        entityId: targetEntityId,
        entityType: resourceReference.source.entityType,
        relationshipType:
          resourceReference.source.relationshipType || RESOURCE_RELATIONSHIP_TYPES.TRAILER,
      });
    }
  }

  /**
   * An archive import stores each file as its own resource before mirroring. A resource mirrored
   * by an earlier import takes over the new file, keeping its ID, and the staged one is removed.
   */
  private async adoptUploadedResource(
    uploadedResourceId: UUIDType,
    existingTargetResourceId: UUIDType | undefined,
    resourceValues: ResourceJsonbInsert,
  ): Promise<UUIDType> {
    const uploadedResource =
      await this.courseTransferGraphRepository.getResourceById(uploadedResourceId);
    const values = {
      ...resourceValues,
      contentType: uploadedResource?.contentType ?? resourceValues.contentType,
      metadata: uploadedResource
        ? toJsonbBuildObject(uploadedResource.metadata)
        : resourceValues.metadata,
    };

    if (!existingTargetResourceId || existingTargetResourceId === uploadedResourceId) {
      await this.courseTransferGraphRepository.updateResource(uploadedResourceId, values);
      return uploadedResourceId;
    }

    await this.courseTransferGraphRepository.updateResource(existingTargetResourceId, values);
    await this.courseTransferGraphRepository.deleteResourcesByIds([uploadedResourceId]);
    return existingTargetResourceId;
  }

  private async duplicateResources(params: DuplicateResourcesParams) {
    const targetLessonIds = Array.from(params.lessonMap.values());
    const targetQuestionIds = Array.from(params.questionMap.values());

    await this.courseTransferGraphRepository.removeLessonResourceRelations(targetLessonIds);
    await this.courseTransferGraphRepository.removeQuestionResourceRelations(targetQuestionIds);
    await this.courseTransferGraphRepository.removeCourseResourceRelations(params.targetCourseId);

    const externalReferences = getExternalResourceReferences(params.resourceCollection);
    const resourceBySourceId = new Map<UUIDType, CourseTransferExternalResourceReference>();

    for (const resourceReference of externalReferences) {
      if (!resourceBySourceId.has(resourceReference.source.resourceId)) {
        resourceBySourceId.set(resourceReference.source.resourceId, resourceReference);
      }
    }

    const targetResourceIds = new Map<UUIDType, UUIDType>();

    for (const [sourceResourceId, resourceReference] of resourceBySourceId) {
      const sourceResource = resourceReference.source.resource;
      const reference = resourceReference.target.reference ?? resourceReference.source.reference;
      const resourceValues = {
        title: toJsonbBuildObject(sourceResource.title),
        description: toJsonbBuildObject(sourceResource.description),
        uploadedBy: params.targetAuthorId,
        visibility: sourceResource.visibility,
        archived: false,
      };
      const uploadedResourceId = params.uploadedResourceIdsByFileKey?.get(reference);

      const targetResourceId =
        uploadedResourceId ??
        (await this.courseTransferGraphRepository.createResource({
          ...resourceValues,
          reference,
          contentType: sourceResource.contentType,
          metadata: toJsonbBuildObject(sourceResource.metadata),
        }));

      if (uploadedResourceId) {
        await this.courseTransferGraphRepository.updateResource(uploadedResourceId, resourceValues);
      }

      await this.requestBunnyDurationDiscovery(reference, targetResourceId, params.targetTenantId);

      targetResourceIds.set(sourceResourceId, targetResourceId);
    }

    for (const resourceReference of externalReferences) {
      const targetResourceId = targetResourceIds.get(resourceReference.source.resourceId);
      const targetEntityId = this.getTargetResourceEntityId(resourceReference, {
        lessonMap: params.lessonMap,
        questionMap: params.questionMap,
        targetCourseId: params.targetCourseId,
      });

      if (!targetResourceId || !targetEntityId) continue;

      resourceReference.target.resourceId = targetResourceId;
      resourceReference.target.entityId = targetEntityId;

      await this.courseTransferGraphRepository.createResourceRelation({
        resourceId: targetResourceId,
        entityId: targetEntityId,
        entityType: resourceReference.source.entityType,
        relationshipType:
          resourceReference.source.relationshipType || RESOURCE_RELATIONSHIP_TYPES.TRAILER,
      });
    }
  }

  /** Asks for Bunny duration discovery once the transferred resource has committed. */
  private async requestBunnyDurationDiscovery(
    reference: string,
    resourceId: UUIDType,
    tenantId: UUIDType,
    transaction?: DatabasePg,
  ): Promise<void> {
    if (!getBunnyVideoId(reference)) return;

    await this.outboxPublisher.publishDurable(
      new CourseTransferVideoMetadataRequestedEvent(tenantId, resourceId, reference),
      transaction,
    );
  }

  private async cleanupMissingResourceMappings(
    entityMapScope: CourseTransferEntityMapScope,
    sourceResourceIds: UUIDType[],
    transaction: DatabasePg,
  ) {
    const mappings = await this.courseTransferGraphRepository.getMappings(
      entityMapScope,
      MASTER_COURSE_ENTITY_TYPES.RESOURCE,
      transaction,
    );

    const toDelete = mappings.filter(
      (mapping) => !sourceResourceIds.includes(mapping.sourceEntityId),
    );
    if (!toDelete.length) return;

    await this.courseTransferGraphRepository.deleteResourcesByIds(
      toDelete.map((mapping) => mapping.targetEntityId),
    );
    await this.courseTransferGraphRepository.deleteMappingsByIds(
      entityMapScope,
      toDelete.map((mapping) => mapping.id),
      transaction,
    );
  }

  private async cleanupMissingMirroredEntities(
    entityMapScope: CourseTransferEntityMapScope,
    sourceSnapshot: SourceSnapshot,
    transaction: DatabasePg,
  ) {
    await this.cleanupMissingMappings(
      entityMapScope,
      MASTER_COURSE_ENTITY_TYPES.CHAPTER,
      sourceSnapshot.chapters.map((item) => item.id),
      chapters,
      transaction,
    );
    await this.cleanupMissingMappings(
      entityMapScope,
      MASTER_COURSE_ENTITY_TYPES.LESSON,
      sourceSnapshot.lessons.map((item) => item.id),
      lessons,
      transaction,
    );
    await this.cleanupMissingMappings(
      entityMapScope,
      MASTER_COURSE_ENTITY_TYPES.QUESTION,
      sourceSnapshot.questions.map((item) => item.id),
      assessmentQuestions,
      transaction,
    );
    await this.cleanupMissingMappings(
      entityMapScope,
      MASTER_COURSE_ENTITY_TYPES.OPTION,
      sourceSnapshot.options.map((item) => item.id),
      assessmentQuestionChoiceOptions,
      transaction,
    );
  }

  private async cleanupMissingMappings(
    entityMapScope: CourseTransferEntityMapScope,
    entityType: MasterCourseEntityType,
    sourceIds: UUIDType[],
    targetTable:
      | typeof chapters
      | typeof lessons
      | typeof assessmentQuestions
      | typeof assessmentQuestionChoiceOptions,
    transaction: DatabasePg,
  ) {
    const mappings = await this.courseTransferGraphRepository.getMappings(
      entityMapScope,
      entityType,
      transaction,
    );

    const toDelete = mappings.filter((mapping) => !sourceIds.includes(mapping.sourceEntityId));
    if (!toDelete.length) return;

    const targetIds = toDelete.map((item) => item.targetEntityId);
    if (targetTable === lessons) {
      await this.courseTransferGraphRepository.deleteLessonScormPackages(targetIds);
    }
    await this.courseTransferGraphRepository.deleteMappedEntities(targetTable, targetIds);
    await this.courseTransferGraphRepository.deleteMappingsByIds(
      entityMapScope,
      toDelete.map((item) => item.id),
      transaction,
    );
  }

  private async resolveOrCreateMappedTargetId(
    entityMapScope: CourseTransferEntityMapScope,
    entityType: MasterCourseEntityType,
    sourceEntityId: UUIDType,
    create: () => Promise<UUIDType>,
    transaction: DatabasePg,
  ): Promise<UUIDType> {
    const existingTargetEntityId = await this.courseTransferGraphRepository.getMappedTargetEntityId(
      entityMapScope,
      entityType,
      sourceEntityId,
      transaction,
    );

    if (existingTargetEntityId) return existingTargetEntityId;

    const targetEntityId = await create();
    await this.courseTransferGraphRepository.upsertMap(
      entityMapScope,
      entityType,
      sourceEntityId,
      targetEntityId,
      transaction,
    );
    return targetEntityId;
  }
}
