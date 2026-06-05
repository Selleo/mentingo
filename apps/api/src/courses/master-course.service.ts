import { createHash } from "crypto";
import path from "path";

import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import {
  COURSE_ORIGIN_TYPES,
  ENTITY_TYPES,
  LESSON_TYPES,
  MASTER_COURSE_ENTITY_TYPES,
  PERMISSIONS,
  SCORM_PACKAGE_ENTITY_TYPE,
  type MasterCourseEntityType,
} from "@repo/shared";
import { load as loadHtml } from "cheerio";
import { eq } from "drizzle-orm";
import { groupBy } from "lodash";
import { v5 as uuidv5 } from "uuid";

import { BunnyStreamService } from "src/bunny/bunnyStream.service";
import { DatabasePg } from "src/common";
import { hasPermission } from "src/common/permissions/permission.utils";
import { processInBatches } from "src/common/utils/processInBatches";
import { LESSON_SEQUENCE_ENABLED, QUIZ_FEEDBACK_ENABLED } from "src/courses/constants";
import {
  SCORM_MASTER_COURSE_COPY_BATCH_SIZE,
  SCORM_MASTER_COURSE_PACKAGE_UUID_NAMESPACE,
} from "src/courses/master-course-scorm.constants";
import { MasterCourseQueueService } from "src/courses/master-course.queue.service";
import { MasterCourseRepository } from "src/courses/master-course.repository";
import { MASTER_COURSE_RESOURCE_REFERENCE_KIND } from "src/courses/types/master-course.types";
import { RESOURCE_RELATIONSHIP_TYPES } from "src/file/file.constants";
import { prefixTenantStorageKey } from "src/file/utils/tenantStorageKey";
import { QUESTION_TYPE } from "src/questions/schema/question.types";
import {
  buildTenantResourceUrl,
  extractResourceIdsFromRichText,
  getLocalizedRichTextEntries,
  replaceResourceReferencesInRichText,
} from "src/resource-library/resource-library.utils";
import { S3Service } from "src/s3/s3.service";
import {
  getScormExtractedFilesReference,
  getScormOriginalFileReference,
} from "src/scorm/scorm-storage-paths";
import { DB } from "src/storage/db/db.providers";
import { TenantDbRunnerService } from "src/storage/db/tenant-db-runner.service";
import { chapters, courses, lessons, questionAnswerOptions, questions } from "src/storage/schema";
import { settingsToJSONBuildObject } from "src/utils/settings-to-json-build-object";

import type { UUIDType } from "src/common";
import type { CurrentUserType } from "src/common/types/current-user.type";
import type {
  MasterCourseExportBody,
  MasterCourseExportCandidatesResponse,
  MasterCourseExportLink,
  MasterCourseExportResponse,
} from "src/courses/schemas/masterCourse.schema";
import type {
  MasterCourseExportRecord,
  MasterCourseExternalResourceReference,
  MasterCourseResourceCollection,
  MasterCourseResourceGroupKey,
  SourceSnapshot,
} from "src/courses/types/master-course.types";
import type { CoursesSettings } from "src/courses/types/settings";
import type { MasterCourseExportJobData, MasterCourseSyncJobData } from "src/queue";
import type { Readable } from "stream";

type MasterCourseCopySourceReference = {
  reference: string;
  contentType?: string | null;
  filename?: string | null;
  isVideo?: boolean;
};

@Injectable()
export class MasterCourseService {
  private readonly logger = new Logger(MasterCourseService.name);

  constructor(
    @Inject(DB) private readonly db: DatabasePg,
    private readonly masterCourseRepository: MasterCourseRepository,
    private readonly queueService: MasterCourseQueueService,
    private readonly tenantRunner: TenantDbRunnerService,
    private readonly s3Service: S3Service,
    private readonly bunnyStreamService: BunnyStreamService,
  ) {}

  async exportCourseToTenants(
    sourceCourseId: UUIDType,
    body: MasterCourseExportBody,
    actor: CurrentUserType,
  ): Promise<MasterCourseExportResponse> {
    await this.assertManagingTenantAdmin(actor);

    const targetTenantIds = this.getUniqueTargetTenantIds(body.targetTenantIds, actor.tenantId);

    if (!targetTenantIds.length)
      throw new BadRequestException("masterCourse.error.noTargetTenants");

    const sourceCourse = await this.masterCourseRepository.getCourseById(sourceCourseId);
    if (!sourceCourse) throw new NotFoundException("masterCourse.error.sourceCourseNotFound");

    if (sourceCourse.originType === COURSE_ORIGIN_TYPES.EXPORTED) {
      throw new BadRequestException("masterCourse.error.exportedCourseCannotBeSource");
    }

    const candidates = await this.masterCourseRepository.getExportCandidatesForCourse(
      actor.tenantId,
      sourceCourseId,
    );
    const eligibleTenantIds = candidates.map((candidate) => candidate.id);
    const hasInvalidTargetTenant = targetTenantIds.some(
      (targetTenantId) => !eligibleTenantIds.includes(targetTenantId),
    );

    if (hasInvalidTargetTenant) throw new BadRequestException("masterCourse.error.noTargetTenants");

    const jobs: MasterCourseExportResponse["jobs"] = [];

    for (const targetTenantId of targetTenantIds) {
      jobs.push(
        await this.createOrQueueExportForTarget({
          sourceCourseId,
          sourceTenantId: actor.tenantId,
          targetTenantId,
          actorId: actor.userId,
        }),
      );
    }

    await this.masterCourseRepository.markCourseAsMaster(sourceCourseId);

    return {
      sourceCourseId,
      jobs,
    };
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
  ): Promise<MasterCourseExportCandidatesResponse> {
    await this.assertManagingTenantAdmin(actor);

    const candidates = await this.masterCourseRepository.getExportCandidatesForCourse(
      actor.tenantId,
      sourceCourseId,
    );

    const tenants = candidates.map((candidate) => ({
      id: candidate.id,
      name: candidate.name,
      host: candidate.host,
      isExported: Boolean(candidate.exportId),
      targetCourseId: candidate.targetCourseId,
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

  async assertCourseContentEditable(
    courseId: UUIDType,
    allowedFieldKeys: string[] = [],
    attemptedFieldKeys: string[] = [],
  ): Promise<void> {
    const [course] = await this.db
      .select({
        originType: courses.originType,
      })
      .from(courses)
      .where(eq(courses.id, courseId))
      .limit(1);

    if (!course) throw new NotFoundException("masterCourse.error.courseNotFound");

    if (course.originType !== COURSE_ORIGIN_TYPES.EXPORTED) return;

    const hasExplicitAttemptedFields = attemptedFieldKeys.length > 0;

    const onlyAllowed =
      hasExplicitAttemptedFields &&
      attemptedFieldKeys.every((field) => allowedFieldKeys.includes(field));

    if (!onlyAllowed) throw new ForbiddenException("masterCourse.error.exportedCourseReadonly");
  }

  async assertCourseContentEditableByChapterId(chapterId: UUIDType): Promise<void> {
    const [course] = await this.db
      .select({ courseId: chapters.courseId })
      .from(chapters)
      .where(eq(chapters.id, chapterId))
      .limit(1);

    if (!course) throw new NotFoundException("masterCourse.error.chapterNotFound");
    await this.assertCourseContentEditable(course.courseId);
  }

  async assertCourseContentEditableByLessonId(lessonId: UUIDType): Promise<void> {
    const [course] = await this.db
      .select({ courseId: chapters.courseId })
      .from(lessons)
      .innerJoin(chapters, eq(chapters.id, lessons.chapterId))
      .where(eq(lessons.id, lessonId))
      .limit(1);

    if (!course) throw new NotFoundException("masterCourse.error.lessonNotFound");
    await this.assertCourseContentEditable(course.courseId);
  }

  async queueSyncForSourceCourse(
    sourceCourseId: UUIDType,
    triggerEventType: string,
  ): Promise<void> {
    const [sourceCourse] = await this.db
      .select({ originType: courses.originType })
      .from(courses)
      .where(eq(courses.id, sourceCourseId))
      .limit(1);

    if (!sourceCourse || sourceCourse.originType !== COURSE_ORIGIN_TYPES.MASTER) return;

    const exportLinks =
      await this.masterCourseRepository.getActiveExportLinksBySourceCourse(sourceCourseId);

    for (const exportLink of exportLinks) {
      await this.queueService.enqueueSync({
        exportId: exportLink.id,
        sourceCourseId: exportLink.sourceCourseId,
        sourceTenantId: exportLink.sourceTenantId,
        targetTenantId: exportLink.targetTenantId,
        triggerEventType,
      });
    }
  }

  async processExportJob(data: MasterCourseExportJobData) {
    const exportLink = await this.masterCourseRepository.findExportLinkByPair(
      data.sourceTenantId,
      data.sourceCourseId,
      data.targetTenantId,
    );

    if (!exportLink) throw new NotFoundException("masterCourse.error.exportLinkMissing");

    await this.syncExportLink(exportLink.id);
  }

  async ensureCourseExportSynced(params: {
    sourceCourseId: UUIDType;
    sourceTenantId: UUIDType;
    targetTenantId: UUIDType;
  }): Promise<UUIDType> {
    const sourceCourse = await this.tenantRunner.runWithTenant(params.sourceTenantId, () =>
      this.masterCourseRepository.getCourseById(params.sourceCourseId),
    );

    if (!sourceCourse) {
      throw new NotFoundException("masterCourse.error.sourceCourseNotFound");
    }

    if (sourceCourse.originType === COURSE_ORIGIN_TYPES.EXPORTED) {
      throw new BadRequestException("masterCourse.error.exportedCourseCannotBeSource");
    }

    let exportLink = await this.masterCourseRepository.findExportLinkByPair(
      params.sourceTenantId,
      params.sourceCourseId,
      params.targetTenantId,
    );

    if (!exportLink) {
      exportLink = await this.masterCourseRepository.createExportLink(
        params.sourceTenantId,
        params.sourceCourseId,
        params.targetTenantId,
      );
    }

    await this.tenantRunner.runWithTenant(params.sourceTenantId, () =>
      this.masterCourseRepository.markCourseAsMaster(params.sourceCourseId),
    );

    const targetCourseId = await this.syncExportLink(exportLink.id);

    return targetCourseId;
  }

  async processSyncJob(data: MasterCourseSyncJobData) {
    await this.syncExportLink(data.exportId);
  }

  private async syncExportLink(exportId: UUIDType): Promise<UUIDType> {
    const exportLink = await this.masterCourseRepository.getExportLinkById(exportId);

    try {
      const sourceSnapshot = await this.buildSourceSnapshot(exportLink);
      const targetCourseId = await this.syncSourceSnapshotToTarget(exportLink, sourceSnapshot);

      await this.masterCourseRepository.markExportSyncSuccess(exportId, targetCourseId);
      return targetCourseId;
    } catch (error) {
      await this.masterCourseRepository.markExportSyncFailed(exportId);
      throw error;
    }
  }

  private async buildSourceSnapshot(exportLink: MasterCourseExportRecord): Promise<SourceSnapshot> {
    return this.tenantRunner.runWithTenant(exportLink.sourceTenantId, async () => {
      const sourceCourse = await this.masterCourseRepository.getCourseById(
        exportLink.sourceCourseId,
      );

      if (!sourceCourse) {
        throw new NotFoundException("masterCourse.error.sourceCourseNotFound");
      }

      const sourceSnapshot = await this.masterCourseRepository.getSourceSnapshot(sourceCourse);

      if (!sourceSnapshot) {
        throw new NotFoundException("masterCourse.error.sourceCategoryNotFound");
      }

      return sourceSnapshot;
    });
  }

  private async syncSourceSnapshotToTarget(
    exportLink: MasterCourseExportRecord,
    sourceSnapshot: SourceSnapshot,
  ): Promise<UUIDType> {
    const targetTenantHost = await this.masterCourseRepository.getTenantHost(
      exportLink.targetTenantId,
    );
    const sourceTenantHost = await this.masterCourseRepository.getTenantHost(
      exportLink.sourceTenantId,
    );

    if (!targetTenantHost) throw new NotFoundException("masterCourse.error.targetTenantMissing");
    if (!sourceTenantHost) throw new NotFoundException("masterCourse.error.sourceTenantMissing");

    const resourceCollection = this.buildSourceResourceCollection(sourceSnapshot);
    await this.copySourceResourceReferences(resourceCollection, {
      exportId: exportLink.id,
      sourceTenantId: exportLink.sourceTenantId,
      sourceTenantOrigin: this.toTenantOrigin(sourceTenantHost),
      targetTenantId: exportLink.targetTenantId,
    });

    return this.tenantRunner.runWithTenant(exportLink.targetTenantId, async () => {
      const sourceLanguage = sourceSnapshot.course.baseLanguage;
      const courseSettings = this.normalizeJsonb<CoursesSettings>(sourceSnapshot.course.settings, {
        lessonSequenceEnabled: LESSON_SEQUENCE_ENABLED,
        quizFeedbackEnabled: QUIZ_FEEDBACK_ENABLED,
        certificateSignature: null,
        certificateFontColor: null,
        certificateValidity: null,
      });

      const targetAuthor = await this.masterCourseRepository.findTargetAuthor();

      if (!targetAuthor) throw new BadRequestException("masterCourse.error.targetAuthorMissing");

      const categoryId = await this.syncCategoryFromSource(sourceSnapshot);

      const existingTargetCourse = await this.masterCourseRepository.findCourseByIdInTenant(
        exportLink.targetCourseId,
      );

      let targetCourseId = existingTargetCourse?.id;

      if (!targetCourseId) {
        targetCourseId = await this.createTargetCourseFromSource({
          exportLink,
          sourceSnapshot,
          sourceLanguage,
          courseSettings,
          categoryId,
          targetAuthorId: targetAuthor.id,
          resourceCollection,
        });
      } else {
        await this.updateTargetCourseFromSource({
          targetCourseId,
          sourceSnapshot,
          sourceLanguage,
          courseSettings,
          categoryId,
          sourceTenantId: exportLink.sourceTenantId,
          resourceCollection,
          targetAuthorId: targetAuthor.id,
        });
      }

      if (!targetCourseId) {
        throw new BadRequestException("masterCourse.error.targetCourseMissing");
      }

      const resolvedTargetCourseId = targetCourseId;

      const chapterMap = await this.syncChapters({
        exportId: exportLink.id,
        sourceLanguage,
        sourceSnapshot,
        targetCourseId: resolvedTargetCourseId,
        targetAuthorId: targetAuthor.id,
      });

      const lessonMap = await this.syncLessons({
        exportId: exportLink.id,
        sourceLanguage,
        sourceSnapshot,
        chapterMap,
        resourceCollection,
      });

      const questionMap = await this.syncQuestions({
        exportId: exportLink.id,
        sourceLanguage,
        sourceSnapshot,
        lessonMap,
        targetAuthorId: targetAuthor.id,
        resourceCollection,
      });

      const optionMap = await this.syncOptions({
        exportId: exportLink.id,
        sourceLanguage,
        sourceSnapshot,
        questionMap,
      });

      const aiMentorMap = await this.syncAiMentors(sourceSnapshot, lessonMap, resourceCollection);
      await this.syncAiMentorContexts(sourceSnapshot, aiMentorMap, exportLink.targetTenantId);
      await this.syncScormPackages({
        exportId: exportLink.id,
        sourceSnapshot,
        lessonMap,
        targetCourseId: resolvedTargetCourseId,
        targetTenantId: exportLink.targetTenantId,
      });

      await this.syncResources({
        exportId: exportLink.id,
        lessonMap,
        targetCourseId: resolvedTargetCourseId,
        targetAuthorId: targetAuthor.id,
        resourceCollection,
      });

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
      });

      await this.cleanupMissingMirroredEntities(exportLink.id, sourceSnapshot);

      await this.masterCourseRepository.updateTargetCourseChapterCount(
        resolvedTargetCourseId,
        sourceSnapshot.chapters.length,
      );

      return resolvedTargetCourseId;
    });
  }

  private async createTargetCourseFromSource(params: {
    exportLink: MasterCourseExportRecord;
    sourceSnapshot: SourceSnapshot;
    sourceLanguage: string;
    courseSettings: CoursesSettings;
    categoryId: UUIDType;
    targetAuthorId: UUIDType;
    resourceCollection: MasterCourseResourceCollection;
  }): Promise<UUIDType> {
    const courseSettings = this.applyCopiedCourseSettingsReferences(
      params.courseSettings,
      params.sourceSnapshot.course.id,
      params.resourceCollection,
    );

    const targetCourseId = await this.masterCourseRepository.createTargetCourse({
      title: settingsToJSONBuildObject(
        this.normalizeJsonb<Record<string, unknown>>(params.sourceSnapshot.course.title, {}),
      ),
      description: settingsToJSONBuildObject(
        this.normalizeJsonb<Record<string, unknown>>(params.sourceSnapshot.course.description, {}),
      ),
      thumbnailS3Key: this.getCopiedInternalReference(
        params.resourceCollection,
        "courses",
        ENTITY_TYPES.COURSE,
        params.sourceSnapshot.course.id,
        "thumbnailS3Key",
        params.sourceSnapshot.course.thumbnailS3Key,
      ),
      status: "draft",
      hasCertificate: params.sourceSnapshot.course.hasCertificate,
      priceInCents: 0,
      currency: params.sourceSnapshot.course.currency,
      chapterCount: params.sourceSnapshot.course.chapterCount,
      courseType: params.sourceSnapshot.course.courseType,
      authorId: params.targetAuthorId,
      categoryId: params.categoryId,
      stripeProductId: null,
      stripePriceId: null,
      settings: settingsToJSONBuildObject(courseSettings),
      baseLanguage: params.sourceSnapshot.course.baseLanguage,
      availableLocales: params.sourceSnapshot.course.availableLocales,
      originType: COURSE_ORIGIN_TYPES.EXPORTED,
      sourceCourseId: params.sourceSnapshot.course.id,
      sourceTenantId: params.exportLink.sourceTenantId,
    });

    await this.masterCourseRepository.ensureCourseSummaryStats(
      targetCourseId,
      params.targetAuthorId,
    );

    await this.masterCourseRepository.upsertMap(
      params.exportLink.id,
      MASTER_COURSE_ENTITY_TYPES.COURSE,
      params.sourceSnapshot.course.id,
      targetCourseId,
    );

    return targetCourseId;
  }

  private async syncCategoryFromSource(sourceSnapshot: SourceSnapshot): Promise<UUIDType> {
    const categoryValues = {
      title: this.toJsonbBuildObject(sourceSnapshot.category.title),
      baseLanguage: sourceSnapshot.category.baseLanguage,
      availableLocales: sourceSnapshot.category.availableLocales,
    };

    const existingCategory = await this.masterCourseRepository.findCategoryByBaseTitle(
      sourceSnapshot.categoryBaseTitle,
      sourceSnapshot.category.baseLanguage,
    );

    if (existingCategory) {
      await this.masterCourseRepository.updateCategoryFromSource(
        existingCategory.id,
        categoryValues,
      );

      return existingCategory.id;
    }

    const createdCategory =
      await this.masterCourseRepository.createCategoryFromSource(categoryValues);

    if (createdCategory) return createdCategory.id;

    const conflictingCategory = await this.masterCourseRepository.findCategoryByBaseTitle(
      sourceSnapshot.categoryBaseTitle,
      sourceSnapshot.category.baseLanguage,
    );

    if (!conflictingCategory) {
      throw new BadRequestException("masterCourse.error.targetCategoryMissing");
    }

    await this.masterCourseRepository.updateCategoryFromSource(
      conflictingCategory.id,
      categoryValues,
    );

    return conflictingCategory.id;
  }

  private async updateTargetCourseFromSource(params: {
    targetCourseId: UUIDType;
    sourceSnapshot: SourceSnapshot;
    sourceLanguage: string;
    courseSettings: CoursesSettings;
    categoryId: UUIDType;
    sourceTenantId: UUIDType;
    resourceCollection: MasterCourseResourceCollection;
    targetAuthorId: UUIDType;
  }): Promise<void> {
    const {
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

    await this.masterCourseRepository.updateTargetCourse(params.targetCourseId, {
      title: settingsToJSONBuildObject(
        this.normalizeJsonb<Record<string, unknown>>(course.title, {}),
      ),
      description: settingsToJSONBuildObject(
        this.normalizeJsonb<Record<string, unknown>>(course.description, {}),
      ),
      thumbnailS3Key: this.getCopiedInternalReference(
        params.resourceCollection,
        "courses",
        ENTITY_TYPES.COURSE,
        course.id,
        "thumbnailS3Key",
        course.thumbnailS3Key,
      ),
      status: "draft",
      hasCertificate: course.hasCertificate,
      priceInCents: 0,
      currency: course.currency,
      chapterCount: course.chapterCount,
      courseType: course.courseType,
      authorId: params.targetAuthorId,
      categoryId,
      stripeProductId: null,
      stripePriceId: null,
      settings: settingsToJSONBuildObject(copiedCourseSettings),
      baseLanguage: course.baseLanguage,
      availableLocales: course.availableLocales,
      originType: COURSE_ORIGIN_TYPES.EXPORTED,
      sourceCourseId: course.id,
      sourceTenantId,
    });
  }

  private async syncChapters(params: {
    exportId: UUIDType;
    sourceLanguage: string;
    sourceSnapshot: SourceSnapshot;
    targetCourseId: UUIDType;
    targetAuthorId: UUIDType;
  }) {
    const chapterMap = new Map<UUIDType, UUIDType>();

    for (const sourceChapter of params.sourceSnapshot.chapters) {
      const syncedLessonCount = this.getSyncedLessonCountForChapter(
        params.sourceSnapshot,
        sourceChapter.id,
      );
      const mappedId = await this.resolveOrCreateMappedTargetId(
        params.exportId,
        MASTER_COURSE_ENTITY_TYPES.CHAPTER,
        sourceChapter.id,
        () =>
          this.masterCourseRepository.createTargetChapter({
            title: this.toJsonbBuildObject(sourceChapter.title),
            courseId: params.targetCourseId,
            authorId: params.targetAuthorId,
            isFreemium: sourceChapter.isFreemium,
            displayOrder: sourceChapter.displayOrder,
            lessonCount: syncedLessonCount,
          }),
      );

      await this.masterCourseRepository.updateTargetChapter(mappedId, {
        title: this.toJsonbBuildObject(sourceChapter.title),
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

  private async syncLessons(params: {
    exportId: UUIDType;
    sourceLanguage: string;
    sourceSnapshot: SourceSnapshot;
    chapterMap: Map<UUIDType, UUIDType>;
    resourceCollection: MasterCourseResourceCollection;
  }) {
    const lessonMap = new Map<UUIDType, UUIDType>();

    for (const sourceLesson of params.sourceSnapshot.lessons) {
      if (!this.shouldSyncLesson(sourceLesson)) continue;

      const mappedChapterId = params.chapterMap.get(sourceLesson.chapterId);
      if (!mappedChapterId) continue;

      const mappedId = await this.resolveOrCreateMappedTargetId(
        params.exportId,
        MASTER_COURSE_ENTITY_TYPES.LESSON,
        sourceLesson.id,
        () =>
          this.masterCourseRepository.createTargetLesson({
            chapterId: mappedChapterId,
            type: sourceLesson.type,
            title: this.toJsonbBuildObject(sourceLesson.title),
            description: this.toNullableJsonbBuildObject(sourceLesson.description),
            thresholdScore: sourceLesson.thresholdScore,
            attemptsLimit: sourceLesson.attemptsLimit,
            quizCooldownInHours: sourceLesson.quizCooldownInHours,
            displayOrder: sourceLesson.displayOrder,
            fileS3Key: this.getCopiedInternalReference(
              params.resourceCollection,
              "lessons",
              ENTITY_TYPES.LESSON,
              sourceLesson.id,
              "fileS3Key",
              sourceLesson.fileS3Key,
            ),
            fileType: sourceLesson.fileType,
            isExternal: sourceLesson.isExternal,
          }),
      );

      await this.masterCourseRepository.updateTargetLesson(mappedId, {
        chapterId: mappedChapterId,
        type: sourceLesson.type,
        title: this.toJsonbBuildObject(sourceLesson.title),
        description: this.toNullableJsonbBuildObject(sourceLesson.description),
        thresholdScore: sourceLesson.thresholdScore,
        attemptsLimit: sourceLesson.attemptsLimit,
        quizCooldownInHours: sourceLesson.quizCooldownInHours,
        displayOrder: sourceLesson.displayOrder,
        fileS3Key: this.getCopiedInternalReference(
          params.resourceCollection,
          "lessons",
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

  private shouldSyncLesson(sourceLesson: SourceSnapshot["lessons"][number]) {
    return sourceLesson.type !== LESSON_TYPES.LIVE_TRAINING;
  }

  private getSyncedLessonCountForChapter(
    sourceSnapshot: SourceSnapshot,
    sourceChapterId: UUIDType,
  ) {
    return sourceSnapshot.lessons.filter(
      (sourceLesson) =>
        sourceLesson.chapterId === sourceChapterId && this.shouldSyncLesson(sourceLesson),
    ).length;
  }

  private async syncQuestions(params: {
    exportId: UUIDType;
    sourceLanguage: string;
    sourceSnapshot: SourceSnapshot;
    lessonMap: Map<UUIDType, UUIDType>;
    targetAuthorId: UUIDType;
    resourceCollection: MasterCourseResourceCollection;
  }) {
    const questionMap = new Map<UUIDType, UUIDType>();

    for (const sourceQuestion of params.sourceSnapshot.questions) {
      const mappedLessonId = params.lessonMap.get(sourceQuestion.lessonId);
      if (!mappedLessonId) continue;

      const mappedId = await this.resolveOrCreateMappedTargetId(
        params.exportId,
        MASTER_COURSE_ENTITY_TYPES.QUESTION,
        sourceQuestion.id,
        () =>
          this.masterCourseRepository.createTargetQuestion({
            lessonId: mappedLessonId,
            type: sourceQuestion.type,
            description: this.toNullableJsonbBuildObject(sourceQuestion.description),
            title: this.toJsonbBuildObject(sourceQuestion.title),
            displayOrder: sourceQuestion.displayOrder,
            solutionExplanation: this.toNullableJsonbBuildObject(
              sourceQuestion.solutionExplanation,
            ),
            photoS3Key: this.getCopiedInternalReference(
              params.resourceCollection,
              "questions",
              ENTITY_TYPES.QUESTION,
              sourceQuestion.id,
              "photoS3Key",
              sourceQuestion.photoS3Key,
            ),
            authorId: params.targetAuthorId,
          }),
      );

      await this.masterCourseRepository.updateTargetQuestion(mappedId, {
        lessonId: mappedLessonId,
        type: sourceQuestion.type,
        description: this.toNullableJsonbBuildObject(sourceQuestion.description),
        title: this.toJsonbBuildObject(sourceQuestion.title),
        displayOrder: sourceQuestion.displayOrder,
        solutionExplanation: this.toNullableJsonbBuildObject(sourceQuestion.solutionExplanation),
        photoS3Key: this.getCopiedInternalReference(
          params.resourceCollection,
          "questions",
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

  private async syncOptions(params: {
    exportId: UUIDType;
    sourceLanguage: string;
    sourceSnapshot: SourceSnapshot;
    questionMap: Map<UUIDType, UUIDType>;
  }) {
    const optionMap = new Map<UUIDType, UUIDType>();

    for (const sourceOption of params.sourceSnapshot.options) {
      const mappedQuestionId = params.questionMap.get(sourceOption.questionId);
      if (!mappedQuestionId) continue;

      const mappedId = await this.resolveOrCreateMappedTargetId(
        params.exportId,
        MASTER_COURSE_ENTITY_TYPES.OPTION,
        sourceOption.id,
        () =>
          this.masterCourseRepository.createTargetOption({
            questionId: mappedQuestionId,
            optionText: this.toJsonbBuildObject(sourceOption.optionText),
            isCorrect: sourceOption.isCorrect,
            displayOrder: sourceOption.displayOrder,
            matchedWord: this.toNullableJsonbBuildObject(sourceOption.matchedWord),
            scaleAnswer: sourceOption.scaleAnswer,
          }),
      );

      await this.masterCourseRepository.updateTargetOption(mappedId, {
        questionId: mappedQuestionId,
        optionText: this.toJsonbBuildObject(sourceOption.optionText),
        isCorrect: sourceOption.isCorrect,
        displayOrder: sourceOption.displayOrder,
        matchedWord: this.toNullableJsonbBuildObject(sourceOption.matchedWord),
        scaleAnswer: sourceOption.scaleAnswer,
      });

      optionMap.set(sourceOption.id, mappedId);
    }

    return optionMap;
  }

  private async syncAiMentors(
    sourceSnapshot: SourceSnapshot,
    lessonMap: Map<UUIDType, UUIDType>,
    resourceCollection: MasterCourseResourceCollection,
  ) {
    const aiMentorMap = new Map<UUIDType, UUIDType>();

    for (const sourceAiMentor of sourceSnapshot.aiMentors) {
      const mappedLessonId = lessonMap.get(sourceAiMentor.lessonId);
      if (!mappedLessonId) continue;

      const existingAiMentor =
        await this.masterCourseRepository.findAiMentorByLessonId(mappedLessonId);
      const avatarReference = this.getCopiedInternalReference(
        resourceCollection,
        "lessons",
        ENTITY_TYPES.LESSON,
        sourceAiMentor.lessonId,
        "aiMentorLessons.avatarReference",
        sourceAiMentor.avatarReference,
      );
      const customTtsReference = this.buildCopiedAiMentorCustomTtsReference(
        sourceAiMentor,
        resourceCollection,
      );

      if (!existingAiMentor) {
        const targetAiMentorId = await this.masterCourseRepository.createAiMentor({
          lessonId: mappedLessonId,
          aiMentorInstructions: sourceAiMentor.aiMentorInstructions,
          completionConditions: sourceAiMentor.completionConditions,
          name: sourceAiMentor.name,
          avatarReference,
          type: sourceAiMentor.type,
          voiceMode: sourceAiMentor.voiceMode,
          ttsPreset: sourceAiMentor.ttsPreset,
          customTtsReference,
        });
        aiMentorMap.set(sourceAiMentor.id, targetAiMentorId);
        continue;
      }

      await this.masterCourseRepository.updateAiMentor(existingAiMentor.id, {
        aiMentorInstructions: sourceAiMentor.aiMentorInstructions,
        completionConditions: sourceAiMentor.completionConditions,
        name: sourceAiMentor.name,
        avatarReference,
        type: sourceAiMentor.type,
        voiceMode: sourceAiMentor.voiceMode,
        ttsPreset: sourceAiMentor.ttsPreset,
        customTtsReference,
      });
      aiMentorMap.set(sourceAiMentor.id, existingAiMentor.id);
    }

    return aiMentorMap;
  }

  private async syncAiMentorContexts(
    sourceSnapshot: SourceSnapshot,
    aiMentorMap: Map<UUIDType, UUIDType>,
    targetTenantId: UUIDType,
  ) {
    const targetAiMentorIds = Array.from(aiMentorMap.values());
    await this.masterCourseRepository.removeAiMentorDocumentLinks(targetAiMentorIds);

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
        metadata: this.normalizeJsonb(sourceDocument.metadata, {}),
      };
      const existingDocument = await this.masterCourseRepository.findDocumentByChecksum(checksum);
      const targetDocumentId =
        existingDocument?.id ?? (await this.masterCourseRepository.createDocument(documentValues));

      if (existingDocument) {
        await this.masterCourseRepository.updateDocument(targetDocumentId, documentValues);
      }

      documentMap.set(sourceDocument.id, targetDocumentId);
    }

    await this.masterCourseRepository.removeDocumentChunks(Array.from(documentMap.values()));

    for (const sourceChunk of sourceSnapshot.aiMentorDocChunks) {
      const targetDocumentId = documentMap.get(sourceChunk.documentId);
      if (!targetDocumentId) continue;

      await this.masterCourseRepository.createDocumentChunk({
        documentId: targetDocumentId,
        chunkIndex: sourceChunk.chunkIndex,
        metadata: this.normalizeJsonb(sourceChunk.metadata, {}),
        content: sourceChunk.content,
        embedding: sourceChunk.embedding,
      });
    }

    for (const sourceLink of sourceSnapshot.aiMentorDocumentLinks) {
      const targetDocumentId = documentMap.get(sourceLink.documentId);
      const targetAiMentorLessonId = aiMentorMap.get(sourceLink.aiMentorLessonId);

      if (!targetDocumentId || !targetAiMentorLessonId) continue;
      if (!sourceDocumentsById.has(sourceLink.documentId)) continue;

      await this.masterCourseRepository.createAiMentorDocumentLink({
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

  private buildDeterministicUuid(value: string): UUIDType {
    return uuidv5(value, SCORM_MASTER_COURSE_PACKAGE_UUID_NAMESPACE) as UUIDType;
  }

  private async syncScormPackages(params: {
    exportId: UUIDType;
    sourceSnapshot: SourceSnapshot;
    lessonMap: Map<UUIDType, UUIDType>;
    targetCourseId: UUIDType;
    targetTenantId: UUIDType;
  }) {
    const targetLessonIds = Array.from(params.lessonMap.values());

    if (!params.sourceSnapshot.scormPackages.length) {
      await this.masterCourseRepository.removeScormPackagesForMappedTargets({
        targetCourseId: params.targetCourseId,
        targetLessonIds,
      });
      return;
    }

    const sourceScosByPackageId = groupBy(params.sourceSnapshot.scormScos, (sco) => sco.packageId);
    const targetPackages: Array<{
      sourcePackage: SourceSnapshot["scormPackages"][number];
      targetPackageId: UUIDType;
      targetEntityId: UUIDType;
      targetOriginalFileReference: string;
      targetExtractedFilesReference: string;
    }> = [];

    for (const sourcePackage of params.sourceSnapshot.scormPackages) {
      const targetEntityId = this.getTargetScormPackageEntityId(sourcePackage, {
        lessonMap: params.lessonMap,
        targetCourseId: params.targetCourseId,
      });
      if (!targetEntityId) continue;

      const targetPackageId = this.buildDeterministicUuid(
        `master-course:${params.exportId}:scorm-package:${sourcePackage.id}`,
      );
      const targetOriginalFileReference = getScormOriginalFileReference(
        params.targetTenantId,
        targetPackageId,
        path.posix.basename(sourcePackage.originalFileReference),
      );
      const targetExtractedFilesReference = getScormExtractedFilesReference(
        params.targetTenantId,
        targetPackageId,
      );

      await this.copyScormPackageStorage({
        sourceOriginalFileReference: sourcePackage.originalFileReference,
        targetOriginalFileReference,
        sourceExtractedFilesReference: sourcePackage.extractedFilesReference,
        targetExtractedFilesReference,
      });

      targetPackages.push({
        sourcePackage,
        targetPackageId,
        targetEntityId,
        targetOriginalFileReference,
        targetExtractedFilesReference,
      });
    }

    await this.masterCourseRepository.removeScormPackagesForMappedTargets({
      targetCourseId: params.targetCourseId,
      targetLessonIds,
    });

    for (const targetPackage of targetPackages) {
      const {
        sourcePackage,
        targetPackageId,
        targetEntityId,
        targetOriginalFileReference,
        targetExtractedFilesReference,
      } = targetPackage;

      await this.masterCourseRepository.createScormPackage({
        id: targetPackageId,
        entityType: sourcePackage.entityType,
        entityId: targetEntityId,
        language: sourcePackage.language,
        standard: sourcePackage.standard,
        originalFileReference: targetOriginalFileReference,
        extractedFilesReference: targetExtractedFilesReference,
        manifestEntryPoint: this.rewriteScormStorageReference(
          sourcePackage.manifestEntryPoint,
          sourcePackage.extractedFilesReference,
          targetExtractedFilesReference,
        ),
        manifestJson: this.rewriteScormJsonReferences(
          sourcePackage.manifestJson,
          sourcePackage.extractedFilesReference,
          targetExtractedFilesReference,
        ),
        status: sourcePackage.status,
      });

      for (const sourceSco of sourceScosByPackageId[sourcePackage.id] ?? []) {
        const targetLessonId = params.lessonMap.get(sourceSco.lessonId);
        if (!targetLessonId) continue;

        await this.masterCourseRepository.createScormSco({
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
          launchPath: this.rewriteScormStorageReference(
            sourceSco.launchPath,
            sourcePackage.extractedFilesReference,
            targetExtractedFilesReference,
          ),
          parameters: sourceSco.parameters,
          displayOrder: sourceSco.displayOrder,
          parentIdentifier: sourceSco.parentIdentifier,
          isVisible: sourceSco.isVisible,
          itemMetadataJson: sourceSco.itemMetadataJson,
          resourceMetadataJson: this.rewriteScormJsonReferences(
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
    params: {
      lessonMap: Map<UUIDType, UUIDType>;
      targetCourseId: UUIDType;
    },
  ) {
    if (sourcePackage.entityType === SCORM_PACKAGE_ENTITY_TYPE.COURSE) return params.targetCourseId;
    if (sourcePackage.entityType === SCORM_PACKAGE_ENTITY_TYPE.LESSON) {
      return params.lessonMap.get(sourcePackage.entityId);
    }

    return undefined;
  }

  private async copyScormPackageStorage(params: {
    sourceOriginalFileReference: string;
    targetOriginalFileReference: string;
    sourceExtractedFilesReference: string;
    targetExtractedFilesReference: string;
  }) {
    await this.s3Service.copyFile(
      params.sourceOriginalFileReference,
      params.targetOriginalFileReference,
      "application/zip",
    );

    const sourceExtractedFileReferences = await this.s3Service.listFileKeysByPrefix(
      params.sourceExtractedFilesReference,
    );

    await processInBatches(
      sourceExtractedFileReferences,
      (sourceReference) =>
        this.s3Service.copyFile(
          sourceReference,
          this.rewriteScormStorageReference(
            sourceReference,
            params.sourceExtractedFilesReference,
            params.targetExtractedFilesReference,
          ),
        ),
      { batchSize: SCORM_MASTER_COURSE_COPY_BATCH_SIZE },
    );
  }

  private rewriteScormStorageReference(
    reference: string,
    sourceExtractedFilesReference: string,
    targetExtractedFilesReference: string,
  ) {
    return reference.startsWith(sourceExtractedFilesReference)
      ? `${targetExtractedFilesReference}${reference.slice(sourceExtractedFilesReference.length)}`
      : reference;
  }

  private rewriteScormJsonReferences(
    value: unknown,
    sourceExtractedFilesReference: string,
    targetExtractedFilesReference: string,
  ): unknown {
    if (typeof value === "string") {
      return this.rewriteScormStorageReference(
        value,
        sourceExtractedFilesReference,
        targetExtractedFilesReference,
      );
    }

    if (Array.isArray(value)) {
      return value.map((item) =>
        this.rewriteScormJsonReferences(
          item,
          sourceExtractedFilesReference,
          targetExtractedFilesReference,
        ),
      );
    }

    if (value && typeof value === "object") {
      return Object.fromEntries(
        Object.entries(value).map(([key, item]) => [
          key,
          this.rewriteScormJsonReferences(
            item,
            sourceExtractedFilesReference,
            targetExtractedFilesReference,
          ),
        ]),
      );
    }

    return value;
  }

  private async syncLessonResourceReferences(params: {
    sourceSnapshot: SourceSnapshot;
    lessonMap: Map<UUIDType, UUIDType>;
    resourceCollection: MasterCourseResourceCollection;
    targetTenantHost: string;
  }) {
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

      await this.masterCourseRepository.updateTargetLesson(mappedLessonId, {
        description: this.toNullableJsonbBuildObject(description),
      });
    }
  }

  private async syncFillInTheBlanksQuestionReferences(params: {
    sourceSnapshot: SourceSnapshot;
    questionMap: Map<UUIDType, UUIDType>;
    optionMap: Map<UUIDType, UUIDType>;
  }) {
    if (!params.optionMap.size) return;

    for (const sourceQuestion of params.sourceSnapshot.questions) {
      if (!this.shouldRewriteBlankAnswerReferences(sourceQuestion)) continue;

      const mappedQuestionId = params.questionMap.get(sourceQuestion.id);
      if (!mappedQuestionId) continue;

      const description = this.rewriteLocalizedBlankAnswerIds(
        sourceQuestion.description,
        params.optionMap,
      );

      await this.masterCourseRepository.updateTargetQuestion(mappedQuestionId, {
        description: this.toNullableJsonbBuildObject(description),
      });
    }
  }

  private getLessonResourceIdMap(
    sourceLessonId: UUIDType,
    resourceCollection: MasterCourseResourceCollection,
  ) {
    const resourceIdMap = new Map<string, string>();

    for (const resourceReference of Object.values(resourceCollection.lessons.external)) {
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
    return this.mapLocalizedTextEntries(value, (content) =>
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

  private rewriteLocalizedBlankAnswerIds(value: unknown, optionMap: Map<UUIDType, UUIDType>) {
    return this.mapLocalizedTextEntries(value, (content) =>
      this.rewriteBlankAnswerIds(content, optionMap),
    );
  }

  private rewriteBlankAnswerIds(content: string, optionMap: Map<UUIDType, UUIDType>) {
    const $ = loadHtml(content, null, false);

    $("blank-answer-id").each((_, element) => {
      const sourceOptionId = $(element).text().trim();
      const targetOptionId = optionMap.get(sourceOptionId);

      if (targetOptionId) $(element).text(targetOptionId);
    });

    $("*").each((_, element) => {
      const tagName = (element as { tagName?: string }).tagName;
      const sourceOptionId = tagName?.match(/^blank-answer-([0-9a-f-]{36})$/i)?.[1];
      if (!sourceOptionId) return;

      const targetOptionId = optionMap.get(sourceOptionId);
      if (!targetOptionId) return;

      const innerHtml = $(element).html() ?? "";
      $(element).replaceWith(
        `<blank-answer-${targetOptionId}>${innerHtml}</blank-answer-${targetOptionId}>`,
      );
    });

    return $.html();
  }

  private mapLocalizedTextEntries(value: unknown, mapEntry: (content: string) => string) {
    const localizedValue =
      typeof value === "string" ? (this.tryParseJsonString(value) ?? value) : value;

    if (!localizedValue || typeof localizedValue !== "object" || Array.isArray(localizedValue)) {
      return value;
    }

    return Object.fromEntries(
      Object.entries(localizedValue as Record<string, unknown>).map(([language, content]) => [
        language,
        typeof content === "string" ? mapEntry(content) : content,
      ]),
    );
  }

  private toJsonbBuildObject(value: unknown) {
    return settingsToJSONBuildObject(this.normalizeJsonb<Record<string, unknown>>(value, {}));
  }

  private toNullableJsonbBuildObject(value: unknown) {
    if (value === null || value === undefined) return null;

    return this.toJsonbBuildObject(value);
  }

  private buildSourceResourceCollection(
    sourceSnapshot: SourceSnapshot,
  ): MasterCourseResourceCollection {
    const collection: MasterCourseResourceCollection = {
      courses: { external: {}, internal: {} },
      chapters: { external: {}, internal: {} },
      lessons: { external: {}, internal: {} },
      questions: { external: {}, internal: {} },
    };

    this.addInternalResourceReference(collection, {
      group: "courses",
      sourceEntityType: ENTITY_TYPES.COURSE,
      sourceEntityId: sourceSnapshot.course.id,
      fieldPath: "thumbnailS3Key",
      reference: sourceSnapshot.course.thumbnailS3Key,
    });

    const courseSettings = this.normalizeJsonb<CoursesSettings>(sourceSnapshot.course.settings, {
      lessonSequenceEnabled: LESSON_SEQUENCE_ENABLED,
      quizFeedbackEnabled: QUIZ_FEEDBACK_ENABLED,
      certificateSignature: null,
      certificateFontColor: null,
      certificateValidity: null,
    });

    this.addInternalResourceReference(collection, {
      group: "courses",
      sourceEntityType: ENTITY_TYPES.COURSE,
      sourceEntityId: sourceSnapshot.course.id,
      fieldPath: "settings.certificateSignature",
      reference: courseSettings.certificateSignature,
    });

    for (const { resource, relation } of sourceSnapshot.courseResources) {
      this.addExternalResourceReference(collection, {
        group: "courses",
        sourceEntityType: ENTITY_TYPES.COURSE,
        sourceEntityId: relation.entityId,
        relationshipType: relation.relationshipType,
        resource,
        relation,
      });
    }

    const syncedLessonIds = new Set(
      sourceSnapshot.lessons
        .filter((sourceLesson) => this.shouldSyncLesson(sourceLesson))
        .map((sourceLesson) => sourceLesson.id),
    );

    for (const sourceLesson of sourceSnapshot.lessons) {
      if (!syncedLessonIds.has(sourceLesson.id)) continue;

      this.addInternalResourceReference(collection, {
        group: "lessons",
        sourceEntityType: ENTITY_TYPES.LESSON,
        sourceEntityId: sourceLesson.id,
        fieldPath: "fileS3Key",
        reference: sourceLesson.fileS3Key,
        ...this.getLessonFileReferenceMetadata(sourceLesson),
      });
    }

    for (const { resource, relation } of sourceSnapshot.lessonResources) {
      if (!syncedLessonIds.has(relation.entityId)) continue;

      this.addExternalResourceReference(collection, {
        group: "lessons",
        sourceEntityType: ENTITY_TYPES.LESSON,
        sourceEntityId: relation.entityId,
        relationshipType: relation.relationshipType,
        resource,
        relation,
      });
    }

    const lessonContentResourceById = new Map(
      sourceSnapshot.lessonContentResources.map((resource) => [resource.id, resource]),
    );

    for (const sourceLesson of sourceSnapshot.lessons) {
      if (!syncedLessonIds.has(sourceLesson.id)) continue;

      for (const resourceId of this.extractLocalizedRichTextResourceIds(sourceLesson.description)) {
        const resource = lessonContentResourceById.get(resourceId);
        if (!resource) continue;

        this.addExternalResourceReference(collection, {
          group: "lessons",
          sourceEntityType: ENTITY_TYPES.LESSON,
          sourceEntityId: sourceLesson.id,
          relationshipType: RESOURCE_RELATIONSHIP_TYPES.ATTACHMENT,
          resource,
        });
      }
    }

    for (const sourceAiMentor of sourceSnapshot.aiMentors) {
      if (!syncedLessonIds.has(sourceAiMentor.lessonId)) continue;

      this.addInternalResourceReference(collection, {
        group: "lessons",
        sourceEntityType: ENTITY_TYPES.LESSON,
        sourceEntityId: sourceAiMentor.lessonId,
        fieldPath: "aiMentorLessons.avatarReference",
        reference: sourceAiMentor.avatarReference,
      });

      const customTtsReference = this.normalizeJsonb<Record<string, unknown>>(
        sourceAiMentor.customTtsReference,
        {},
      );

      for (const [language, reference] of Object.entries(customTtsReference)) {
        this.addInternalResourceReference(collection, {
          group: "lessons",
          sourceEntityType: ENTITY_TYPES.LESSON,
          sourceEntityId: sourceAiMentor.lessonId,
          fieldPath: `aiMentorLessons.customTtsReference.${language}`,
          reference,
        });
      }
    }

    for (const sourceQuestion of sourceSnapshot.questions) {
      this.addInternalResourceReference(collection, {
        group: "questions",
        sourceEntityType: ENTITY_TYPES.QUESTION,
        sourceEntityId: sourceQuestion.id,
        fieldPath: "photoS3Key",
        reference: sourceQuestion.photoS3Key,
      });
    }

    return collection;
  }

  private addExternalResourceReference(
    collection: MasterCourseResourceCollection,
    params: {
      group: MasterCourseResourceGroupKey;
      sourceEntityType: typeof ENTITY_TYPES.COURSE | typeof ENTITY_TYPES.LESSON;
      sourceEntityId: UUIDType;
      relationshipType: string;
      resource: SourceSnapshot["courseResources"][number]["resource"];
      relation?: SourceSnapshot["courseResources"][number]["relation"];
    },
  ) {
    const sourceReference = this.normalizeResourceReference(params.resource.reference);
    if (!sourceReference) return;

    const relationKey = [
      params.sourceEntityType,
      params.sourceEntityId,
      params.relationshipType,
      params.resource.id,
    ].join(":");

    collection[params.group].external[relationKey] = {
      kind: MASTER_COURSE_RESOURCE_REFERENCE_KIND.EXTERNAL,
      group: params.group,
      source: {
        entityType: params.sourceEntityType,
        entityId: params.sourceEntityId,
        reference: sourceReference,
        contentType: params.resource.contentType,
        filename: this.getResourceOriginalFilename(params.resource),
        isVideo: this.isVideoResource(params.resource.reference, params.resource.contentType),
        resourceId: params.resource.id,
        relationshipType: params.relationshipType,
        resource: params.resource,
        relation: params.relation,
      },
      target: {
        entityId: null,
        reference: null,
        resourceId: null,
        relationshipType: params.relationshipType,
      },
    };
  }

  private extractLocalizedRichTextResourceIds(value: unknown) {
    return [
      ...new Set(
        getLocalizedRichTextEntries(value).flatMap(([, content]) =>
          extractResourceIdsFromRichText(content),
        ),
      ),
    ];
  }

  private addInternalResourceReference(
    collection: MasterCourseResourceCollection,
    params: {
      group: MasterCourseResourceGroupKey;
      sourceEntityType:
        | typeof ENTITY_TYPES.COURSE
        | typeof ENTITY_TYPES.LESSON
        | typeof ENTITY_TYPES.QUESTION;
      sourceEntityId: UUIDType;
      fieldPath: string;
      reference: unknown;
      contentType?: string | null;
      filename?: string | null;
      isVideo?: boolean;
    },
  ) {
    const sourceReference = this.normalizeResourceReference(params.reference);
    if (!sourceReference) return;

    const fieldKey = this.buildInternalResourceFieldKey(
      params.sourceEntityType,
      params.sourceEntityId,
      params.fieldPath,
    );

    collection[params.group].internal[fieldKey] = {
      kind: MASTER_COURSE_RESOURCE_REFERENCE_KIND.INTERNAL,
      group: params.group,
      source: {
        entityType: params.sourceEntityType,
        entityId: params.sourceEntityId,
        reference: sourceReference,
        contentType: params.contentType,
        filename: params.filename,
        isVideo: params.isVideo,
        fieldPath: params.fieldPath,
      },
      target: {
        entityId: null,
        reference: null,
      },
    };
  }

  private normalizeResourceReference(reference: unknown): string | null {
    if (typeof reference !== "string") return null;

    const trimmedReference = reference.trim();
    return trimmedReference.length ? trimmedReference : null;
  }

  private getLessonFileReferenceMetadata(sourceLesson: SourceSnapshot["lessons"][number]) {
    const contentType = this.getLessonFileContentType(sourceLesson);

    return {
      contentType,
      filename: this.getReferenceFilename(sourceLesson.fileS3Key),
      isVideo: this.isVideoResource(sourceLesson.fileS3Key, contentType),
    };
  }

  private getLessonFileContentType(sourceLesson: SourceSnapshot["lessons"][number]) {
    if (sourceLesson.fileS3Key?.startsWith("bunny-")) return "video/mp4";
    if (sourceLesson.fileType?.startsWith("video/")) return sourceLesson.fileType;

    return (
      this.getVideoContentTypeFromExtension(sourceLesson.fileType) ??
      this.getVideoContentTypeFromExtension(sourceLesson.fileS3Key)
    );
  }

  private getVideoContentTypeFromExtension(value: string | null | undefined) {
    if (!value) return undefined;

    const normalizedExtension = value.includes(".")
      ? path.extname(value).replace(".", "").toLowerCase()
      : value.replace(".", "").toLowerCase();

    const contentTypeByExtension: Record<string, string> = {
      mp4: "video/mp4",
      mov: "video/quicktime",
      webm: "video/webm",
      ogg: "video/ogg",
      avi: "video/avi",
      wmv: "video/wmv",
    };

    return contentTypeByExtension[normalizedExtension];
  }

  private isVideoResource(reference: string | null | undefined, contentType?: string | null) {
    return (
      Boolean(reference?.startsWith("bunny-")) ||
      Boolean(contentType?.startsWith("video/")) ||
      Boolean(this.getVideoContentTypeFromExtension(reference))
    );
  }

  private getResourceOriginalFilename(
    resource: SourceSnapshot["courseResources"][number]["resource"],
  ) {
    const metadata = this.normalizeJsonb<Record<string, unknown>>(resource.metadata, {});
    const originalFilename = metadata.originalFilename;

    return typeof originalFilename === "string"
      ? originalFilename
      : this.getReferenceFilename(resource.reference);
  }

  private getReferenceFilename(reference: string | null | undefined) {
    if (!reference) return null;
    if (reference.startsWith("bunny-")) return `${reference.replace("bunny-", "")}.mp4`;

    return path.basename(reference.split("?")[0] ?? reference) || null;
  }

  private async copySourceResourceReferences(
    collection: MasterCourseResourceCollection,
    params: {
      exportId: UUIDType;
      sourceTenantId: UUIDType;
      sourceTenantOrigin: string;
      targetTenantId: UUIDType;
    },
  ) {
    const copiedReferences = new Map<string, string>();
    const targetBunnyConfigured = await this.tenantRunner.runWithTenant(params.targetTenantId, () =>
      this.bunnyStreamService.isConfigured(),
    );
    const sourceAndTargetShareBunnyMediaConfiguration = targetBunnyConfigured
      ? await this.sourceAndTargetShareBunnyMediaConfiguration(
          params.sourceTenantId,
          params.targetTenantId,
        )
      : false;

    for (const resourceReference of this.getAllResourceReferences(collection)) {
      const targetReference = await this.resolveTargetResourceReference(resourceReference.source, {
        exportId: params.exportId,
        sourceTenantId: params.sourceTenantId,
        sourceTenantOrigin: params.sourceTenantOrigin,
        targetTenantId: params.targetTenantId,
        targetBunnyConfigured,
        sourceAndTargetShareBunnyMediaConfiguration,
        copiedReferences,
      });

      resourceReference.target.reference = targetReference;
    }
  }

  private async resolveTargetResourceReference(
    source: MasterCourseCopySourceReference,
    params: {
      exportId: UUIDType;
      sourceTenantId: UUIDType;
      sourceTenantOrigin: string;
      targetTenantId: UUIDType;
      targetBunnyConfigured: boolean;
      sourceAndTargetShareBunnyMediaConfiguration: boolean;
      copiedReferences: Map<string, string>;
    },
  ) {
    const existingTargetReference = params.copiedReferences.get(source.reference);
    if (existingTargetReference) return existingTargetReference;

    if (this.isVideoReference(source)) {
      const targetReference = await this.copyVideoReference(source, params);
      params.copiedReferences.set(source.reference, targetReference);
      return targetReference;
    }

    if (!this.isCopyableS3Reference(source.reference)) return source.reference;

    const targetReference = this.buildCopiedResourceReference(source.reference, {
      exportId: params.exportId,
      targetTenantId: params.targetTenantId,
    });

    if (await this.s3Service.getFileExists(targetReference)) {
      params.copiedReferences.set(source.reference, targetReference);
      return targetReference;
    }

    if (!(await this.s3Service.getFileExists(source.reference))) {
      return source.reference;
    }

    await this.s3Service.copyFile(
      source.reference,
      targetReference,
      source.contentType ?? undefined,
    );
    params.copiedReferences.set(source.reference, targetReference);

    return targetReference;
  }

  private async copyVideoReference(
    source: MasterCourseCopySourceReference,
    params: {
      exportId: UUIDType;
      sourceTenantId: UUIDType;
      sourceTenantOrigin: string;
      targetTenantId: UUIDType;
      targetBunnyConfigured: boolean;
      sourceAndTargetShareBunnyMediaConfiguration: boolean;
    },
  ) {
    if (source.reference.startsWith("http://") || source.reference.startsWith("https://")) {
      return source.reference;
    }

    if (
      params.targetBunnyConfigured &&
      params.sourceAndTargetShareBunnyMediaConfiguration &&
      source.reference.startsWith("bunny-")
    ) {
      return source.reference;
    }

    if (params.targetBunnyConfigured) {
      const sourceVideo = await this.openSourceVideoStream(
        source,
        params.sourceTenantId,
        params.sourceTenantOrigin,
      );
      const uploaded = await this.tenantRunner
        .runWithTenant(params.targetTenantId, () =>
          this.bunnyStreamService.uploadStream({
            title: source.filename ?? "Master course video",
            stream: sourceVideo.stream,
            contentType: sourceVideo.contentType,
          }),
        )
        .catch((error) => {
          sourceVideo.stream.destroy(error instanceof Error ? error : undefined);
          throw error;
        });

      return uploaded.fileKey;
    }

    if (!this.s3Service.isConfigured()) {
      throw new BadRequestException("masterCourse.error.videoStorageNotConfigured");
    }

    if (this.isCopyableS3Reference(source.reference)) {
      const targetReference = this.buildCopiedResourceReference(source.reference, {
        exportId: params.exportId,
        targetTenantId: params.targetTenantId,
      });

      if (await this.s3Service.getFileExists(targetReference)) return targetReference;

      if (!(await this.s3Service.getFileExists(source.reference))) {
        throw new BadRequestException("masterCourse.error.sourceVideoMissing");
      }

      await this.s3Service.copyFile(
        source.reference,
        targetReference,
        source.contentType ?? "video/mp4",
      );
      return targetReference;
    }

    const sourceVideo = await this.openSourceVideoStream(
      source,
      params.sourceTenantId,
      params.sourceTenantOrigin,
    );
    const targetReference = this.buildCopiedResourceReference(source.reference, {
      exportId: params.exportId,
      targetTenantId: params.targetTenantId,
      fallbackExtension: ".mp4",
    });

    if (await this.s3Service.getFileExists(targetReference)) return targetReference;

    await this.s3Service.uploadStreamMultipart(
      sourceVideo.stream,
      targetReference,
      sourceVideo.contentType ?? "video/mp4",
    );

    return targetReference;
  }

  private async openSourceVideoStream(
    source: MasterCourseCopySourceReference,
    sourceTenantId: UUIDType,
    sourceTenantOrigin: string,
  ): Promise<{ stream: Readable; contentType: string; filename: string }> {
    if (source.reference.startsWith("bunny-")) {
      const videoId = source.reference.replace("bunny-", "");
      return this.tenantRunner.runWithTenant(sourceTenantId, async () => {
        const video = await this.bunnyStreamService.downloadMp4Fallback(
          videoId,
          720,
          sourceTenantOrigin,
        );

        return {
          stream: video.stream,
          contentType: video.contentType,
          filename: source.filename ?? video.filename,
        };
      });
    }

    const file = await this.s3Service.getFileStream(source.reference);

    return {
      stream: file.stream,
      contentType: source.contentType ?? file.contentType ?? "video/mp4",
      filename: source.filename ?? this.getReferenceFilename(source.reference) ?? "video.mp4",
    };
  }

  private async sourceAndTargetShareBunnyMediaConfiguration(
    sourceTenantId: UUIDType,
    targetTenantId: UUIDType,
  ) {
    try {
      const [sourceSignature, targetSignature] = await Promise.all([
        this.tenantRunner.runWithTenant(sourceTenantId, () =>
          this.bunnyStreamService.getMediaConfigurationSignature(),
        ),
        this.tenantRunner.runWithTenant(targetTenantId, () =>
          this.bunnyStreamService.getMediaConfigurationSignature(),
        ),
      ]);

      return sourceSignature === targetSignature;
    } catch {
      return false;
    }
  }

  private toTenantOrigin(host: string) {
    const normalizedHost = host.trim().replace(/\/+$/, "");
    return /^https?:\/\//i.test(normalizedHost) ? normalizedHost : `https://${normalizedHost}`;
  }

  private isVideoReference(source: MasterCourseCopySourceReference) {
    return Boolean(source.isVideo) || this.isVideoResource(source.reference, source.contentType);
  }

  private isCopyableS3Reference(reference: string) {
    return (
      !reference.startsWith("http://") &&
      !reference.startsWith("https://") &&
      !reference.startsWith("bunny-")
    );
  }

  private buildCopiedResourceReference(
    sourceReference: string,
    params: {
      exportId: UUIDType;
      targetTenantId: UUIDType;
      fallbackExtension?: string;
    },
  ) {
    const extension =
      path.extname(sourceReference.split("?")[0] ?? "") || params.fallbackExtension || "";
    const sourceHash = createHash("sha256").update(sourceReference).digest("hex").slice(0, 32);

    return prefixTenantStorageKey(
      `master-course/${params.exportId}/${sourceHash}${extension}`,
      params.targetTenantId,
    );
  }

  private getAllResourceReferences(collection: MasterCourseResourceCollection) {
    return Object.values(collection).flatMap((group) => [
      ...Object.values(group.external),
      ...Object.values(group.internal),
    ]);
  }

  private getExternalResourceReferences(collection: MasterCourseResourceCollection) {
    return Object.values(collection).flatMap((group) => Object.values(group.external));
  }

  private getCopiedInternalReference(
    collection: MasterCourseResourceCollection,
    group: MasterCourseResourceGroupKey,
    sourceEntityType:
      | typeof ENTITY_TYPES.COURSE
      | typeof ENTITY_TYPES.LESSON
      | typeof ENTITY_TYPES.QUESTION,
    sourceEntityId: UUIDType,
    fieldPath: string,
    fallback: string | null,
  ) {
    const fieldKey = this.buildInternalResourceFieldKey(
      sourceEntityType,
      sourceEntityId,
      fieldPath,
    );
    const targetReference = collection[group].internal[fieldKey]?.target.reference;

    return targetReference ?? fallback;
  }

  private applyCopiedCourseSettingsReferences(
    courseSettings: CoursesSettings,
    sourceCourseId: UUIDType,
    resourceCollection: MasterCourseResourceCollection,
  ): CoursesSettings {
    return {
      ...courseSettings,
      certificateSignature: this.getCopiedInternalReference(
        resourceCollection,
        "courses",
        ENTITY_TYPES.COURSE,
        sourceCourseId,
        "settings.certificateSignature",
        courseSettings.certificateSignature,
      ),
    };
  }

  private buildCopiedAiMentorCustomTtsReference(
    sourceAiMentor: SourceSnapshot["aiMentors"][number],
    resourceCollection: MasterCourseResourceCollection,
  ) {
    const customTtsReference = this.normalizeJsonb<Record<string, unknown>>(
      sourceAiMentor.customTtsReference,
      {},
    );
    const copiedCustomTtsReference = Object.fromEntries(
      Object.entries(customTtsReference).map(([language, reference]) => [
        language,
        this.getCopiedInternalReference(
          resourceCollection,
          "lessons",
          ENTITY_TYPES.LESSON,
          sourceAiMentor.lessonId,
          `aiMentorLessons.customTtsReference.${language}`,
          typeof reference === "string" ? reference : null,
        ),
      ]),
    );

    return Object.keys(copiedCustomTtsReference).length ? copiedCustomTtsReference : null;
  }

  private getTargetResourceEntityId(
    resourceReference: MasterCourseExternalResourceReference,
    params: {
      lessonMap: Map<UUIDType, UUIDType>;
      targetCourseId: UUIDType;
    },
  ) {
    if (resourceReference.source.entityType === ENTITY_TYPES.COURSE) return params.targetCourseId;
    if (resourceReference.source.entityType === ENTITY_TYPES.LESSON) {
      return params.lessonMap.get(resourceReference.source.entityId);
    }

    return undefined;
  }

  private buildInternalResourceFieldKey(
    sourceEntityType:
      | typeof ENTITY_TYPES.COURSE
      | typeof ENTITY_TYPES.LESSON
      | typeof ENTITY_TYPES.QUESTION,
    sourceEntityId: UUIDType,
    fieldPath: string,
  ) {
    return [sourceEntityType, sourceEntityId, fieldPath].join(":");
  }

  private async syncResources(params: {
    exportId: UUIDType;
    lessonMap: Map<UUIDType, UUIDType>;
    targetCourseId: UUIDType;
    targetAuthorId: UUIDType;
    resourceCollection: MasterCourseResourceCollection;
  }) {
    const targetLessonIds = Array.from(params.lessonMap.values());

    await this.masterCourseRepository.removeLessonResourceRelations(targetLessonIds);
    await this.masterCourseRepository.removeCourseResourceRelations(params.targetCourseId);

    const externalReferences = this.getExternalResourceReferences(params.resourceCollection);
    const resourceBySourceId = new Map<UUIDType, MasterCourseExternalResourceReference>();

    for (const resourceReference of externalReferences) {
      if (!resourceBySourceId.has(resourceReference.source.resourceId)) {
        resourceBySourceId.set(resourceReference.source.resourceId, resourceReference);
      }
    }

    await this.cleanupMissingResourceMappings(
      params.exportId,
      Array.from(resourceBySourceId.keys()),
    );

    const targetResourceIds = new Map<UUIDType, UUIDType>();

    for (const [sourceResourceId, resourceReference] of resourceBySourceId) {
      const sourceResource = resourceReference.source.resource;
      const resourceValues = {
        title: settingsToJSONBuildObject(
          this.normalizeJsonb<Record<string, unknown>>(sourceResource.title, {}),
        ),
        description: settingsToJSONBuildObject(
          this.normalizeJsonb<Record<string, unknown>>(sourceResource.description, {}),
        ),
        reference: resourceReference.target.reference ?? resourceReference.source.reference,
        contentType: sourceResource.contentType,
        metadata: this.normalizeJsonb(sourceResource.metadata, {}),
        uploadedBy: params.targetAuthorId,
        archived: false,
      };

      const existingTargetResourceId = await this.masterCourseRepository.getMappedTargetEntityId(
        params.exportId,
        MASTER_COURSE_ENTITY_TYPES.RESOURCE,
        sourceResourceId,
      );
      const targetResourceId =
        existingTargetResourceId ??
        (await this.masterCourseRepository.createResource(resourceValues));

      if (existingTargetResourceId) {
        await this.masterCourseRepository.updateResource(targetResourceId, resourceValues);
      } else {
        await this.masterCourseRepository.upsertMap(
          params.exportId,
          MASTER_COURSE_ENTITY_TYPES.RESOURCE,
          sourceResourceId,
          targetResourceId,
        );
      }

      targetResourceIds.set(sourceResourceId, targetResourceId);
    }

    for (const resourceReference of externalReferences) {
      const targetResourceId = targetResourceIds.get(resourceReference.source.resourceId);
      const targetEntityId = this.getTargetResourceEntityId(resourceReference, {
        lessonMap: params.lessonMap,
        targetCourseId: params.targetCourseId,
      });

      if (!targetResourceId || !targetEntityId) continue;

      resourceReference.target.resourceId = targetResourceId;
      resourceReference.target.entityId = targetEntityId;

      await this.masterCourseRepository.createResourceRelation({
        resourceId: targetResourceId,
        entityId: targetEntityId,
        entityType: resourceReference.source.entityType,
        relationshipType:
          resourceReference.source.relationshipType || RESOURCE_RELATIONSHIP_TYPES.TRAILER,
      });
    }
  }

  private async cleanupMissingResourceMappings(exportId: UUIDType, sourceResourceIds: UUIDType[]) {
    const mappings = await this.masterCourseRepository.getMappings(
      exportId,
      MASTER_COURSE_ENTITY_TYPES.RESOURCE,
    );

    const toDelete = mappings.filter(
      (mapping) => !sourceResourceIds.includes(mapping.sourceEntityId),
    );
    if (!toDelete.length) return;

    await this.masterCourseRepository.deleteResourcesByIds(
      toDelete.map((mapping) => mapping.targetEntityId),
    );
    await this.masterCourseRepository.deleteMappingsByIds(toDelete.map((mapping) => mapping.id));
  }

  private async cleanupMissingMirroredEntities(exportId: UUIDType, sourceSnapshot: SourceSnapshot) {
    await this.cleanupMissingMappings(
      exportId,
      MASTER_COURSE_ENTITY_TYPES.CHAPTER,
      sourceSnapshot.chapters.map((item) => item.id),
      chapters,
    );
    await this.cleanupMissingMappings(
      exportId,
      MASTER_COURSE_ENTITY_TYPES.LESSON,
      sourceSnapshot.lessons.filter((item) => this.shouldSyncLesson(item)).map((item) => item.id),
      lessons,
    );
    await this.cleanupMissingMappings(
      exportId,
      MASTER_COURSE_ENTITY_TYPES.QUESTION,
      sourceSnapshot.questions.map((item) => item.id),
      questions,
    );
    await this.cleanupMissingMappings(
      exportId,
      MASTER_COURSE_ENTITY_TYPES.OPTION,
      sourceSnapshot.options.map((item) => item.id),
      questionAnswerOptions,
    );
  }

  private async cleanupMissingMappings(
    exportId: UUIDType,
    entityType: MasterCourseEntityType,
    sourceIds: UUIDType[],
    targetTable: typeof chapters | typeof lessons | typeof questions | typeof questionAnswerOptions,
  ) {
    const mappings = await this.masterCourseRepository.getMappings(exportId, entityType);

    const toDelete = mappings.filter((mapping) => !sourceIds.includes(mapping.sourceEntityId));
    if (!toDelete.length) return;

    const targetIds = toDelete.map((item) => item.targetEntityId);
    await this.masterCourseRepository.deleteMappedEntities(targetTable, targetIds);
    await this.masterCourseRepository.deleteMappingsByIds(toDelete.map((item) => item.id));
  }

  private async resolveOrCreateMappedTargetId(
    exportId: UUIDType,
    entityType: MasterCourseEntityType,
    sourceEntityId: UUIDType,
    create: () => Promise<UUIDType>,
  ): Promise<UUIDType> {
    const existingTargetEntityId = await this.masterCourseRepository.getMappedTargetEntityId(
      exportId,
      entityType,
      sourceEntityId,
    );

    if (existingTargetEntityId) return existingTargetEntityId;

    const targetEntityId = await create();
    await this.masterCourseRepository.upsertMap(
      exportId,
      entityType,
      sourceEntityId,
      targetEntityId,
    );
    return targetEntityId;
  }

  private getUniqueTargetTenantIds(
    targetTenantIds: UUIDType[],
    sourceTenantId: UUIDType,
  ): UUIDType[] {
    return Array.from(new Set(targetTenantIds)).filter((tenantId) => tenantId !== sourceTenantId);
  }

  private async createOrQueueExportForTarget(params: {
    sourceCourseId: UUIDType;
    sourceTenantId: UUIDType;
    targetTenantId: UUIDType;
    actorId: UUIDType;
  }) {
    const existingExport = await this.masterCourseRepository.findExportLinkByPair(
      params.sourceTenantId,
      params.sourceCourseId,
      params.targetTenantId,
    );

    if (existingExport) {
      return {
        targetTenantId: params.targetTenantId,
        queued: false,
        reason: "already-linked",
        exportId: existingExport.id,
      };
    }

    const createdExport = await this.masterCourseRepository.createExportLink(
      params.sourceTenantId,
      params.sourceCourseId,
      params.targetTenantId,
    );

    const job = await this.queueService.enqueueExport({
      sourceCourseId: params.sourceCourseId,
      sourceTenantId: params.sourceTenantId,
      targetTenantId: params.targetTenantId,
      actorId: params.actorId,
    });

    return {
      targetTenantId: params.targetTenantId,
      queued: true,
      exportId: createdExport.id,
      reason: String(job.id),
    };
  }

  private async assertManagingTenantAdmin(actor: CurrentUserType) {
    if (!hasPermission(actor.permissions, PERMISSIONS.TENANT_MANAGE))
      throw new ForbiddenException("auth.error.adminRoleRequired");

    const tenant = await this.masterCourseRepository.getTenantManagingStatus(actor.tenantId);

    if (!tenant?.isManaging)
      throw new ForbiddenException("superAdminTenants.error.managingTenantRequired");
  }

  private normalizeJsonb<T>(value: unknown, fallback: T): T {
    if (value === null || value === undefined) return fallback;

    if (typeof value === "string") {
      const parsed = this.tryParseJsonString(value);
      return parsed === undefined ? fallback : (parsed as T);
    }

    return value as T;
  }

  private getLocalizedText(value: unknown, language: string): string | null | undefined {
    if (value === undefined) return undefined;
    if (value === null) return null;

    const normalizedValue =
      typeof value === "string" ? (this.tryParseJsonString(value) ?? value) : value;

    if (typeof normalizedValue === "string") return normalizedValue;
    if (typeof normalizedValue === "object") {
      return this.extractLocalizedFromRecord(normalizedValue as Record<string, unknown>, language);
    }

    return String(normalizedValue);
  }

  private tryParseJsonString(value: string): unknown | undefined {
    try {
      return JSON.parse(value) as unknown;
    } catch {
      return undefined;
    }
  }

  private extractLocalizedFromRecord(
    record: Record<string, unknown>,
    language: string,
  ): string | null {
    const byLanguage = record[language];
    if (typeof byLanguage === "string") return byLanguage;

    const firstText = Object.values(record).find(
      (item): item is string => typeof item === "string",
    );

    return firstText ?? null;
  }
}
