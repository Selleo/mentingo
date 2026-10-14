import { Inject, Injectable } from "@nestjs/common";
import { ENTITY_TYPES, SCORM_PACKAGE_ENTITY_TYPE, type LocalizedText } from "@repo/shared";
import { and, asc, eq, getTableColumns, inArray, sql } from "drizzle-orm";

import { DatabasePg, type UUIDType } from "src/common";
import { buildJsonbField } from "src/common/helpers/sqlHelpers";
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
  docChunks,
  documents,
  documentToAiMentorLesson,
  lessons,
  learningPathCourses,
  learningPaths,
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
  userDetails,
  users,
} from "src/storage/schema";

import type { CourseSelect } from "src/course-transfer/types/course-transfer-graph.types";

@Injectable()
export class CourseTransferSnapshotRepository {
  constructor(
    @Inject(DB) private readonly db: DatabasePg,
    @Inject(DB_ADMIN) private readonly dbAdmin: DatabasePg,
    private readonly localizationService: LocalizationService,
  ) {}

  async getSourceCourse(courseId: UUIDType) {
    const [course] = await this.db
      .select({ ...getTableColumns(courses) })
      .from(courses)
      .where(eq(courses.id, courseId))
      .limit(1);

    return course;
  }

  async getCourseAuthorMetadata(authorId: UUIDType) {
    const [author] = await this.db
      .select({
        authorId: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        profilePictureReference: users.avatarReference,
        jobTitle: userDetails.jobTitle,
        description: userDetails.description,
      })
      .from(users)
      .leftJoin(userDetails, eq(userDetails.userId, users.id))
      .where(eq(users.id, authorId))
      .limit(1);

    return author;
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

  async getSourceOptions(questionIds: UUIDType[]) {
    if (!questionIds.length) return [];

    return this.db
      .select({
        id: assessmentQuestionChoiceOptions.id,
        questionId: assessmentQuestionChoiceOptions.questionId,
        optionText: buildJsonbField<LocalizedText>(
          assessmentQuestionChoiceOptions.language,
          assessmentQuestionChoiceOptions.label,
        ),
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

  inReadOnlyTransaction<T>(callback: (transaction: DatabasePg) => Promise<T>): Promise<T> {
    return this.dbAdmin.transaction(callback, {
      isolationLevel: "repeatable read",
      accessMode: "read only",
    });
  }

  async findSourceLearningPath(
    sourceTenantId: UUIDType,
    learningPathId: UUIDType,
    transaction: DatabasePg,
  ) {
    const [learningPath] = await transaction
      .select({ ...getTableColumns(learningPaths) })
      .from(learningPaths)
      .where(and(eq(learningPaths.id, learningPathId), eq(learningPaths.tenantId, sourceTenantId)))
      .limit(1);

    return learningPath;
  }

  async findSourceLearningPathCourseLinks(
    sourceTenantId: UUIDType,
    learningPathId: UUIDType,
    transaction: DatabasePg,
  ) {
    return transaction
      .select({
        id: learningPathCourses.id,
        learningPathId: learningPathCourses.learningPathId,
        courseId: learningPathCourses.courseId,
        displayOrder: learningPathCourses.displayOrder,
        createdAt: learningPathCourses.createdAt,
        updatedAt: learningPathCourses.updatedAt,
      })
      .from(learningPathCourses)
      .innerJoin(
        courses,
        and(eq(courses.id, learningPathCourses.courseId), eq(courses.tenantId, sourceTenantId)),
      )
      .where(eq(learningPathCourses.learningPathId, learningPathId))
      .orderBy(learningPathCourses.displayOrder);
  }
}
