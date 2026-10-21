import { Inject, Injectable } from "@nestjs/common";
import {
  COURSE_ORIGIN_TYPES,
  ENTITY_TYPES,
  PERMISSIONS,
  SCORM_PACKAGE_ENTITY_TYPE,
  type LearningPathEntityType,
  type MasterCourseEntityType,
  type SupportedLanguages,
} from "@repo/shared";
import {
  and,
  asc,
  count,
  eq,
  getTableColumns,
  inArray,
  isNull,
  notInArray,
  or,
  sql,
} from "drizzle-orm";
import { match } from "ts-pattern";

import { DatabasePg, type UUIDType } from "src/common";
import {
  buildJsonbFieldWithMultipleEntries,
  getFirstJsonbObjectKey,
  getFirstJsonbObjectValue,
} from "src/common/helpers/sqlHelpers";
import { userHasAnyPermissionsCondition } from "src/common/permissions/permission-sql.utils";
import { COURSE_TRANSFER_ENTITY_MAP_SCOPES } from "src/course-transfer/course-transfer.constants";
import { LocalizationService } from "src/localization/localization.service";
import { DB, DB_ADMIN } from "src/storage/db/db.providers";
import {
  aiJudgeBlockingErrors,
  aiJudgeConfigurations,
  aiJudgeCriteria,
  aiJudgeScoreGuidance,
  aiMentorConfigurations,
  aiMentorLessons,
  aiMentorRoleplayConfigurations,
  aiMentorTeacherConfigurations,
  categories,
  chapters,
  courses,
  coursesSummaryStats,
  docChunks,
  documents,
  documentToAiMentorLesson,
  learningPathCourses,
  learningPathEntityMap,
  learningPathExports,
  learningPaths,
  lessons,
  masterCourseEntityMap,
  nativeArchiveEntityMap,
  assessmentQuestionChoiceOptions,
  assessmentQuestionBlankAnswerSets,
  assessmentQuestionBlanks,
  assessmentQuestionDragAndDropOptions,
  assessmentQuestionOpenTextSettings,
  assessmentQuestionScaleOptions,
  assessmentQuestionTrueFalseStatements,
  assessmentQuestions,
  assessments,
  resourceEntity,
  resources,
  scormPackages,
  scormScos,
  tenants,
  users,
} from "src/storage/schema";

import type { AnyPgColumn, AnyPgTable } from "drizzle-orm/pg-core";
import type { CourseTransferEntityMapScope } from "src/course-transfer/course-transfer.types";
import type {
  AiMentorConfigurationJsonbInsert,
  AiMentorConfigurationJsonbUpdate,
  AiMentorRoleplayConfigurationJsonbInsert,
  AiMentorTeacherConfigurationJsonbInsert,
  AiJudgeBlockingErrorJsonbInsert,
  AiJudgeConfigurationJsonbInsert,
  AiJudgeConfigurationJsonbUpdate,
  AiJudgeCriterionJsonbInsert,
  AiJudgeScoreGuidanceJsonbInsert,
  AiMentorLessonJsonbInsert,
  AiMentorLessonJsonbUpdate,
  AssessmentQuestionOpenTextSettingsValues,
  AssessmentUpsertValues,
  CategoryJsonbInsert,
  CategoryJsonbUpdate,
  ChapterJsonbInsert,
  ChapterJsonbUpdate,
  CourseJsonbInsert,
  CourseJsonbUpdate,
  DocChunkInsert,
  DocumentInsert,
  DocumentToAiMentorLessonInsert,
  LessonJsonbInsert,
  LessonJsonbUpdate,
  QuestionAnswerOptionJsonbInsert,
  QuestionAnswerOptionJsonbUpdate,
  QuestionJsonbInsert,
  QuestionJsonbUpdate,
  ResourceEntityInsert,
  ResourceJsonbInsert,
  ScormPackageInsert,
  ScormScoInsert,
  CourseTransferEntityMapping,
  DeleteStaleTargetQuestionDetailsValues,
  RemoveScormPackagesForMappedTargetsParams,
  UpsertTargetBlankAnswerSetValues,
  UpsertTargetBlankValues,
  UpsertTargetDragAndDropOptionValues,
  UpsertTargetScaleOptionValues,
  UpsertTargetTrueFalseStatementValues,
} from "src/course-transfer/types/course-transfer-graph.types";

@Injectable()
export class CourseTransferGraphRepository {
  constructor(
    @Inject(DB) private readonly db: DatabasePg,
    @Inject(DB_ADMIN) private readonly dbAdmin: DatabasePg,
    private readonly localizationService: LocalizationService,
  ) {}

  async getTenantHost(tenantId: UUIDType) {
    const [tenant] = await this.dbAdmin
      .select({ host: tenants.host })
      .from(tenants)
      .where(eq(tenants.id, tenantId))
      .limit(1);

    return tenant?.host;
  }

  async getMappedTargetEntityId(
    scope: CourseTransferEntityMapScope,
    entityType: MasterCourseEntityType,
    sourceEntityId: UUIDType,
    transaction: DatabasePg = this.db,
  ) {
    const [existing] = await match(scope)
      .with({ kind: COURSE_TRANSFER_ENTITY_MAP_SCOPES.EXPORT }, ({ exportId }) =>
        transaction
          .select({ targetEntityId: masterCourseEntityMap.targetEntityId })
          .from(masterCourseEntityMap)
          .where(
            and(
              eq(masterCourseEntityMap.exportId, exportId),
              eq(masterCourseEntityMap.entityType, entityType),
              eq(masterCourseEntityMap.sourceEntityId, sourceEntityId),
            ),
          )
          .limit(1),
      )
      .with({ kind: COURSE_TRANSFER_ENTITY_MAP_SCOPES.ARCHIVE_COURSE }, ({ courseId }) =>
        transaction
          .select({ targetEntityId: nativeArchiveEntityMap.targetEntityId })
          .from(nativeArchiveEntityMap)
          .where(
            and(
              eq(nativeArchiveEntityMap.courseId, courseId),
              eq(nativeArchiveEntityMap.entityType, entityType),
              eq(nativeArchiveEntityMap.sourceEntityId, sourceEntityId),
            ),
          )
          .limit(1),
      )
      .exhaustive();

    return existing?.targetEntityId;
  }

  async upsertMap(
    scope: CourseTransferEntityMapScope,
    entityType: MasterCourseEntityType,
    sourceEntityId: UUIDType,
    targetEntityId: UUIDType,
    transaction: DatabasePg,
  ) {
    await match(scope)
      .with({ kind: COURSE_TRANSFER_ENTITY_MAP_SCOPES.EXPORT }, ({ exportId }) =>
        transaction
          .insert(masterCourseEntityMap)
          .values({ exportId, entityType, sourceEntityId, targetEntityId })
          .onConflictDoUpdate({
            target: [
              masterCourseEntityMap.exportId,
              masterCourseEntityMap.entityType,
              masterCourseEntityMap.sourceEntityId,
            ],
            set: { targetEntityId },
          }),
      )
      .with({ kind: COURSE_TRANSFER_ENTITY_MAP_SCOPES.ARCHIVE_COURSE }, ({ courseId }) =>
        transaction
          .insert(nativeArchiveEntityMap)
          .values({ courseId, entityType, sourceEntityId, targetEntityId })
          .onConflictDoUpdate({
            target: [
              nativeArchiveEntityMap.courseId,
              nativeArchiveEntityMap.entityType,
              nativeArchiveEntityMap.sourceEntityId,
            ],
            set: { targetEntityId },
          }),
      )
      .exhaustive();
  }

  async getMappings(
    scope: CourseTransferEntityMapScope,
    entityType: MasterCourseEntityType,
    transaction: DatabasePg,
  ): Promise<CourseTransferEntityMapping[]> {
    return match(scope)
      .with({ kind: COURSE_TRANSFER_ENTITY_MAP_SCOPES.EXPORT }, ({ exportId }) =>
        transaction
          .select({
            id: masterCourseEntityMap.id,
            sourceEntityId: masterCourseEntityMap.sourceEntityId,
            targetEntityId: masterCourseEntityMap.targetEntityId,
          })
          .from(masterCourseEntityMap)
          .where(
            and(
              eq(masterCourseEntityMap.exportId, exportId),
              eq(masterCourseEntityMap.entityType, entityType),
            ),
          ),
      )
      .with({ kind: COURSE_TRANSFER_ENTITY_MAP_SCOPES.ARCHIVE_COURSE }, ({ courseId }) =>
        transaction
          .select({
            id: nativeArchiveEntityMap.id,
            sourceEntityId: nativeArchiveEntityMap.sourceEntityId,
            targetEntityId: nativeArchiveEntityMap.targetEntityId,
          })
          .from(nativeArchiveEntityMap)
          .where(
            and(
              eq(nativeArchiveEntityMap.courseId, courseId),
              eq(nativeArchiveEntityMap.entityType, entityType),
            ),
          ),
      )
      .exhaustive();
  }

  async deleteMappingsByIds(
    scope: CourseTransferEntityMapScope,
    mapIds: UUIDType[],
    transaction: DatabasePg,
  ) {
    if (!mapIds.length) return;

    await match(scope)
      .with({ kind: COURSE_TRANSFER_ENTITY_MAP_SCOPES.EXPORT }, () =>
        transaction.delete(masterCourseEntityMap).where(inArray(masterCourseEntityMap.id, mapIds)),
      )
      .with({ kind: COURSE_TRANSFER_ENTITY_MAP_SCOPES.ARCHIVE_COURSE }, () =>
        transaction
          .delete(nativeArchiveEntityMap)
          .where(inArray(nativeArchiveEntityMap.id, mapIds)),
      )
      .exhaustive();
  }

  async deleteLessonScormPackages(lessonIds: UUIDType[]) {
    if (!lessonIds.length) return;

    await this.db
      .delete(scormPackages)
      .where(
        and(
          eq(scormPackages.entityType, SCORM_PACKAGE_ENTITY_TYPE.LESSON),
          inArray(scormPackages.entityId, lessonIds),
        ),
      );
  }

  async deleteMappedEntities(
    targetTable:
      | typeof chapters
      | typeof lessons
      | typeof assessmentQuestions
      | typeof assessmentQuestionChoiceOptions,
    targetIds: UUIDType[],
  ) {
    if (!targetIds.length) return;

    await this.db.delete(targetTable).where(inArray((targetTable as any).id, targetIds));
  }

  async upsertTargetOpenTextSettings(values: AssessmentQuestionOpenTextSettingsValues) {
    await this.db
      .insert(assessmentQuestionOpenTextSettings)
      .values(values)
      .onConflictDoUpdate({
        target: assessmentQuestionOpenTextSettings.questionId,
        set: {
          minimumCharacters: values.minimumCharacters,
          maximumCharacters: values.maximumCharacters,
          reviewerInstructions: values.reviewerInstructions,
        },
      });
  }

  async upsertTargetAssessment(values: AssessmentUpsertValues) {
    await this.db
      .insert(assessments)
      .values(values)
      .onConflictDoUpdate({
        target: [assessments.tenantId, assessments.lessonId],
        set: {
          passingScorePercentage: values.passingScorePercentage,
          attemptLimitMode: values.attemptLimitMode,
          maximumAttempts: values.maximumAttempts,
          attemptCooldown: values.attemptCooldown,
          feedbackMode: values.feedbackMode,
          baseLanguage: values.baseLanguage,
          availableLocales: values.availableLocales,
        },
      });
  }

  async getResourceById(resourceId: UUIDType) {
    const [resource] = await this.db
      .select(getTableColumns(resources))
      .from(resources)
      .where(eq(resources.id, resourceId))
      .limit(1);

    return resource;
  }

  async findTargetAuthor() {
    const [targetAuthor] = await this.db
      .select({ id: users.id })
      .from(users)
      .where(
        and(
          isNull(users.deletedAt),
          userHasAnyPermissionsCondition(this.db, users.id, users.tenantId, [
            PERMISSIONS.COURSE_UPDATE,
            PERMISSIONS.COURSE_UPDATE_OWN,
          ]),
        ),
      )
      .limit(1);

    return targetAuthor;
  }

  async findCategoryByBaseTitle(title: string, baseLanguage: SupportedLanguages) {
    const [existingCategory] = await this.db
      .select(getTableColumns(categories))
      .from(categories)
      .where(sql`COALESCE(${categories.title}::jsonb ->> ${baseLanguage}, '') = ${title}`)
      .limit(1);

    return existingCategory;
  }

  async findCategoryByLocalizedTitle(title: string) {
    const [existingCategory] = await this.db
      .select()
      .from(categories)
      .where(this.localizationService.getLocalizedFieldSearchCondition(categories.title, title))
      .limit(1);

    return existingCategory;
  }

  async createCategoryFromSource(
    values: Pick<CategoryJsonbInsert, "title" | "baseLanguage" | "availableLocales">,
  ) {
    const [createdCategory] = await this.db
      .insert(categories)
      .values({
        title: values.title,
        baseLanguage: values.baseLanguage,
        availableLocales: values.availableLocales,
      })
      .onConflictDoNothing()
      .returning({ id: categories.id });

    return createdCategory;
  }

  async updateCategoryFromSource(
    categoryId: UUIDType,
    values: Pick<CategoryJsonbUpdate, "title" | "baseLanguage" | "availableLocales">,
  ) {
    await this.db
      .update(categories)
      .set({
        title: values.title,
        baseLanguage: values.baseLanguage,
        availableLocales: values.availableLocales,
      })
      .where(eq(categories.id, categoryId));
  }

  async findCourseByIdInTenant(courseId: UUIDType | null | undefined) {
    if (!courseId) return undefined;

    const [existingCourse] = await this.db
      .select()
      .from(courses)
      .where(eq(courses.id, courseId))
      .limit(1);

    return existingCourse;
  }

  async ensureCourseSummaryStats(courseId: UUIDType, authorId: UUIDType) {
    await this.db.insert(coursesSummaryStats).values({ courseId, authorId }).onConflictDoNothing();
  }

  async createTargetCourse(values: CourseJsonbInsert): Promise<UUIDType> {
    const [createdCourse] = await this.db
      .insert(courses)
      .values(values)
      .returning({ id: courses.id });
    return createdCourse.id;
  }

  async updateTargetCourse(courseId: UUIDType, values: CourseJsonbUpdate): Promise<void> {
    await this.db.update(courses).set(values).where(eq(courses.id, courseId));
  }

  async updateTargetCourseChapterCount(courseId: UUIDType, chapterCount: number): Promise<void> {
    await this.db.update(courses).set({ chapterCount }).where(eq(courses.id, courseId));
  }

  async createTargetChapter(values: ChapterJsonbInsert): Promise<UUIDType> {
    const [created] = await this.db.insert(chapters).values(values).returning({ id: chapters.id });
    return created.id;
  }

  async updateTargetChapter(chapterId: UUIDType, values: ChapterJsonbUpdate) {
    await this.db.update(chapters).set(values).where(eq(chapters.id, chapterId));
  }

  async createTargetLesson(values: LessonJsonbInsert): Promise<UUIDType> {
    const [created] = await this.db.insert(lessons).values(values).returning({ id: lessons.id });
    return created.id;
  }

  async updateTargetLesson(lessonId: UUIDType, values: LessonJsonbUpdate) {
    await this.db.update(lessons).set(values).where(eq(lessons.id, lessonId));
  }

  async refreshChapterLessonCounts(courseId: UUIDType, transaction: DatabasePg = this.db) {
    const chapterLessonCount = transaction
      .select({ lessonCount: count() })
      .from(lessons)
      .where(eq(lessons.chapterId, chapters.id));

    await transaction
      .update(chapters)
      .set({ lessonCount: sql<number>`(${chapterLessonCount})` })
      .where(eq(chapters.courseId, courseId));
  }

  async insertTargetAssessmentIfMissing(values: AssessmentUpsertValues) {
    await this.db
      .insert(assessments)
      .values(values)
      .onConflictDoNothing({ target: [assessments.tenantId, assessments.lessonId] });
  }

  async findAssessmentIdByLessonId(lessonId: UUIDType) {
    const [assessment] = await this.db
      .select({ id: assessments.id })
      .from(assessments)
      .where(eq(assessments.lessonId, lessonId))
      .limit(1);

    return assessment?.id;
  }

  async createTargetQuestion(
    assessmentId: UUIDType,
    values: QuestionJsonbInsert,
  ): Promise<UUIDType> {
    const [created] = await this.db
      .insert(assessmentQuestions)
      .values({
        assessmentId,
        questionType: values.type,
        displayOrder: values.displayOrder,
        prompt: values.prompt,
        title: values.title,
        description: values.description,
        gradingMode: values.gradingMode,
      })
      .returning({ id: assessmentQuestions.id });

    return created.id;
  }

  async updateTargetQuestion(questionId: UUIDType, values: QuestionJsonbUpdate) {
    await this.db
      .update(assessmentQuestions)
      .set({
        questionType: values.type,
        displayOrder: values.displayOrder,
        prompt: values.prompt,
        title: values.title,
        description: values.description,
        gradingMode: values.gradingMode,
      })
      .where(eq(assessmentQuestions.id, questionId));
  }

  async findOptionDisplayOrders(questionIds: UUIDType[]) {
    if (!questionIds.length) return [];

    return this.db
      .select({
        id: assessmentQuestionChoiceOptions.id,
        displayOrder: assessmentQuestionChoiceOptions.displayOrder,
      })
      .from(assessmentQuestionChoiceOptions)
      .where(inArray(assessmentQuestionChoiceOptions.questionId, questionIds))
      .orderBy(asc(assessmentQuestionChoiceOptions.id));
  }

  async updateOptionDisplayOrder(optionId: UUIDType, displayOrder: number) {
    await this.db
      .update(assessmentQuestionChoiceOptions)
      .set({ displayOrder })
      .where(eq(assessmentQuestionChoiceOptions.id, optionId));
  }

  async createTargetOption(values: QuestionAnswerOptionJsonbInsert): Promise<UUIDType> {
    const [created] = await this.db
      .insert(assessmentQuestionChoiceOptions)
      .values({
        questionId: values.questionId,
        language: getFirstJsonbObjectKey<SupportedLanguages>(values.optionText),
        label: getFirstJsonbObjectValue(values.optionText),
        isCorrect: values.isCorrect,
        displayOrder: values.displayOrder,
      })
      .returning({ id: assessmentQuestionChoiceOptions.id });

    return created.id;
  }

  async updateTargetOption(optionId: UUIDType, values: QuestionAnswerOptionJsonbUpdate) {
    await this.db
      .update(assessmentQuestionChoiceOptions)
      .set({
        ...(values.optionText ? { label: getFirstJsonbObjectValue(values.optionText) } : {}),
        isCorrect: values.isCorrect,
        displayOrder: values.displayOrder,
      })
      .where(eq(assessmentQuestionChoiceOptions.id, optionId));
  }

  async upsertTargetBlank(values: UpsertTargetBlankValues) {
    await this.db
      .insert(assessmentQuestionBlanks)
      .values(values)
      .onConflictDoUpdate({
        target: assessmentQuestionBlanks.id,
        set: {
          questionId: values.questionId,
          textComparisonMode: values.textComparisonMode,
        },
      });
  }

  async upsertTargetBlankAnswerSet(values: UpsertTargetBlankAnswerSetValues) {
    await this.db
      .insert(assessmentQuestionBlankAnswerSets)
      .values(values)
      .onConflictDoUpdate({
        target: [
          assessmentQuestionBlankAnswerSets.tenantId,
          assessmentQuestionBlankAnswerSets.blankId,
          assessmentQuestionBlankAnswerSets.language,
        ],
        set: {
          preferredAnswer: values.preferredAnswer,
          acceptedAnswers: values.acceptedAnswers,
        },
      });
  }

  async upsertTargetDragAndDropOption(values: UpsertTargetDragAndDropOptionValues) {
    await this.db
      .insert(assessmentQuestionDragAndDropOptions)
      .values(values)
      .onConflictDoUpdate({
        target: assessmentQuestionDragAndDropOptions.id,
        set: {
          questionId: values.questionId,
          language: values.language,
          label: values.label,
          targetBlankId: values.targetBlankId,
          displayOrder: values.displayOrder,
        },
      });
  }

  async upsertTargetScaleOption(values: UpsertTargetScaleOptionValues) {
    await this.db
      .insert(assessmentQuestionScaleOptions)
      .values({
        ...values,
        label: buildJsonbFieldWithMultipleEntries(values.label),
      })
      .onConflictDoUpdate({
        target: assessmentQuestionScaleOptions.id,
        set: {
          questionId: values.questionId,
          scaleValue: values.scaleValue,
          displayOrder: values.displayOrder,
          label: buildJsonbFieldWithMultipleEntries(values.label),
        },
      });
  }

  async upsertTargetTrueFalseStatement(values: UpsertTargetTrueFalseStatementValues) {
    await this.db
      .insert(assessmentQuestionTrueFalseStatements)
      .values(values)
      .onConflictDoUpdate({
        target: assessmentQuestionTrueFalseStatements.id,
        set: {
          questionId: values.questionId,
          language: values.language,
          displayOrder: values.displayOrder,
          correctValue: values.correctValue,
          statement: values.statement,
        },
      });
  }

  async deleteStaleTargetQuestionDetails(values: DeleteStaleTargetQuestionDetailsValues) {
    if (!values.questionIds.length) return;

    await this.deleteQuestionDetailRowsNotIn(
      assessmentQuestionScaleOptions,
      assessmentQuestionScaleOptions.questionId,
      assessmentQuestionScaleOptions.id,
      values.questionIds,
      values.scaleOptionIds,
    );
    await this.deleteQuestionDetailRowsNotIn(
      assessmentQuestionTrueFalseStatements,
      assessmentQuestionTrueFalseStatements.questionId,
      assessmentQuestionTrueFalseStatements.id,
      values.questionIds,
      values.trueFalseStatementIds,
    );
    await this.deleteQuestionDetailRowsNotIn(
      assessmentQuestionDragAndDropOptions,
      assessmentQuestionDragAndDropOptions.questionId,
      assessmentQuestionDragAndDropOptions.id,
      values.questionIds,
      values.dragAndDropOptionIds,
    );

    await this.db
      .delete(assessmentQuestionBlankAnswerSets)
      .where(
        values.blankIds.length
          ? inArray(assessmentQuestionBlankAnswerSets.blankId, values.blankIds)
          : sql`false`,
      );
    await this.db
      .delete(assessmentQuestionBlanks)
      .where(
        values.blankIds.length
          ? and(
              inArray(assessmentQuestionBlanks.questionId, values.questionIds),
              notInArray(assessmentQuestionBlanks.id, values.blankIds),
            )
          : inArray(assessmentQuestionBlanks.questionId, values.questionIds),
      );
  }

  private async deleteQuestionDetailRowsNotIn(
    table: AnyPgTable,
    questionIdColumn: AnyPgColumn,
    idColumn: AnyPgColumn,
    questionIds: UUIDType[],
    retainedIds: UUIDType[],
  ) {
    await this.db
      .delete(table)
      .where(
        retainedIds.length
          ? and(inArray(questionIdColumn, questionIds), notInArray(idColumn, retainedIds))
          : inArray(questionIdColumn, questionIds),
      );
  }

  async findAiMentorByLessonId(lessonId: UUIDType) {
    const [existingAiMentor] = await this.db
      .select({ id: aiMentorLessons.id })
      .from(aiMentorLessons)
      .where(eq(aiMentorLessons.lessonId, lessonId))
      .limit(1);

    return existingAiMentor;
  }

  async createAiMentor(values: AiMentorLessonJsonbInsert): Promise<UUIDType> {
    const [created] = await this.db
      .insert(aiMentorLessons)
      .values(values)
      .returning({ id: aiMentorLessons.id });
    return created.id;
  }

  async updateAiMentor(aiMentorId: UUIDType, values: AiMentorLessonJsonbUpdate) {
    await this.db.update(aiMentorLessons).set(values).where(eq(aiMentorLessons.id, aiMentorId));
  }

  async findAiMentorConfigurationByAiMentorLessonId(
    aiMentorLessonId: UUIDType,
    dbInstance: DatabasePg,
  ) {
    const [configuration] = await dbInstance
      .select({ id: aiMentorConfigurations.id })
      .from(aiMentorConfigurations)
      .where(eq(aiMentorConfigurations.aiMentorLessonId, aiMentorLessonId))
      .limit(1);

    return configuration;
  }

  async createAiMentorConfiguration(
    values: AiMentorConfigurationJsonbInsert,
    dbInstance: DatabasePg,
  ): Promise<UUIDType> {
    const [configuration] = await dbInstance
      .insert(aiMentorConfigurations)
      .values(values)
      .returning({ id: aiMentorConfigurations.id });

    return configuration.id;
  }

  async updateAiMentorConfiguration(
    configurationId: UUIDType,
    values: AiMentorConfigurationJsonbUpdate,
    dbInstance: DatabasePg,
  ) {
    await dbInstance
      .update(aiMentorConfigurations)
      .set(values)
      .where(eq(aiMentorConfigurations.id, configurationId));
  }

  async deleteAiMentorConfigurationSubtypes(configurationId: UUIDType, dbInstance: DatabasePg) {
    await dbInstance
      .delete(aiMentorTeacherConfigurations)
      .where(eq(aiMentorTeacherConfigurations.configurationId, configurationId));
    await dbInstance
      .delete(aiMentorRoleplayConfigurations)
      .where(eq(aiMentorRoleplayConfigurations.configurationId, configurationId));
  }

  async createAiMentorTeacherConfiguration(
    values: AiMentorTeacherConfigurationJsonbInsert,
    dbInstance: DatabasePg,
  ) {
    await dbInstance.insert(aiMentorTeacherConfigurations).values(values);
  }

  async createAiMentorRoleplayConfiguration(
    values: AiMentorRoleplayConfigurationJsonbInsert,
    dbInstance: DatabasePg,
  ) {
    await dbInstance.insert(aiMentorRoleplayConfigurations).values(values);
  }

  async findAiJudgeConfigurationByAiMentorLessonId(
    aiMentorLessonId: UUIDType,
    dbInstance: DatabasePg,
  ) {
    const [configuration] = await dbInstance
      .select({ id: aiJudgeConfigurations.id })
      .from(aiJudgeConfigurations)
      .where(eq(aiJudgeConfigurations.aiMentorLessonId, aiMentorLessonId))
      .limit(1);

    return configuration;
  }

  async createAiJudgeConfiguration(
    values: AiJudgeConfigurationJsonbInsert,
    dbInstance: DatabasePg,
  ): Promise<UUIDType> {
    const [configuration] = await dbInstance
      .insert(aiJudgeConfigurations)
      .values(values)
      .returning({ id: aiJudgeConfigurations.id });

    return configuration.id;
  }

  async updateAiJudgeConfiguration(
    configurationId: UUIDType,
    values: AiJudgeConfigurationJsonbUpdate,
    dbInstance: DatabasePg,
  ) {
    await dbInstance
      .update(aiJudgeConfigurations)
      .set(values)
      .where(eq(aiJudgeConfigurations.id, configurationId));
  }

  async deleteAiJudgeCriteria(configurationId: UUIDType, dbInstance: DatabasePg) {
    await dbInstance
      .delete(aiJudgeCriteria)
      .where(eq(aiJudgeCriteria.configurationId, configurationId));
  }

  async deleteAiJudgeBlockingErrors(configurationId: UUIDType, dbInstance: DatabasePg) {
    await dbInstance
      .delete(aiJudgeBlockingErrors)
      .where(eq(aiJudgeBlockingErrors.configurationId, configurationId));
  }

  async createAiJudgeCriterion(
    values: AiJudgeCriterionJsonbInsert,
    dbInstance: DatabasePg,
  ): Promise<UUIDType> {
    const [criterion] = await dbInstance
      .insert(aiJudgeCriteria)
      .values(values)
      .returning({ id: aiJudgeCriteria.id });

    return criterion.id;
  }

  async createAiJudgeScoreGuidance(
    values: AiJudgeScoreGuidanceJsonbInsert,
    dbInstance: DatabasePg,
  ) {
    await dbInstance.insert(aiJudgeScoreGuidance).values(values);
  }

  async createAiJudgeBlockingError(
    values: AiJudgeBlockingErrorJsonbInsert,
    dbInstance: DatabasePg,
  ) {
    await dbInstance.insert(aiJudgeBlockingErrors).values(values);
  }

  async removeAiMentorDocumentLinks(aiMentorLessonIds: UUIDType[]) {
    if (!aiMentorLessonIds.length) return;

    await this.db
      .delete(documentToAiMentorLesson)
      .where(inArray(documentToAiMentorLesson.aiMentorLessonId, aiMentorLessonIds));
  }

  async createDocument(values: DocumentInsert): Promise<UUIDType> {
    const [created] = await this.db
      .insert(documents)
      .values(values)
      .returning({ id: documents.id });
    return created.id;
  }

  async findDocumentByChecksum(checksum: string) {
    const [document] = await this.db
      .select({ id: documents.id })
      .from(documents)
      .where(eq(documents.checksum, checksum))
      .limit(1);

    return document;
  }

  async updateDocument(documentId: UUIDType, values: Partial<DocumentInsert>) {
    await this.db.update(documents).set(values).where(eq(documents.id, documentId));
  }

  async removeDocumentChunks(documentIds: UUIDType[]) {
    if (!documentIds.length) return;

    await this.db.delete(docChunks).where(inArray(docChunks.documentId, documentIds));
  }

  async createDocumentChunk(values: DocChunkInsert) {
    await this.db.insert(docChunks).values(values);
  }

  async createAiMentorDocumentLink(values: DocumentToAiMentorLessonInsert) {
    await this.db.insert(documentToAiMentorLesson).values(values).onConflictDoNothing();
  }

  async removeLessonResourceRelations(lessonIds: UUIDType[]) {
    if (!lessonIds.length) return;

    await this.db
      .delete(resourceEntity)
      .where(
        and(
          eq(resourceEntity.entityType, ENTITY_TYPES.LESSON),
          inArray(resourceEntity.entityId, lessonIds),
        ),
      );
  }

  async removeQuestionResourceRelations(questionIds: UUIDType[]) {
    if (!questionIds.length) return;

    await this.db
      .delete(resourceEntity)
      .where(
        and(
          eq(resourceEntity.entityType, ENTITY_TYPES.ASSESSMENT_QUESTION),
          inArray(resourceEntity.entityId, questionIds),
        ),
      );
  }

  async removeCourseResourceRelations(courseId: UUIDType) {
    await this.db
      .delete(resourceEntity)
      .where(
        and(
          eq(resourceEntity.entityType, ENTITY_TYPES.COURSE),
          eq(resourceEntity.entityId, courseId),
        ),
      );
  }

  async createResource(values: ResourceJsonbInsert): Promise<UUIDType> {
    const [created] = await this.db
      .insert(resources)
      .values(values)
      .returning({ id: resources.id });
    return created.id;
  }

  async updateResource(resourceId: UUIDType, values: Partial<ResourceJsonbInsert>) {
    await this.db.update(resources).set(values).where(eq(resources.id, resourceId));
  }

  async deleteResourcesByIds(resourceIds: UUIDType[]) {
    if (!resourceIds.length) return;

    await this.db.delete(resources).where(inArray(resources.id, resourceIds));
  }

  async createResourceRelation(values: ResourceEntityInsert) {
    await this.db.insert(resourceEntity).values(values);
  }

  async removeScormPackagesForMappedTargets(params: RemoveScormPackagesForMappedTargetsParams) {
    const mappedTargetConditions = [
      and(
        eq(scormPackages.entityType, SCORM_PACKAGE_ENTITY_TYPE.COURSE),
        eq(scormPackages.entityId, params.targetCourseId),
      ),
    ];

    if (params.targetLessonIds.length) {
      mappedTargetConditions.push(
        and(
          eq(scormPackages.entityType, SCORM_PACKAGE_ENTITY_TYPE.LESSON),
          inArray(scormPackages.entityId, params.targetLessonIds),
        ),
      );
    }

    const retainedPackageCondition = params.retainedPackageIds.length
      ? notInArray(scormPackages.id, params.retainedPackageIds)
      : undefined;

    await this.db
      .delete(scormPackages)
      .where(and(or(...mappedTargetConditions), retainedPackageCondition));
  }

  async upsertScormPackage(values: ScormPackageInsert & { id: UUIDType }) {
    const { id: _id, tenantId: _tenantId, createdAt: _createdAt, ...updatableValues } = values;

    await this.db
      .insert(scormPackages)
      .values(values)
      .onConflictDoUpdate({ target: scormPackages.id, set: updatableValues });
  }

  async upsertScormSco(values: ScormScoInsert) {
    const {
      id: _id,
      tenantId: _tenantId,
      createdAt: _createdAt,
      packageId: _packageId,
      identifier: _identifier,
      ...updatableValues
    } = values;

    await this.db
      .insert(scormScos)
      .values(values)
      .onConflictDoUpdate({
        target: [scormScos.packageId, scormScos.identifier],
        set: updatableValues,
      });
  }

  async removeScormScosMissingFromPackage(packageId: UUIDType, retainedIdentifiers: string[]) {
    const retainedIdentifierCondition = retainedIdentifiers.length
      ? notInArray(scormScos.identifier, retainedIdentifiers)
      : undefined;

    await this.db
      .delete(scormScos)
      .where(and(eq(scormScos.packageId, packageId), retainedIdentifierCondition));
  }

  async findLearningPathTargetAuthor(transaction: DatabasePg) {
    const [targetAuthor] = await transaction
      .select({ id: users.id })
      .from(users)
      .where(
        and(
          isNull(users.deletedAt),
          userHasAnyPermissionsCondition(transaction, users.id, users.tenantId, [
            PERMISSIONS.LEARNING_PATH_CREATE,
            PERMISSIONS.LEARNING_PATH_UPDATE,
            PERMISSIONS.LEARNING_PATH_UPDATE_OWN,
            PERMISSIONS.LEARNING_PATH_COURSE_UPDATE,
            PERMISSIONS.LEARNING_PATH_COURSE_UPDATE_OWN,
            PERMISSIONS.COURSE_UPDATE,
            PERMISSIONS.COURSE_UPDATE_OWN,
          ]),
        ),
      )
      .limit(1);

    return targetAuthor;
  }

  async findLearningPathTargetIdByExportId(exportId: UUIDType, transaction: DatabasePg) {
    const [relationship] = await transaction
      .select({ targetLearningPathId: learningPathExports.targetLearningPathId })
      .from(learningPathExports)
      .where(eq(learningPathExports.id, exportId))
      .limit(1);

    return relationship?.targetLearningPathId ?? null;
  }

  async findLearningPathById(learningPathId: UUIDType, transaction: DatabasePg) {
    const [learningPath] = await transaction
      .select()
      .from(learningPaths)
      .where(eq(learningPaths.id, learningPathId))
      .limit(1);

    return learningPath;
  }

  async findOldestExportedLearningPath(
    sourceTenantId: UUIDType,
    sourceLearningPathId: UUIDType,
    targetTenantId: UUIDType,
    transaction: DatabasePg,
  ) {
    const [learningPath] = await transaction
      .select()
      .from(learningPaths)
      .where(
        and(
          eq(learningPaths.sourceTenantId, sourceTenantId),
          eq(learningPaths.sourceLearningPathId, sourceLearningPathId),
          eq(learningPaths.tenantId, targetTenantId),
          eq(learningPaths.originType, COURSE_ORIGIN_TYPES.EXPORTED),
        ),
      )
      .orderBy(asc(learningPaths.createdAt), asc(learningPaths.id))
      .limit(1);

    return learningPath;
  }

  async createTargetLearningPath(
    values: typeof learningPaths.$inferInsert,
    transaction: DatabasePg,
  ): Promise<void> {
    await transaction.insert(learningPaths).values(values);
  }

  async updateTargetLearningPath(
    pathId: UUIDType,
    values: Partial<typeof learningPaths.$inferInsert>,
    transaction: DatabasePg,
  ): Promise<void> {
    await transaction.update(learningPaths).set(values).where(eq(learningPaths.id, pathId));
  }

  async deleteLearningPathCourses(pathId: UUIDType, transaction: DatabasePg) {
    await transaction
      .delete(learningPathCourses)
      .where(eq(learningPathCourses.learningPathId, pathId));
  }

  async insertLearningPathCourses(
    courseLinks: {
      learningPathId: UUIDType;
      courseId: UUIDType;
      displayOrder: number;
      tenantId: UUIDType;
    }[],
    transaction: DatabasePg,
  ) {
    if (!courseLinks.length) return;

    await transaction.insert(learningPathCourses).values(courseLinks);
  }

  async upsertLearningPathEntityMap(
    exportId: UUIDType,
    entityType: LearningPathEntityType,
    sourceEntityId: UUIDType,
    targetEntityId: UUIDType,
    transaction: DatabasePg,
  ): Promise<void> {
    await transaction
      .insert(learningPathEntityMap)
      .values({ exportId, entityType, sourceEntityId, targetEntityId })
      .onConflictDoUpdate({
        target: [
          learningPathEntityMap.exportId,
          learningPathEntityMap.entityType,
          learningPathEntityMap.sourceEntityId,
        ],
        set: { targetEntityId },
      });
  }
}
