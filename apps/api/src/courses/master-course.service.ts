import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  COURSE_ORIGIN_TYPES,
  ENTITY_TYPES,
  MASTER_COURSE_ENTITY_TYPES,
  type MasterCourseEntityType,
} from "@repo/shared";
import { eq } from "drizzle-orm";

import { DatabasePg } from "src/common";
import { buildJsonbField, setJsonbField } from "src/common/helpers/sqlHelpers";
import { LESSON_SEQUENCE_ENABLED, QUIZ_FEEDBACK_ENABLED } from "src/courses/constants";
import { MasterCourseQueueService } from "src/courses/master-course.queue.service";
import { MasterCourseRepository } from "src/courses/master-course.repository";
import { RESOURCE_RELATIONSHIP_TYPES } from "src/file/file.constants";
import { PERMISSIONS } from "src/permission/permission.constants";
import { DB } from "src/storage/db/db.providers";
import { TenantDbRunnerService } from "src/storage/db/tenant-db-runner.service";
import { chapters, courses, lessons, questionAnswerOptions, questions } from "src/storage/schema";

import type { UUIDType } from "src/common";
import type { CurrentUser } from "src/common/types/current-user.type";
import type {
  MasterCourseExportBody,
  MasterCourseExportCandidatesResponse,
  MasterCourseExportLink,
  MasterCourseExportResponse,
} from "src/courses/schemas/masterCourse.schema";
import type {
  MasterCourseExportRecord,
  SourceSnapshot,
} from "src/courses/types/master-course.types";
import type { CoursesSettings } from "src/courses/types/settings";
import type { MasterCourseExportJobData, MasterCourseSyncJobData } from "src/queue";

@Injectable()
export class MasterCourseService {
  constructor(
    @Inject(DB) private readonly db: DatabasePg,
    private readonly masterCourseRepository: MasterCourseRepository,
    private readonly queueService: MasterCourseQueueService,
    private readonly tenantRunner: TenantDbRunnerService,
  ) {}

  async exportCourseToTenants(
    sourceCourseId: UUIDType,
    body: MasterCourseExportBody,
    actor: CurrentUser,
  ): Promise<MasterCourseExportResponse> {
    await this.assertManagingTenantAdmin(actor);

    const targetTenantIds = this.getUniqueTargetTenantIds(body.targetTenantIds, actor.tenantId);

    if (!targetTenantIds.length)
      throw new BadRequestException("masterCourse.error.noTargetTenants");

    const sourceCourse = await this.masterCourseRepository.getCourseById(sourceCourseId);
    if (!sourceCourse) throw new NotFoundException("Course not found");

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
    actor: CurrentUser,
  ): Promise<MasterCourseExportLink[]> {
    await this.assertManagingTenantAdmin(actor);

    return this.masterCourseRepository.getCourseExportsForManagingTenant(
      actor.tenantId,
      sourceCourseId,
    );
  }

  async getCourseExportCandidates(
    sourceCourseId: UUIDType,
    actor: CurrentUser,
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

    if (!course) throw new NotFoundException("Course not found");

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

    if (!course) throw new NotFoundException("Chapter not found");
    await this.assertCourseContentEditable(course.courseId);
  }

  async assertCourseContentEditableByLessonId(lessonId: UUIDType): Promise<void> {
    const [course] = await this.db
      .select({ courseId: chapters.courseId })
      .from(lessons)
      .innerJoin(chapters, eq(chapters.id, lessons.chapterId))
      .where(eq(lessons.id, lessonId))
      .limit(1);

    if (!course) throw new NotFoundException("Lesson not found");
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

  async processSyncJob(data: MasterCourseSyncJobData) {
    await this.syncExportLink(data.exportId);
  }

  private async syncExportLink(exportId: UUIDType) {
    const exportLink = await this.masterCourseRepository.getExportLinkById(exportId);

    try {
      const sourceSnapshot = await this.buildSourceSnapshot(exportLink);
      const targetCourseId = await this.syncSourceSnapshotToTarget(exportLink, sourceSnapshot);

      await this.masterCourseRepository.markExportSyncSuccess(exportId, targetCourseId);
    } catch (error) {
      await this.masterCourseRepository.markExportSyncFailed(exportId);
      throw error;
    }
  }

  private async buildSourceSnapshot(exportLink: MasterCourseExportRecord): Promise<SourceSnapshot> {
    return this.tenantRunner.runWithTenant(exportLink.sourceTenantId, () =>
      this.masterCourseRepository.getSourceSnapshot(exportLink.sourceCourseId),
    );
  }

  private async syncSourceSnapshotToTarget(
    exportLink: MasterCourseExportRecord,
    sourceSnapshot: SourceSnapshot,
  ): Promise<UUIDType> {
    return this.tenantRunner.runWithTenant(exportLink.targetTenantId, async () => {
      const sourceLanguage = sourceSnapshot.course.baseLanguage;
      const courseSettings = this.normalizeJsonb<CoursesSettings>(sourceSnapshot.course.settings, {
        lessonSequenceEnabled: LESSON_SEQUENCE_ENABLED,
        quizFeedbackEnabled: QUIZ_FEEDBACK_ENABLED,
        certificateSignature: null,
        certificateFontColor: null,
      });

      const targetAuthor = await this.masterCourseRepository.findTargetAuthor();

      if (!targetAuthor) throw new BadRequestException("masterCourse.error.targetAuthorMissing");

      const existingCategory = await this.masterCourseRepository.findCategoryByTitle(
        sourceSnapshot.categoryTitle,
      );

      const categoryId =
        existingCategory?.id ??
        (await this.masterCourseRepository.createCategory(sourceSnapshot.categoryTitle)).id;

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
        });
      } else {
        await this.updateTargetCourseFromSource({
          targetCourseId,
          sourceSnapshot,
          sourceLanguage,
          courseSettings,
          categoryId,
          sourceTenantId: exportLink.sourceTenantId,
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
      });

      const questionMap = await this.syncQuestions({
        exportId: exportLink.id,
        sourceLanguage,
        sourceSnapshot,
        lessonMap,
        targetAuthorId: targetAuthor.id,
      });

      await this.syncOptions({
        exportId: exportLink.id,
        sourceLanguage,
        sourceSnapshot,
        questionMap,
      });

      await this.syncAiMentors(sourceSnapshot, lessonMap);

      await this.syncResources({
        sourceLanguage,
        sourceSnapshot,
        lessonMap,
        targetCourseId: resolvedTargetCourseId,
        targetAuthorId: targetAuthor.id,
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
  }): Promise<UUIDType> {
    const targetCourseId = await this.masterCourseRepository.createTargetCourse({
      title: buildJsonbField(
        params.sourceLanguage,
        this.getLocalizedText(params.sourceSnapshot.course.title, params.sourceLanguage) ?? "",
        true,
      ),
      description: buildJsonbField(
        params.sourceLanguage,
        this.getLocalizedText(params.sourceSnapshot.course.description, params.sourceLanguage),
        true,
      ),
      thumbnailS3Key: params.sourceSnapshot.course.thumbnailS3Key,
      status: "draft",
      hasCertificate: params.sourceSnapshot.course.hasCertificate,
      priceInCents: params.sourceSnapshot.course.priceInCents,
      currency: params.sourceSnapshot.course.currency,
      chapterCount: params.sourceSnapshot.course.chapterCount,
      isScorm: params.sourceSnapshot.course.isScorm,
      authorId: params.targetAuthorId,
      categoryId: params.categoryId,
      stripeProductId: null,
      stripePriceId: null,
      settings: params.courseSettings,
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

  private async updateTargetCourseFromSource(params: {
    targetCourseId: UUIDType;
    sourceSnapshot: SourceSnapshot;
    sourceLanguage: string;
    courseSettings: CoursesSettings;
    categoryId: UUIDType;
    sourceTenantId: UUIDType;
  }): Promise<void> {
    await this.masterCourseRepository.updateTargetCourse(params.targetCourseId, {
      title: setJsonbField(
        courses.title,
        params.sourceLanguage,
        this.getLocalizedText(params.sourceSnapshot.course.title, params.sourceLanguage) ?? "",
        true,
        true,
      ),
      description: setJsonbField(
        courses.description,
        params.sourceLanguage,
        this.getLocalizedText(params.sourceSnapshot.course.description, params.sourceLanguage),
        true,
        true,
      ),
      thumbnailS3Key: params.sourceSnapshot.course.thumbnailS3Key,
      hasCertificate: params.sourceSnapshot.course.hasCertificate,
      chapterCount: params.sourceSnapshot.course.chapterCount,
      isScorm: params.sourceSnapshot.course.isScorm,
      categoryId: params.categoryId,
      settings: params.courseSettings,
      baseLanguage: params.sourceSnapshot.course.baseLanguage,
      availableLocales: params.sourceSnapshot.course.availableLocales,
      originType: COURSE_ORIGIN_TYPES.EXPORTED,
      sourceCourseId: params.sourceSnapshot.course.id,
      sourceTenantId: params.sourceTenantId,
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
      const mappedId = await this.resolveOrCreateMappedTargetId(
        params.exportId,
        MASTER_COURSE_ENTITY_TYPES.CHAPTER,
        sourceChapter.id,
        () =>
          this.masterCourseRepository.createTargetChapter({
            title: buildJsonbField(
              params.sourceLanguage,
              this.getLocalizedText(sourceChapter.title, params.sourceLanguage) ?? "",
              true,
            ),
            courseId: params.targetCourseId,
            authorId: params.targetAuthorId,
            isFreemium: sourceChapter.isFreemium,
            displayOrder: sourceChapter.displayOrder,
            lessonCount: sourceChapter.lessonCount,
          }),
      );

      await this.masterCourseRepository.updateTargetChapter(mappedId, {
        title: setJsonbField(
          chapters.title,
          params.sourceLanguage,
          this.getLocalizedText(sourceChapter.title, params.sourceLanguage) ?? "",
          true,
          true,
        ),
        courseId: params.targetCourseId,
        authorId: params.targetAuthorId,
        isFreemium: sourceChapter.isFreemium,
        displayOrder: sourceChapter.displayOrder,
        lessonCount: sourceChapter.lessonCount,
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
  }) {
    const lessonMap = new Map<UUIDType, UUIDType>();

    for (const sourceLesson of params.sourceSnapshot.lessons) {
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
            title: buildJsonbField(
              params.sourceLanguage,
              this.getLocalizedText(sourceLesson.title, params.sourceLanguage) ?? "",
              true,
            ),
            description: buildJsonbField(
              params.sourceLanguage,
              this.getLocalizedText(sourceLesson.description, params.sourceLanguage),
              true,
            ),
            thresholdScore: sourceLesson.thresholdScore,
            attemptsLimit: sourceLesson.attemptsLimit,
            quizCooldownInHours: sourceLesson.quizCooldownInHours,
            displayOrder: sourceLesson.displayOrder,
            fileS3Key: sourceLesson.fileS3Key,
            fileType: sourceLesson.fileType,
            isExternal: sourceLesson.isExternal,
          }),
      );

      await this.masterCourseRepository.updateTargetLesson(mappedId, {
        chapterId: mappedChapterId,
        type: sourceLesson.type,
        title: setJsonbField(
          lessons.title,
          params.sourceLanguage,
          this.getLocalizedText(sourceLesson.title, params.sourceLanguage) ?? "",
          true,
          true,
        ),
        description: setJsonbField(
          lessons.description,
          params.sourceLanguage,
          this.getLocalizedText(sourceLesson.description, params.sourceLanguage),
          true,
          true,
        ),
        thresholdScore: sourceLesson.thresholdScore,
        attemptsLimit: sourceLesson.attemptsLimit,
        quizCooldownInHours: sourceLesson.quizCooldownInHours,
        displayOrder: sourceLesson.displayOrder,
        fileS3Key: sourceLesson.fileS3Key,
        fileType: sourceLesson.fileType,
        isExternal: sourceLesson.isExternal,
      });

      lessonMap.set(sourceLesson.id, mappedId);
    }

    return lessonMap;
  }

  private async syncQuestions(params: {
    exportId: UUIDType;
    sourceLanguage: string;
    sourceSnapshot: SourceSnapshot;
    lessonMap: Map<UUIDType, UUIDType>;
    targetAuthorId: UUIDType;
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
            description: buildJsonbField(
              params.sourceLanguage,
              this.getLocalizedText(sourceQuestion.description, params.sourceLanguage),
              true,
            ),
            title: buildJsonbField(
              params.sourceLanguage,
              this.getLocalizedText(sourceQuestion.title, params.sourceLanguage) ?? "",
              true,
            ),
            displayOrder: sourceQuestion.displayOrder,
            solutionExplanation: buildJsonbField(
              params.sourceLanguage,
              this.getLocalizedText(sourceQuestion.solutionExplanation, params.sourceLanguage),
              true,
            ),
            photoS3Key: sourceQuestion.photoS3Key,
            authorId: params.targetAuthorId,
          }),
      );

      await this.masterCourseRepository.updateTargetQuestion(mappedId, {
        lessonId: mappedLessonId,
        type: sourceQuestion.type,
        description: setJsonbField(
          questions.description,
          params.sourceLanguage,
          this.getLocalizedText(sourceQuestion.description, params.sourceLanguage),
          true,
          true,
        ),
        title: setJsonbField(
          questions.title,
          params.sourceLanguage,
          this.getLocalizedText(sourceQuestion.title, params.sourceLanguage) ?? "",
          true,
          true,
        ),
        displayOrder: sourceQuestion.displayOrder,
        solutionExplanation: setJsonbField(
          questions.solutionExplanation,
          params.sourceLanguage,
          this.getLocalizedText(sourceQuestion.solutionExplanation, params.sourceLanguage),
          true,
          true,
        ),
        photoS3Key: sourceQuestion.photoS3Key,
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
            optionText: buildJsonbField(
              params.sourceLanguage,
              this.getLocalizedText(sourceOption.optionText, params.sourceLanguage) ?? "",
              true,
            ),
            isCorrect: sourceOption.isCorrect,
            displayOrder: sourceOption.displayOrder,
            matchedWord: buildJsonbField(
              params.sourceLanguage,
              this.getLocalizedText(sourceOption.matchedWord, params.sourceLanguage),
              true,
            ),
            scaleAnswer: sourceOption.scaleAnswer,
          }),
      );

      await this.masterCourseRepository.updateTargetOption(mappedId, {
        questionId: mappedQuestionId,
        optionText: setJsonbField(
          questionAnswerOptions.optionText,
          params.sourceLanguage,
          this.getLocalizedText(sourceOption.optionText, params.sourceLanguage) ?? "",
          true,
          true,
        ),
        isCorrect: sourceOption.isCorrect,
        displayOrder: sourceOption.displayOrder,
        matchedWord: setJsonbField(
          questionAnswerOptions.matchedWord,
          params.sourceLanguage,
          this.getLocalizedText(sourceOption.matchedWord, params.sourceLanguage),
          true,
          true,
        ),
        scaleAnswer: sourceOption.scaleAnswer,
      });
    }
  }

  private async syncAiMentors(sourceSnapshot: SourceSnapshot, lessonMap: Map<UUIDType, UUIDType>) {
    for (const sourceAiMentor of sourceSnapshot.aiMentors) {
      const mappedLessonId = lessonMap.get(sourceAiMentor.lessonId);
      if (!mappedLessonId) continue;

      const existingAiMentor =
        await this.masterCourseRepository.findAiMentorByLessonId(mappedLessonId);

      if (!existingAiMentor) {
        await this.masterCourseRepository.createAiMentor({
          lessonId: mappedLessonId,
          aiMentorInstructions: sourceAiMentor.aiMentorInstructions,
          completionConditions: sourceAiMentor.completionConditions,
          name: sourceAiMentor.name,
          avatarReference: sourceAiMentor.avatarReference,
          type: sourceAiMentor.type,
        });
        continue;
      }

      await this.masterCourseRepository.updateAiMentor(existingAiMentor.id, {
        aiMentorInstructions: sourceAiMentor.aiMentorInstructions,
        completionConditions: sourceAiMentor.completionConditions,
        name: sourceAiMentor.name,
        avatarReference: sourceAiMentor.avatarReference,
        type: sourceAiMentor.type,
      });
    }
  }

  private async syncResources(params: {
    sourceLanguage: string;
    sourceSnapshot: SourceSnapshot;
    lessonMap: Map<UUIDType, UUIDType>;
    targetCourseId: UUIDType;
    targetAuthorId: UUIDType;
  }) {
    const targetLessonIds = Array.from(params.lessonMap.values());

    await this.masterCourseRepository.removeLessonResourceRelations(targetLessonIds);
    await this.masterCourseRepository.removeCourseResourceRelations(params.targetCourseId);

    const insertResourceFromSource = async (
      sourceResource: SourceSnapshot["lessonResources"][number]["resource"],
    ) => {
      return this.masterCourseRepository.createResource({
        title: buildJsonbField(
          params.sourceLanguage,
          this.getLocalizedText(sourceResource.title, params.sourceLanguage) ?? "",
          true,
        ),
        description: buildJsonbField(
          params.sourceLanguage,
          this.getLocalizedText(sourceResource.description, params.sourceLanguage) ?? "",
          true,
        ),
        reference: sourceResource.reference,
        contentType: sourceResource.contentType,
        metadata: this.normalizeJsonb(sourceResource.metadata, {}),
        uploadedBy: params.targetAuthorId,
        archived: false,
      });
    };

    for (const { resource: sourceResource, relation: sourceRelation } of params.sourceSnapshot
      .lessonResources) {
      const mappedLessonId = params.lessonMap.get(sourceRelation.entityId);
      if (!mappedLessonId) continue;

      const targetResourceId = await insertResourceFromSource(sourceResource);
      await this.masterCourseRepository.createResourceRelation({
        resourceId: targetResourceId,
        entityId: mappedLessonId,
        entityType: ENTITY_TYPES.LESSON,
        relationshipType: sourceRelation.relationshipType,
      });
    }

    for (const { resource: sourceResource, relation: sourceRelation } of params.sourceSnapshot
      .courseResources) {
      const targetResourceId = await insertResourceFromSource(sourceResource);

      await this.masterCourseRepository.createResourceRelation({
        resourceId: targetResourceId,
        entityId: params.targetCourseId,
        entityType: ENTITY_TYPES.COURSE,
        relationshipType: sourceRelation.relationshipType || RESOURCE_RELATIONSHIP_TYPES.TRAILER,
      });
    }
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
      sourceSnapshot.lessons.map((item) => item.id),
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

  private async assertManagingTenantAdmin(actor: CurrentUser) {
    if (!actor.permissions?.includes(PERMISSIONS.TENANT_MANAGE))
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
