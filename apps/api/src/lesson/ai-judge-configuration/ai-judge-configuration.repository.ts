import { Inject, Injectable } from "@nestjs/common";
import { and, asc, eq, inArray, type SQL } from "drizzle-orm";

import { DatabasePg } from "src/common";
import { buildJsonbField, deleteJsonbField, setJsonbField } from "src/common/helpers/sqlHelpers";
import { LocalizationService } from "src/localization/localization.service";
import { DB } from "src/storage/db/db.providers";
import {
  aiJudgeBlockingErrors,
  aiJudgeConfigurations,
  aiJudgeCriteria,
  aiJudgeScoreGuidance,
  aiMentorLessons,
  chapters,
  courses,
  lessons,
} from "src/storage/schema";

import type {
  AiJudgeBlockingErrorInput,
  AiJudgeCriterionInput,
  AiJudgeScoreGuidanceInput,
} from "./ai-judge-configuration.schema";
import type {
  AiJudgeBlockingErrorLanguageRead,
  AiJudgeConfigurationLanguageRead,
  AiJudgeCriterionLanguageRead,
  AiJudgeGenerationAuthoringContext,
  AiJudgeLessonContext,
  AiJudgeScoreGuidanceLanguageRead,
} from "./ai-judge-configuration.types";
import type { LocalizedText, SupportedLanguages } from "@repo/shared";
import type { UUIDType } from "src/common";

@Injectable()
export class AiJudgeConfigurationRepository {
  constructor(
    @Inject(DB) private readonly db: DatabasePg,
    private readonly localizationService: LocalizationService,
  ) {}

  async findLessonContext(lessonId: UUIDType): Promise<AiJudgeLessonContext | undefined> {
    const [context] = await this.db
      .select({
        courseId: courses.id,
        lessonId: lessons.id,
        lessonType: lessons.type,
        aiMentorLessonId: aiMentorLessons.id,
        configurationId: aiJudgeConfigurations.id,
        baseLanguage: courses.baseLanguage,
        availableLocales: courses.availableLocales,
      })
      .from(lessons)
      .innerJoin(chapters, eq(chapters.id, lessons.chapterId))
      .innerJoin(courses, eq(courses.id, chapters.courseId))
      .leftJoin(aiMentorLessons, eq(aiMentorLessons.lessonId, lessons.id))
      .leftJoin(
        aiJudgeConfigurations,
        eq(aiJudgeConfigurations.aiMentorLessonId, aiMentorLessons.id),
      )
      .where(eq(lessons.id, lessonId));

    return context;
  }

  async findCourseAuthoringContext(
    courseId: UUIDType,
  ): Promise<AiJudgeGenerationAuthoringContext | undefined> {
    const [context] = await this.db
      .select({
        courseId: courses.id,
        baseLanguage: courses.baseLanguage,
      })
      .from(courses)
      .where(eq(courses.id, courseId));

    return context;
  }

  async getConfigurationGraph(configurationId: UUIDType, dbInstance: DatabasePg = this.db) {
    const [configuration] = await dbInstance
      .select()
      .from(aiJudgeConfigurations)
      .where(eq(aiJudgeConfigurations.id, configurationId));

    if (!configuration) return undefined;

    const criteria = await dbInstance
      .select()
      .from(aiJudgeCriteria)
      .where(eq(aiJudgeCriteria.configurationId, configurationId))
      .orderBy(asc(aiJudgeCriteria.createdAt));

    const criterionIds = criteria.map(({ id }) => id);
    const scoreGuidance = criterionIds.length
      ? await dbInstance
          .select()
          .from(aiJudgeScoreGuidance)
          .where(inArray(aiJudgeScoreGuidance.criterionId, criterionIds))
          .orderBy(asc(aiJudgeScoreGuidance.score), asc(aiJudgeScoreGuidance.createdAt))
      : [];

    const blockingErrors = await dbInstance
      .select()
      .from(aiJudgeBlockingErrors)
      .where(eq(aiJudgeBlockingErrors.configurationId, configurationId))
      .orderBy(asc(aiJudgeBlockingErrors.createdAt));

    return { configuration, criteria, scoreGuidance, blockingErrors };
  }

  async getConfigurationsForCourse(courseId: UUIDType) {
    return this.db
      .select({
        id: aiJudgeConfigurations.id,
        taskGoal: aiJudgeConfigurations.taskGoal,
        courseTitle: courses.title,
        lessonTitle: lessons.title,
        lessonDescription: lessons.description,
      })
      .from(aiJudgeConfigurations)
      .innerJoin(aiMentorLessons, eq(aiMentorLessons.id, aiJudgeConfigurations.aiMentorLessonId))
      .innerJoin(lessons, eq(lessons.id, aiMentorLessons.lessonId))
      .innerJoin(chapters, eq(chapters.id, lessons.chapterId))
      .innerJoin(courses, eq(courses.id, chapters.courseId))
      .where(eq(courses.id, courseId))
      .orderBy(asc(chapters.displayOrder), asc(lessons.displayOrder));
  }

  async getCriteriaForCourse(courseId: UUIDType) {
    return this.db
      .select({
        id: aiJudgeCriteria.id,
        title: aiJudgeCriteria.title,
        expectedBehavior: aiJudgeCriteria.expectedBehavior,
        maxScore: aiJudgeCriteria.maxScore,
        taskGoal: aiJudgeConfigurations.taskGoal,
        courseTitle: courses.title,
        lessonTitle: lessons.title,
        lessonDescription: lessons.description,
      })
      .from(aiJudgeCriteria)
      .innerJoin(
        aiJudgeConfigurations,
        eq(aiJudgeConfigurations.id, aiJudgeCriteria.configurationId),
      )
      .innerJoin(aiMentorLessons, eq(aiMentorLessons.id, aiJudgeConfigurations.aiMentorLessonId))
      .innerJoin(lessons, eq(lessons.id, aiMentorLessons.lessonId))
      .innerJoin(chapters, eq(chapters.id, lessons.chapterId))
      .innerJoin(courses, eq(courses.id, chapters.courseId))
      .where(eq(courses.id, courseId))
      .orderBy(
        asc(chapters.displayOrder),
        asc(lessons.displayOrder),
        asc(aiJudgeCriteria.createdAt),
      );
  }

  async getScoreGuidanceForCourse(courseId: UUIDType) {
    return this.db
      .select({
        id: aiJudgeScoreGuidance.id,
        description: aiJudgeScoreGuidance.description,
        example: aiJudgeScoreGuidance.example,
        score: aiJudgeScoreGuidance.score,
        criterionTitle: aiJudgeCriteria.title,
        criterionExpectedBehavior: aiJudgeCriteria.expectedBehavior,
        criterionMaxScore: aiJudgeCriteria.maxScore,
        taskGoal: aiJudgeConfigurations.taskGoal,
        courseTitle: courses.title,
        lessonTitle: lessons.title,
        lessonDescription: lessons.description,
      })
      .from(aiJudgeScoreGuidance)
      .innerJoin(aiJudgeCriteria, eq(aiJudgeCriteria.id, aiJudgeScoreGuidance.criterionId))
      .innerJoin(
        aiJudgeConfigurations,
        eq(aiJudgeConfigurations.id, aiJudgeCriteria.configurationId),
      )
      .innerJoin(aiMentorLessons, eq(aiMentorLessons.id, aiJudgeConfigurations.aiMentorLessonId))
      .innerJoin(lessons, eq(lessons.id, aiMentorLessons.lessonId))
      .innerJoin(chapters, eq(chapters.id, lessons.chapterId))
      .innerJoin(courses, eq(courses.id, chapters.courseId))
      .where(eq(courses.id, courseId))
      .orderBy(
        asc(chapters.displayOrder),
        asc(lessons.displayOrder),
        asc(aiJudgeCriteria.createdAt),
        asc(aiJudgeScoreGuidance.score),
        asc(aiJudgeScoreGuidance.createdAt),
      );
  }

  async getBlockingErrorsForCourse(courseId: UUIDType) {
    return this.db
      .select({
        id: aiJudgeBlockingErrors.id,
        description: aiJudgeBlockingErrors.description,
        taskGoal: aiJudgeConfigurations.taskGoal,
        courseTitle: courses.title,
        lessonTitle: lessons.title,
        lessonDescription: lessons.description,
      })
      .from(aiJudgeBlockingErrors)
      .innerJoin(
        aiJudgeConfigurations,
        eq(aiJudgeConfigurations.id, aiJudgeBlockingErrors.configurationId),
      )
      .innerJoin(aiMentorLessons, eq(aiMentorLessons.id, aiJudgeConfigurations.aiMentorLessonId))
      .innerJoin(lessons, eq(lessons.id, aiMentorLessons.lessonId))
      .innerJoin(chapters, eq(chapters.id, lessons.chapterId))
      .innerJoin(courses, eq(courses.id, chapters.courseId))
      .where(eq(courses.id, courseId))
      .orderBy(
        asc(chapters.displayOrder),
        asc(lessons.displayOrder),
        asc(aiJudgeBlockingErrors.createdAt),
      );
  }

  async getConfigurationInLanguage(
    configurationId: UUIDType,
    language: SupportedLanguages,
  ): Promise<AiJudgeConfigurationLanguageRead[]> {
    return this.db
      .select({
        id: aiJudgeConfigurations.id,
        aiMentorLessonId: aiJudgeConfigurations.aiMentorLessonId,
        taskGoal: this.localizationService.getFieldByLanguage(
          aiJudgeConfigurations.taskGoal,
          language,
        ),
        passingThresholdPercent: aiJudgeConfigurations.passingThresholdPercent,
      })
      .from(aiJudgeConfigurations)
      .where(eq(aiJudgeConfigurations.id, configurationId));
  }

  async getCriteriaInLanguage(
    configurationId: UUIDType,
    language: SupportedLanguages,
  ): Promise<AiJudgeCriterionLanguageRead[]> {
    return this.db
      .select({
        id: aiJudgeCriteria.id,
        configurationId: aiJudgeCriteria.configurationId,
        title: this.localizationService.getFieldByLanguage(aiJudgeCriteria.title, language),
        expectedBehavior: this.localizationService.getFieldByLanguage(
          aiJudgeCriteria.expectedBehavior,
          language,
        ),
        maxScore: aiJudgeCriteria.maxScore,
      })
      .from(aiJudgeCriteria)
      .where(eq(aiJudgeCriteria.configurationId, configurationId))
      .orderBy(asc(aiJudgeCriteria.createdAt));
  }

  async getScoreGuidanceInLanguage(
    criterionIds: UUIDType[],
    language: SupportedLanguages,
  ): Promise<AiJudgeScoreGuidanceLanguageRead[]> {
    return this.db
      .select({
        id: aiJudgeScoreGuidance.id,
        criterionId: aiJudgeScoreGuidance.criterionId,
        score: aiJudgeScoreGuidance.score,
        description: this.localizationService.getFieldByLanguage(
          aiJudgeScoreGuidance.description,
          language,
        ),
        example: this.localizationService.getFieldByLanguage(
          aiJudgeScoreGuidance.example,
          language,
        ),
      })
      .from(aiJudgeScoreGuidance)
      .where(inArray(aiJudgeScoreGuidance.criterionId, criterionIds))
      .orderBy(asc(aiJudgeScoreGuidance.score), asc(aiJudgeScoreGuidance.createdAt));
  }

  async getBlockingErrorsInLanguage(
    configurationId: UUIDType,
    language: SupportedLanguages,
  ): Promise<AiJudgeBlockingErrorLanguageRead[]> {
    return this.db
      .select({
        id: aiJudgeBlockingErrors.id,
        configurationId: aiJudgeBlockingErrors.configurationId,
        description: this.localizationService.getFieldByLanguage(
          aiJudgeBlockingErrors.description,
          language,
        ),
      })
      .from(aiJudgeBlockingErrors)
      .where(eq(aiJudgeBlockingErrors.configurationId, configurationId))
      .orderBy(asc(aiJudgeBlockingErrors.createdAt));
  }

  async createConfiguration(
    aiMentorLessonId: UUIDType,
    data: { taskGoal: string; passingThresholdPercent: number },
    language: SupportedLanguages,
    dbInstance: DatabasePg = this.db,
  ) {
    const [configuration] = await dbInstance
      .insert(aiJudgeConfigurations)
      .values({
        aiMentorLessonId,
        taskGoal: buildJsonbField(language, data.taskGoal),
        passingThresholdPercent: data.passingThresholdPercent,
      })
      .returning();

    return configuration;
  }

  async updateConfiguration(
    configurationId: UUIDType,
    data: { taskGoal: string; passingThresholdPercent: number },
    language: SupportedLanguages,
    dbInstance: DatabasePg = this.db,
  ) {
    const [configuration] = await dbInstance
      .update(aiJudgeConfigurations)
      .set({
        taskGoal: setJsonbField(aiJudgeConfigurations.taskGoal, language, data.taskGoal),
        passingThresholdPercent: data.passingThresholdPercent,
      })
      .where(eq(aiJudgeConfigurations.id, configurationId))
      .returning();

    return configuration;
  }

  async createCriterion(
    configurationId: UUIDType,
    data: Omit<AiJudgeCriterionInput, "id" | "scoreGuidance">,
    language: SupportedLanguages,
    dbInstance: DatabasePg = this.db,
  ) {
    const [criterion] = await dbInstance
      .insert(aiJudgeCriteria)
      .values({
        configurationId,
        maxScore: data.maxScore,
        title: buildJsonbField(language, data.title),
        expectedBehavior: buildJsonbField(language, data.expectedBehavior),
      })
      .returning();

    return criterion;
  }

  async updateCriterion(
    configurationId: UUIDType,
    criterionId: UUIDType,
    data: Omit<AiJudgeCriterionInput, "id" | "scoreGuidance">,
    language: SupportedLanguages,
    dbInstance: DatabasePg = this.db,
  ) {
    const [criterion] = await dbInstance
      .update(aiJudgeCriteria)
      .set({
        maxScore: data.maxScore,
        title: setJsonbField(aiJudgeCriteria.title, language, data.title),
        expectedBehavior: setJsonbField(
          aiJudgeCriteria.expectedBehavior,
          language,
          data.expectedBehavior,
        ),
      })
      .where(
        and(
          eq(aiJudgeCriteria.id, criterionId),
          eq(aiJudgeCriteria.configurationId, configurationId),
        ),
      )
      .returning();

    return criterion;
  }

  async deleteCriteria(
    configurationId: UUIDType,
    criterionIds: UUIDType[],
    dbInstance: DatabasePg = this.db,
  ) {
    if (!criterionIds.length) return;
    await dbInstance
      .delete(aiJudgeCriteria)
      .where(
        and(
          eq(aiJudgeCriteria.configurationId, configurationId),
          inArray(aiJudgeCriteria.id, criterionIds),
        ),
      );
  }

  async createScoreGuidance(
    criterionId: UUIDType,
    data: Omit<AiJudgeScoreGuidanceInput, "id">,
    language: SupportedLanguages,
    dbInstance: DatabasePg = this.db,
  ) {
    const [guidance] = await dbInstance
      .insert(aiJudgeScoreGuidance)
      .values({
        criterionId,
        score: data.score,
        description: buildJsonbField(language, data.description),
        example: data.example == null ? null : buildJsonbField(language, data.example),
      })
      .returning();

    return guidance;
  }

  async updateScoreGuidance(
    guidanceId: UUIDType,
    data: Omit<AiJudgeScoreGuidanceInput, "id">,
    language: SupportedLanguages,
    dbInstance: DatabasePg = this.db,
  ) {
    const [guidance] = await dbInstance
      .update(aiJudgeScoreGuidance)
      .set({
        score: data.score,
        description: setJsonbField(aiJudgeScoreGuidance.description, language, data.description),
        example:
          data.example == null
            ? deleteJsonbField(aiJudgeScoreGuidance.example, language)
            : setJsonbField(aiJudgeScoreGuidance.example, language, data.example),
      })
      .where(eq(aiJudgeScoreGuidance.id, guidanceId))
      .returning();

    return guidance;
  }

  async stageScoreGuidanceScores(guidanceIds: UUIDType[], dbInstance: DatabasePg = this.db) {
    for (const [index, guidanceId] of guidanceIds.entries())
      await dbInstance
        .update(aiJudgeScoreGuidance)
        .set({ score: -(index + 1) })
        .where(eq(aiJudgeScoreGuidance.id, guidanceId));
  }

  async deleteScoreGuidance(guidanceIds: UUIDType[], dbInstance: DatabasePg = this.db) {
    if (!guidanceIds.length) return;
    await dbInstance
      .delete(aiJudgeScoreGuidance)
      .where(inArray(aiJudgeScoreGuidance.id, guidanceIds));
  }

  async createBlockingError(
    configurationId: UUIDType,
    data: Omit<AiJudgeBlockingErrorInput, "id">,
    language: SupportedLanguages,
    dbInstance: DatabasePg = this.db,
  ) {
    const [blockingError] = await dbInstance
      .insert(aiJudgeBlockingErrors)
      .values({
        configurationId,
        description: buildJsonbField(language, data.description),
      })
      .returning();

    return blockingError;
  }

  async updateBlockingError(
    configurationId: UUIDType,
    blockingErrorId: UUIDType,
    data: Omit<AiJudgeBlockingErrorInput, "id">,
    language: SupportedLanguages,
    dbInstance: DatabasePg = this.db,
  ) {
    const [blockingError] = await dbInstance
      .update(aiJudgeBlockingErrors)
      .set({
        description: setJsonbField(aiJudgeBlockingErrors.description, language, data.description),
      })
      .where(
        and(
          eq(aiJudgeBlockingErrors.id, blockingErrorId),
          eq(aiJudgeBlockingErrors.configurationId, configurationId),
        ),
      )
      .returning();

    return blockingError;
  }

  async deleteBlockingErrors(
    configurationId: UUIDType,
    blockingErrorIds: UUIDType[],
    dbInstance: DatabasePg = this.db,
  ) {
    if (!blockingErrorIds.length) return;
    await dbInstance
      .delete(aiJudgeBlockingErrors)
      .where(
        and(
          eq(aiJudgeBlockingErrors.configurationId, configurationId),
          inArray(aiJudgeBlockingErrors.id, blockingErrorIds),
        ),
      );
  }

  async updateTaskGoalTranslation(
    configurationId: UUIDType,
    language: SupportedLanguages,
    taskGoal: string,
    dbInstance: DatabasePg,
  ) {
    return dbInstance
      .update(aiJudgeConfigurations)
      .set({ taskGoal: setJsonbField(aiJudgeConfigurations.taskGoal, language, taskGoal) })
      .where(eq(aiJudgeConfigurations.id, configurationId));
  }

  async updateCriterionTranslation(
    configurationId: UUIDType,
    criterionId: UUIDType,
    language: SupportedLanguages,
    data: { title?: string; expectedBehavior?: string },
    dbInstance: DatabasePg,
  ) {
    const [criterion] = await dbInstance
      .update(aiJudgeCriteria)
      .set({
        title:
          data.title === undefined
            ? undefined
            : setJsonbField(aiJudgeCriteria.title, language, data.title),
        expectedBehavior:
          data.expectedBehavior === undefined
            ? undefined
            : setJsonbField(aiJudgeCriteria.expectedBehavior, language, data.expectedBehavior),
      })
      .where(
        and(
          eq(aiJudgeCriteria.id, criterionId),
          eq(aiJudgeCriteria.configurationId, configurationId),
        ),
      )
      .returning({ id: aiJudgeCriteria.id });

    return criterion;
  }

  async updateScoreGuidanceTranslation(
    configurationId: UUIDType,
    guidanceId: UUIDType,
    language: SupportedLanguages,
    data: { description?: string; example?: string | null },
    dbInstance: DatabasePg,
  ) {
    const update: {
      description?: LocalizedText | SQL;
      example?: LocalizedText | SQL | null;
    } = {};

    if (data.description !== undefined)
      update.description = setJsonbField(
        aiJudgeScoreGuidance.description,
        language,
        data.description,
      );

    if (data.example === null)
      update.example = deleteJsonbField(aiJudgeScoreGuidance.example, language);

    if (data.example !== undefined && data.example !== null)
      update.example = setJsonbField(aiJudgeScoreGuidance.example, language, data.example);

    const [guidance] = await dbInstance
      .update(aiJudgeScoreGuidance)
      .set(update)
      .where(
        and(
          eq(aiJudgeScoreGuidance.id, guidanceId),
          inArray(
            aiJudgeScoreGuidance.criterionId,
            dbInstance
              .select({ id: aiJudgeCriteria.id })
              .from(aiJudgeCriteria)
              .where(eq(aiJudgeCriteria.configurationId, configurationId)),
          ),
        ),
      )
      .returning({ id: aiJudgeScoreGuidance.id });

    return guidance;
  }

  async updateBlockingErrorTranslation(
    configurationId: UUIDType,
    blockingErrorId: UUIDType,
    language: SupportedLanguages,
    description: string,
    dbInstance: DatabasePg,
  ) {
    const [blockingError] = await dbInstance
      .update(aiJudgeBlockingErrors)
      .set({
        description: setJsonbField(aiJudgeBlockingErrors.description, language, description),
      })
      .where(
        and(
          eq(aiJudgeBlockingErrors.id, blockingErrorId),
          eq(aiJudgeBlockingErrors.configurationId, configurationId),
        ),
      )
      .returning({ id: aiJudgeBlockingErrors.id });

    return blockingError;
  }
}
