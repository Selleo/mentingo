import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import {
  COURSE_ORIGIN_TYPES,
  ENTITY_TYPES,
  MASTER_COURSE_EXPORT_SYNC_STATUSES,
  PERMISSIONS,
  SCORM_PACKAGE_ENTITY_TYPE,
  TENANT_STATUSES,
  type LocalizedText,
  type MasterCourseEntityType,
  type SupportedLanguages,
} from "@repo/shared";
import {
  and,
  asc,
  eq,
  getTableColumns,
  inArray,
  isNull,
  ne,
  notInArray,
  or,
  sql,
} from "drizzle-orm";

import { DatabasePg, type UUIDType } from "src/common";
import {
  buildJsonbFieldWithMultipleEntries,
  getFirstJsonbObjectKey,
  getFirstJsonbObjectValue,
} from "src/common/helpers/sqlHelpers";
import { userHasAnyPermissionsCondition } from "src/common/permissions/permission-sql.utils";
import { RESOURCE_RELATIONSHIP_TYPES } from "src/file/file.constants";
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
  lessons,
  masterCourseEntityMap,
  masterCourseExports,
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
import type {
  AiMentorConfigurationInsert,
  AiMentorRoleplayConfigurationInsert,
  AiMentorTeacherConfigurationInsert,
  AiJudgeBlockingErrorJsonbInsert,
  AiJudgeConfigurationJsonbInsert,
  AiJudgeConfigurationJsonbUpdate,
  AiJudgeCriterionJsonbInsert,
  AiJudgeScoreGuidanceJsonbInsert,
  AiMentorLessonInsert,
  AssessmentQuestionOpenTextSettingsValues,
  AssessmentUpsertValues,
  CategoryJsonbInsert,
  CategoryJsonbUpdate,
  CourseSelect,
  ChapterJsonbInsert,
  ChapterJsonbUpdate,
  CourseJsonbInsert,
  CourseJsonbUpdate,
  DocChunkInsert,
  DocumentInsert,
  DocumentToAiMentorLessonInsert,
  LessonJsonbInsert,
  LessonJsonbUpdate,
  MasterCourseExportRecord,
  QuestionAnswerOptionJsonbInsert,
  QuestionAnswerOptionJsonbUpdate,
  QuestionJsonbInsert,
  QuestionJsonbUpdate,
  ResourceEntityInsert,
  ResourceJsonbInsert,
  ScormPackageInsert,
  ScormScoInsert,
  DeleteStaleTargetQuestionDetailsValues,
  RemoveScormPackagesForMappedTargetsParams,
  UpsertTargetBlankAnswerSetValues,
  UpsertTargetBlankValues,
  UpsertTargetDragAndDropOptionValues,
  UpsertTargetScaleOptionValues,
  UpsertTargetTrueFalseStatementValues,
} from "src/courses/types/master-course.types";

@Injectable()
export class MasterCourseRepository {
  constructor(
    @Inject(DB) private readonly db: DatabasePg,
    @Inject(DB_ADMIN) private readonly dbAdmin: DatabasePg,
    private readonly localizationService: LocalizationService,
  ) {}

  async getCourseById(courseId: UUIDType) {
    const [course] = await this.db
      .select({ ...getTableColumns(courses) })
      .from(courses)
      .where(eq(courses.id, courseId))
      .limit(1);

    return course;
  }

  async markCourseAsMaster(courseId: UUIDType) {
    await this.db
      .update(courses)
      .set({ originType: COURSE_ORIGIN_TYPES.MASTER })
      .where(eq(courses.id, courseId));
  }

  async getTenantManagingStatus(tenantId: UUIDType) {
    const [tenant] = await this.dbAdmin
      .select({ isManaging: tenants.isManaging })
      .from(tenants)
      .where(eq(tenants.id, tenantId))
      .limit(1);

    return tenant;
  }

  async getTenantHost(tenantId: UUIDType) {
    const [tenant] = await this.dbAdmin
      .select({ host: tenants.host })
      .from(tenants)
      .where(eq(tenants.id, tenantId))
      .limit(1);

    return tenant?.host;
  }

  async findExportLinkByPair(
    sourceTenantId: UUIDType,
    sourceCourseId: UUIDType,
    targetTenantId: UUIDType,
  ) {
    const [exportLink] = await this.dbAdmin
      .select()
      .from(masterCourseExports)
      .where(
        and(
          eq(masterCourseExports.sourceTenantId, sourceTenantId),
          eq(masterCourseExports.sourceCourseId, sourceCourseId),
          eq(masterCourseExports.targetTenantId, targetTenantId),
        ),
      )
      .limit(1);

    return exportLink;
  }

  async createExportLink(
    sourceTenantId: UUIDType,
    sourceCourseId: UUIDType,
    targetTenantId: UUIDType,
  ) {
    const [createdExport] = await this.dbAdmin
      .insert(masterCourseExports)
      .values({
        sourceTenantId,
        sourceCourseId,
        targetTenantId,
        syncStatus: MASTER_COURSE_EXPORT_SYNC_STATUSES.ACTIVE,
      })
      .returning();

    return createdExport;
  }

  async getCourseExportsForManagingTenant(sourceTenantId: UUIDType, sourceCourseId: UUIDType) {
    return this.dbAdmin
      .select({
        id: masterCourseExports.id,
        sourceTenantId: masterCourseExports.sourceTenantId,
        sourceCourseId: masterCourseExports.sourceCourseId,
        targetTenantId: masterCourseExports.targetTenantId,
        targetCourseId: masterCourseExports.targetCourseId,
        syncStatus: masterCourseExports.syncStatus,
        lastSyncedAt: masterCourseExports.lastSyncedAt,
      })
      .from(masterCourseExports)
      .where(
        and(
          eq(masterCourseExports.sourceTenantId, sourceTenantId),
          eq(masterCourseExports.sourceCourseId, sourceCourseId),
        ),
      );
  }

  async getExportCandidatesForCourse(sourceTenantId: UUIDType, sourceCourseId: UUIDType) {
    return this.dbAdmin
      .select({
        id: tenants.id,
        name: tenants.name,
        host: tenants.host,
        exportId: masterCourseExports.id,
        targetCourseId: masterCourseExports.targetCourseId,
        syncStatus: masterCourseExports.syncStatus,
        lastSyncedAt: masterCourseExports.lastSyncedAt,
      })
      .from(tenants)
      .leftJoin(
        masterCourseExports,
        and(
          eq(masterCourseExports.sourceTenantId, sourceTenantId),
          eq(masterCourseExports.sourceCourseId, sourceCourseId),
          eq(masterCourseExports.targetTenantId, tenants.id),
        ),
      )
      .where(and(ne(tenants.id, sourceTenantId), eq(tenants.status, TENANT_STATUSES.ACTIVE)))
      .orderBy(asc(tenants.name));
  }

  async getActiveExportLinksBySourceCourse(sourceCourseId: UUIDType) {
    return this.dbAdmin
      .select()
      .from(masterCourseExports)
      .where(
        and(
          eq(masterCourseExports.sourceCourseId, sourceCourseId),
          ne(masterCourseExports.syncStatus, MASTER_COURSE_EXPORT_SYNC_STATUSES.PAUSED),
        ),
      );
  }

  async getExportLinkById(exportId: UUIDType): Promise<MasterCourseExportRecord> {
    const [exportLink] = await this.dbAdmin
      .select()
      .from(masterCourseExports)
      .where(eq(masterCourseExports.id, exportId))
      .limit(1);

    if (!exportLink) {
      throw new NotFoundException("masterCourse.error.exportLinkMissing");
    }

    return exportLink;
  }

  async updateExportTargetCourse(exportId: UUIDType, targetCourseId: UUIDType) {
    await this.dbAdmin
      .update(masterCourseExports)
      .set({ targetCourseId })
      .where(eq(masterCourseExports.id, exportId));
  }

  async markExportSyncSuccess(exportId: UUIDType, targetCourseId: UUIDType) {
    await this.dbAdmin
      .update(masterCourseExports)
      .set({
        targetCourseId,
        syncStatus: MASTER_COURSE_EXPORT_SYNC_STATUSES.ACTIVE,
        lastSyncedAt: sql`CURRENT_TIMESTAMP`,
      })
      .where(eq(masterCourseExports.id, exportId));
  }

  async markExportSyncFailed(exportId: UUIDType) {
    await this.dbAdmin
      .update(masterCourseExports)
      .set({ syncStatus: MASTER_COURSE_EXPORT_SYNC_STATUSES.FAILED })
      .where(eq(masterCourseExports.id, exportId));
  }

  async getMappedTargetEntityId(
    exportId: UUIDType,
    entityType: MasterCourseEntityType,
    sourceEntityId: UUIDType,
  ) {
    const [existing] = await this.dbAdmin
      .select({ targetEntityId: masterCourseEntityMap.targetEntityId })
      .from(masterCourseEntityMap)
      .where(
        and(
          eq(masterCourseEntityMap.exportId, exportId),
          eq(masterCourseEntityMap.entityType, entityType),
          eq(masterCourseEntityMap.sourceEntityId, sourceEntityId),
        ),
      )
      .limit(1);

    return existing?.targetEntityId;
  }

  async upsertMap(
    exportId: UUIDType,
    entityType: MasterCourseEntityType,
    sourceEntityId: UUIDType,
    targetEntityId: UUIDType,
  ) {
    await this.dbAdmin
      .insert(masterCourseEntityMap)
      .values({
        exportId,
        entityType,
        sourceEntityId,
        targetEntityId,
      })
      .onConflictDoUpdate({
        target: [
          masterCourseEntityMap.exportId,
          masterCourseEntityMap.entityType,
          masterCourseEntityMap.sourceEntityId,
        ],
        set: { targetEntityId },
      });
  }

  async getMappings(exportId: UUIDType, entityType: MasterCourseEntityType) {
    return this.dbAdmin
      .select()
      .from(masterCourseEntityMap)
      .where(
        and(
          eq(masterCourseEntityMap.exportId, exportId),
          eq(masterCourseEntityMap.entityType, entityType),
        ),
      );
  }

  async deleteMappingsByIds(mapIds: UUIDType[]) {
    if (!mapIds.length) return;

    await this.dbAdmin
      .delete(masterCourseEntityMap)
      .where(inArray(masterCourseEntityMap.id, mapIds));
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

  async getSourceCategoryWithBaseTitle(sourceCourse: CourseSelect) {
    const [sourceCategoryRow] = await this.db
      .select({
        ...getTableColumns(categories),
        baseTitle: this.localizationService.getLocalizedSqlField(
          categories.title,
          sourceCourse.baseLanguage,
          categories,
        ),
      })
      .from(categories)
      .where(eq(categories.id, sourceCourse.categoryId))
      .limit(1);

    return sourceCategoryRow;
  }

  async getSourceChapters(sourceCourseId: UUIDType) {
    return this.db
      .select(getTableColumns(chapters))
      .from(chapters)
      .where(eq(chapters.courseId, sourceCourseId))
      .orderBy(chapters.displayOrder);
  }

  async getSourceLessons(sourceCourseId: UUIDType) {
    return this.db
      .select(getTableColumns(lessons))
      .from(lessons)
      .innerJoin(chapters, eq(chapters.id, lessons.chapterId))
      .where(eq(chapters.courseId, sourceCourseId))
      .orderBy(lessons.displayOrder);
  }

  async getSourceQuestions(lessonIds: UUIDType[]) {
    if (!lessonIds.length) return [];

    return this.db
      .select({
        ...getTableColumns(assessmentQuestions),
        lessonId: assessments.lessonId,
        type: assessmentQuestions.questionType,
        prompt: sql<LocalizedText>`${assessmentQuestions.prompt}`,
        title: sql<LocalizedText | null>`${assessmentQuestions.title}`,
        description: sql<LocalizedText | null>`${assessmentQuestions.description}`,
        solutionExplanation: sql<LocalizedText | null>`NULL`,
        photoS3Key: resources.reference,
        authorId: sql<UUIDType | null>`NULL`,
      })
      .from(assessmentQuestions)
      .innerJoin(assessments, eq(assessments.id, assessmentQuestions.assessmentId))
      .leftJoin(
        resourceEntity,
        and(
          eq(resourceEntity.entityId, assessmentQuestions.id),
          eq(resourceEntity.entityType, ENTITY_TYPES.ASSESSMENT_QUESTION),
          eq(resourceEntity.relationshipType, RESOURCE_RELATIONSHIP_TYPES.PROMPT_IMAGE),
        ),
      )
      .leftJoin(
        resources,
        and(eq(resources.id, resourceEntity.resourceId), eq(resources.archived, false)),
      )
      .where(inArray(assessments.lessonId, lessonIds))
      .orderBy(assessmentQuestions.displayOrder);
  }

  async getSourceAssessments(lessonIds: UUIDType[]) {
    if (!lessonIds.length) return [];
    return this.db
      .select(getTableColumns(assessments))
      .from(assessments)
      .where(inArray(assessments.lessonId, lessonIds));
  }

  async getSourceOpenTextSettings(questionIds: UUIDType[]) {
    if (!questionIds.length) return [];
    return this.db
      .select(getTableColumns(assessmentQuestionOpenTextSettings))
      .from(assessmentQuestionOpenTextSettings)
      .where(inArray(assessmentQuestionOpenTextSettings.questionId, questionIds));
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

  async getSourceOptions(questionIds: UUIDType[]) {
    if (!questionIds.length) return [];

    return this.db
      .select({
        id: assessmentQuestionChoiceOptions.id,
        questionId: assessmentQuestionChoiceOptions.questionId,
        optionText: sql<LocalizedText>`JSONB_BUILD_OBJECT(
          ${assessmentQuestionChoiceOptions.language},
          ${assessmentQuestionChoiceOptions.label}
        )`,
        matchedWord: sql<LocalizedText | null>`NULL`,
        isCorrect: assessmentQuestionChoiceOptions.isCorrect,
        displayOrder: assessmentQuestionChoiceOptions.displayOrder,
        scaleAnswer: sql<number | null>`NULL`,
        createdAt: assessmentQuestionChoiceOptions.createdAt,
        updatedAt: assessmentQuestionChoiceOptions.updatedAt,
        tenantId: assessmentQuestionChoiceOptions.tenantId,
      })
      .from(assessmentQuestionChoiceOptions)
      .where(inArray(assessmentQuestionChoiceOptions.questionId, questionIds))
      .orderBy(assessmentQuestionChoiceOptions.displayOrder);
  }

  async getSourceQuestionBlanks(questionIds: UUIDType[]) {
    if (!questionIds.length) return [];

    return this.db
      .select(getTableColumns(assessmentQuestionBlanks))
      .from(assessmentQuestionBlanks)
      .where(inArray(assessmentQuestionBlanks.questionId, questionIds));
  }

  async getSourceBlankAnswerSets(blankIds: UUIDType[]) {
    if (!blankIds.length) return [];

    return this.db
      .select(getTableColumns(assessmentQuestionBlankAnswerSets))
      .from(assessmentQuestionBlankAnswerSets)
      .where(inArray(assessmentQuestionBlankAnswerSets.blankId, blankIds));
  }

  async getSourceDragAndDropOptions(questionIds: UUIDType[]) {
    if (!questionIds.length) return [];

    return this.db
      .select(getTableColumns(assessmentQuestionDragAndDropOptions))
      .from(assessmentQuestionDragAndDropOptions)
      .where(inArray(assessmentQuestionDragAndDropOptions.questionId, questionIds));
  }

  async getSourceScaleOptions(questionIds: UUIDType[]) {
    if (!questionIds.length) return [];
    return this.db
      .select(getTableColumns(assessmentQuestionScaleOptions))
      .from(assessmentQuestionScaleOptions)
      .where(inArray(assessmentQuestionScaleOptions.questionId, questionIds));
  }

  async getSourceTrueFalseStatements(questionIds: UUIDType[]) {
    if (!questionIds.length) return [];
    return this.db
      .select(getTableColumns(assessmentQuestionTrueFalseStatements))
      .from(assessmentQuestionTrueFalseStatements)
      .where(inArray(assessmentQuestionTrueFalseStatements.questionId, questionIds));
  }

  async getSourceAiMentors(lessonIds: UUIDType[]) {
    if (!lessonIds.length) return [];

    return this.db
      .select(getTableColumns(aiMentorLessons))
      .from(aiMentorLessons)
      .where(inArray(aiMentorLessons.lessonId, lessonIds));
  }

  async getSourceAiMentorConfigurations(aiMentorLessonIds: UUIDType[]) {
    if (!aiMentorLessonIds.length) return [];

    return this.db
      .select()
      .from(aiMentorConfigurations)
      .where(inArray(aiMentorConfigurations.aiMentorLessonId, aiMentorLessonIds));
  }

  async getSourceAiMentorTeacherConfigurations(configurationIds: UUIDType[]) {
    return this.db
      .select()
      .from(aiMentorTeacherConfigurations)
      .where(inArray(aiMentorTeacherConfigurations.configurationId, configurationIds));
  }

  async getSourceAiMentorRoleplayConfigurations(configurationIds: UUIDType[]) {
    return this.db
      .select()
      .from(aiMentorRoleplayConfigurations)
      .where(inArray(aiMentorRoleplayConfigurations.configurationId, configurationIds));
  }

  async getSourceAiJudgeConfigurations(aiMentorLessonIds: UUIDType[]) {
    return this.db
      .select()
      .from(aiJudgeConfigurations)
      .where(inArray(aiJudgeConfigurations.aiMentorLessonId, aiMentorLessonIds));
  }

  async getSourceAiJudgeCriteria(configurationIds: UUIDType[]) {
    return this.db
      .select()
      .from(aiJudgeCriteria)
      .where(inArray(aiJudgeCriteria.configurationId, configurationIds))
      .orderBy(asc(aiJudgeCriteria.createdAt));
  }

  async getSourceAiJudgeScoreGuidance(criterionIds: UUIDType[]) {
    return this.db
      .select()
      .from(aiJudgeScoreGuidance)
      .where(inArray(aiJudgeScoreGuidance.criterionId, criterionIds))
      .orderBy(asc(aiJudgeScoreGuidance.createdAt));
  }

  async getSourceAiJudgeBlockingErrors(configurationIds: UUIDType[]) {
    return this.db
      .select()
      .from(aiJudgeBlockingErrors)
      .where(inArray(aiJudgeBlockingErrors.configurationId, configurationIds))
      .orderBy(asc(aiJudgeBlockingErrors.createdAt));
  }

  async getSourceAiMentorDocumentLinks(aiMentorIds: UUIDType[]) {
    if (!aiMentorIds.length) return [];

    return this.db
      .select(getTableColumns(documentToAiMentorLesson))
      .from(documentToAiMentorLesson)
      .where(inArray(documentToAiMentorLesson.aiMentorLessonId, aiMentorIds));
  }

  async getSourceDocuments(documentIds: UUIDType[]) {
    if (!documentIds.length) return [];

    return this.db
      .select(getTableColumns(documents))
      .from(documents)
      .where(inArray(documents.id, documentIds));
  }

  async getSourceDocChunks(documentIds: UUIDType[]) {
    if (!documentIds.length) return [];

    return this.db
      .select(getTableColumns(docChunks))
      .from(docChunks)
      .where(inArray(docChunks.documentId, documentIds))
      .orderBy(docChunks.documentId, docChunks.chunkIndex);
  }

  async getSourceScormPackages(sourceCourseId: UUIDType, scormLessonIds: UUIDType[]) {
    if (!scormLessonIds.length) return [];

    return this.db
      .selectDistinct(getTableColumns(scormPackages))
      .from(scormPackages)
      .innerJoin(scormScos, eq(scormScos.packageId, scormPackages.id))
      .where(
        and(
          inArray(scormScos.lessonId, scormLessonIds),
          sql`(
            (${scormPackages.entityType} = ${SCORM_PACKAGE_ENTITY_TYPE.LESSON} AND ${scormPackages.entityId} = ${scormScos.lessonId})
            OR (${scormPackages.entityType} = ${SCORM_PACKAGE_ENTITY_TYPE.COURSE} AND ${scormPackages.entityId} = ${sourceCourseId})
          )`,
        ),
      );
  }

  async getSourceScormScos(packageIds: UUIDType[], scormLessonIds: UUIDType[]) {
    if (!packageIds.length || !scormLessonIds.length) return [];

    return this.db
      .select(getTableColumns(scormScos))
      .from(scormScos)
      .where(
        and(inArray(scormScos.packageId, packageIds), inArray(scormScos.lessonId, scormLessonIds)),
      )
      .orderBy(scormScos.packageId, scormScos.displayOrder);
  }

  async getSourceLessonResources(lessonIds: UUIDType[]) {
    if (!lessonIds.length) return [];

    return this.db
      .select({
        resource: getTableColumns(resources),
        relation: getTableColumns(resourceEntity),
      })
      .from(resourceEntity)
      .innerJoin(resources, eq(resources.id, resourceEntity.resourceId))
      .where(
        and(
          eq(resourceEntity.entityType, ENTITY_TYPES.LESSON),
          inArray(resourceEntity.entityId, lessonIds),
          eq(resources.archived, false),
        ),
      );
  }

  async getResourcesByIds(resourceIds: UUIDType[]) {
    if (!resourceIds.length) return [];

    return this.db
      .select(getTableColumns(resources))
      .from(resources)
      .where(and(inArray(resources.id, resourceIds), eq(resources.archived, false)));
  }

  async getResourceById(resourceId: UUIDType) {
    const [resource] = await this.db
      .select(getTableColumns(resources))
      .from(resources)
      .where(eq(resources.id, resourceId))
      .limit(1);

    return resource;
  }

  async getSourceCourseResources(sourceCourseId: UUIDType) {
    return this.db
      .select({
        resource: getTableColumns(resources),
        relation: getTableColumns(resourceEntity),
      })
      .from(resourceEntity)
      .innerJoin(resources, eq(resources.id, resourceEntity.resourceId))
      .where(
        and(
          eq(resourceEntity.entityType, ENTITY_TYPES.COURSE),
          eq(resourceEntity.entityId, sourceCourseId),
          eq(resources.archived, false),
        ),
      );
  }

  async getSourceQuestionResources(questionIds: UUIDType[]) {
    if (!questionIds.length) return [];

    return this.db
      .select({
        resource: getTableColumns(resources),
        relation: getTableColumns(resourceEntity),
      })
      .from(resourceEntity)
      .innerJoin(resources, eq(resources.id, resourceEntity.resourceId))
      .where(
        and(
          eq(resourceEntity.entityType, ENTITY_TYPES.ASSESSMENT_QUESTION),
          inArray(resourceEntity.entityId, questionIds),
          eq(resourceEntity.relationshipType, RESOURCE_RELATIONSHIP_TYPES.PROMPT_IMAGE),
          eq(resources.archived, false),
        ),
      );
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

  async createTargetQuestion(
    values: QuestionJsonbInsert,
    assessmentValues: AssessmentUpsertValues,
  ): Promise<UUIDType> {
    const lessonId = values.lessonId;

    const [assessment] = await this.db
      .insert(assessments)
      .values(assessmentValues)
      .onConflictDoNothing({ target: [assessments.tenantId, assessments.lessonId] })
      .returning({ id: assessments.id });

    const existingAssessment =
      assessment ??
      (
        await this.db
          .select({ id: assessments.id })
          .from(assessments)
          .where(eq(assessments.lessonId, lessonId))
          .limit(1)
      )[0];

    const [created] = await this.db
      .insert(assessmentQuestions)
      .values({
        assessmentId: existingAssessment.id,
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
          textComparisonMode: values.textComparisonMode as never,
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

  async createAiMentor(values: AiMentorLessonInsert): Promise<UUIDType> {
    const [created] = await this.db
      .insert(aiMentorLessons)
      .values(values)
      .returning({ id: aiMentorLessons.id });
    return created.id;
  }

  async updateAiMentor(aiMentorId: UUIDType, values: Partial<AiMentorLessonInsert>) {
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
    values: AiMentorConfigurationInsert,
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
    values: Partial<AiMentorConfigurationInsert>,
    dbInstance: DatabasePg,
  ) {
    await dbInstance
      .update(aiMentorConfigurations)
      .set(values)
      .where(eq(aiMentorConfigurations.id, configurationId));
  }

  async replaceAiMentorConfigurationSubtype(
    configurationId: UUIDType,
    teacher: Omit<AiMentorTeacherConfigurationInsert, "configurationId"> | null,
    roleplay: Omit<AiMentorRoleplayConfigurationInsert, "configurationId"> | null,
    dbInstance: DatabasePg,
  ) {
    await dbInstance
      .delete(aiMentorTeacherConfigurations)
      .where(eq(aiMentorTeacherConfigurations.configurationId, configurationId));
    await dbInstance
      .delete(aiMentorRoleplayConfigurations)
      .where(eq(aiMentorRoleplayConfigurations.configurationId, configurationId));

    if (teacher)
      await dbInstance
        .insert(aiMentorTeacherConfigurations)
        .values({ ...teacher, configurationId });
    if (roleplay)
      await dbInstance
        .insert(aiMentorRoleplayConfigurations)
        .values({ ...roleplay, configurationId });
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
    const conditions = [
      and(
        eq(scormPackages.entityType, SCORM_PACKAGE_ENTITY_TYPE.COURSE),
        eq(scormPackages.entityId, params.targetCourseId),
      ),
    ];

    if (params.targetLessonIds.length) {
      conditions.push(
        and(
          eq(scormPackages.entityType, SCORM_PACKAGE_ENTITY_TYPE.LESSON),
          inArray(scormPackages.entityId, params.targetLessonIds),
        ),
      );
    }

    await this.db.delete(scormPackages).where(or(...conditions));
  }

  async createScormPackage(values: ScormPackageInsert) {
    await this.db.insert(scormPackages).values(values);
  }

  async createScormSco(values: ScormScoInsert) {
    await this.db.insert(scormScos).values(values);
  }
}
