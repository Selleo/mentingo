import { Inject, Injectable } from "@nestjs/common";
import { and, eq, getTableColumns, gte, inArray, lte, sql } from "drizzle-orm";

import { DatabasePg, type UUIDType } from "src/common";
import { buildJsonbField, setJsonbField } from "src/common/helpers/sqlHelpers";
import { LocalizationService } from "src/localization/localization.service";
import { ENTITY_TYPE } from "src/localization/localization.types";
import {
  aiMentorLessons,
  chapters,
  courses,
  lessons,
  questionAnswerOptions,
  questions,
  resourceEntity,
  resources,
} from "src/storage/schema";
import { settingsToJSONBuildObject } from "src/utils/settings-to-json-build-object";

import { LESSON_TYPES } from "../lesson.type";

import type {
  AdminOptionBody,
  AdminQuestionBody,
  CreateAiMentorLessonBody,
  CreateLessonBody,
  CreateQuizLessonBody,
  UpdateLessonBody,
  UpdateQuizLessonBody,
} from "../lesson.schema";
import type { AiMentorType, SupportedLanguages } from "@repo/shared";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import type { LessonActivityLogOption, LessonActivityLogQuestion } from "src/activity-logs/types";
import type { QuestionType } from "src/questions/schema/question.types";
import type * as schema from "src/storage/schema";

@Injectable()
export class AdminLessonRepository {
  constructor(
    @Inject("DB") private readonly db: DatabasePg,
    private readonly localizationService: LocalizationService,
  ) {}

  async getLesson(id: UUIDType, language?: SupportedLanguages) {
    return this.db
      .select({
        ...getTableColumns(lessons),
        title: this.localizationService.getLocalizedSqlField(lessons.title, language),
        description: this.localizationService.getLocalizedSqlField(lessons.description, language),
        aiMentorInstructions: aiMentorLessons.aiMentorInstructions,
        aiMentorCompletionConditions: aiMentorLessons.completionConditions,
        aiMentorName: aiMentorLessons.name,
        aiMentorAvatarReference: aiMentorLessons.avatarReference,
        aiMentorType: aiMentorLessons.type,
      })
      .from(lessons)
      .innerJoin(chapters, eq(chapters.id, lessons.chapterId))
      .innerJoin(courses, eq(courses.id, chapters.courseId))
      .leftJoin(aiMentorLessons, eq(aiMentorLessons.lessonId, lessons.id))
      .where(eq(lessons.id, id));
  }

  async createLessonForChapter(data: CreateLessonBody, language: SupportedLanguages) {
    const [lesson] = await this.db
      .insert(lessons)
      .values({
        ...data,
        title: buildJsonbField(language, data.title),
        description: buildJsonbField(language, data.description),
      })
      .returning({
        ...getTableColumns(lessons),
        title: sql<string>`lessons.title->>${language}`,
        description: sql<string>`lessons.description->>${language}`,
      });
    return lesson;
  }

  async updateLesson(id: UUIDType, data: UpdateLessonBody) {
    const [updatedLesson] = await this.db
      .update(lessons)
      .set({
        ...data,
        title: setJsonbField(lessons.title, data.language, data.title),
        description: setJsonbField(lessons.description, data.language, data.description),
      })
      .where(eq(lessons.id, id))
      .returning({
        ...getTableColumns(lessons),
        title: sql<string>`lessons.title->>${data.language}`,
        description: sql<string>`lessons.description->>${data.language}`,
      });

    return updatedLesson;
  }

  async getQuestionsWithOptions(
    lessonId: UUIDType,
    language: SupportedLanguages,
    dbInstance: PostgresJsDatabase<typeof schema> = this.db,
  ): Promise<
    Array<
      LessonActivityLogQuestion & {
        options?: LessonActivityLogOption[];
      }
    >
  > {
    const questionsList = await dbInstance
      .select({
        id: questions.id,
        type: sql<QuestionType>`${questions.type}`,
        title: this.localizationService.getLocalizedSqlField(questions.title, language),
        description: this.localizationService.getLocalizedSqlField(questions.description, language),
        solutionExplanation: this.localizationService.getLocalizedSqlField(
          questions.solutionExplanation,
          language,
        ),
        displayOrder: questions.displayOrder,
        photoS3Key: questions.photoS3Key,
      })
      .from(questions)
      .innerJoin(lessons, eq(questions.lessonId, lessons.id))
      .innerJoin(chapters, eq(lessons.chapterId, chapters.id))
      .innerJoin(courses, eq(chapters.courseId, courses.id))
      .where(eq(questions.lessonId, lessonId))
      .orderBy(questions.displayOrder);

    if (questionsList.length === 0) return [];

    const options = await dbInstance
      .select({
        id: questionAnswerOptions.id,
        questionId: questionAnswerOptions.questionId,
        optionText: this.localizationService.getLocalizedSqlField(
          questionAnswerOptions.optionText,
          language,
        ),
        isCorrect: questionAnswerOptions.isCorrect,
        displayOrder: questionAnswerOptions.displayOrder,
        matchedWord: this.localizationService.getLocalizedSqlField(
          questionAnswerOptions.matchedWord,
          language,
        ),
        scaleAnswer: questionAnswerOptions.scaleAnswer,
      })
      .from(questionAnswerOptions)
      .innerJoin(questions, eq(questionAnswerOptions.questionId, questions.id))
      .innerJoin(lessons, eq(questions.lessonId, lessons.id))
      .innerJoin(chapters, eq(lessons.chapterId, chapters.id))
      .innerJoin(courses, eq(chapters.courseId, courses.id))
      .where(
        inArray(
          questionAnswerOptions.questionId,
          questionsList.map((question) => question.id),
        ),
      )
      .orderBy(questionAnswerOptions.displayOrder);

    type QuestionOption = (typeof options)[number];

    const optionsByQuestion = options.reduce<Record<UUIDType, QuestionOption[]>>((acc, option) => {
      acc[option.questionId] = [...(acc[option.questionId] ?? []), option];
      return acc;
    }, {});

    return questionsList.map((question) => ({
      ...question,
      options: (optionsByQuestion[question.id] ?? []).map(
        ({ questionId: _questionId, ...rest }) => rest,
      ),
    }));
  }

  async updateQuizLessonWithQuestionsAndOptions(
    id: UUIDType,
    data: UpdateQuizLessonBody,
    dbInstance: PostgresJsDatabase<typeof schema> = this.db,
  ) {
    return dbInstance
      .update(lessons)
      .set({
        title: setJsonbField(lessons.title, data.language, data.title),
        type: LESSON_TYPES.QUIZ,
        description: setJsonbField(lessons.description, data.language, data.description),
        chapterId: data.chapterId,
        thresholdScore: data.thresholdScore,
        attemptsLimit: data.attemptsLimit,
        quizCooldownInHours: data.quizCooldownInHours,
      })
      .where(eq(lessons.id, id));
  }

  async createQuizLessonWithQuestionsAndOptions(
    data: CreateQuizLessonBody,
    displayOrder: number,
    language: SupportedLanguages,
    dbInstance: PostgresJsDatabase<typeof schema> = this.db,
  ) {
    const [lesson] = await dbInstance
      .insert(lessons)
      .values({
        title: buildJsonbField(language, data.title),
        description: buildJsonbField(language, data.description),
        type: LESSON_TYPES.QUIZ,
        chapterId: data?.chapterId,
        displayOrder,
        thresholdScore: data.thresholdScore,
        attemptsLimit: data.attemptsLimit,
        quizCooldownInHours: data.quizCooldownInHours,
      })
      .returning({
        ...getTableColumns(lessons),
        title: sql<string>`lessons.title->>${language}`,
        description: sql<string>`lessons.description->>${language}`,
      });

    return lesson;
  }

  async createAiMentorLesson(
    data: CreateAiMentorLessonBody,
    displayOrder: number,
    language: SupportedLanguages,
    dbInstance: PostgresJsDatabase<typeof schema> = this.db,
  ) {
    const [lesson] = await dbInstance
      .insert(lessons)
      .values({
        title: buildJsonbField(language, data.title),
        type: LESSON_TYPES.AI_MENTOR,
        chapterId: data?.chapterId,
        displayOrder,
        isExternal: true,
      })
      .returning({
        ...getTableColumns(lessons),
        title: sql<string>`lessons.title->>${language}::text`,
        description: sql<string>`lessons.description->>${language}::text`,
      });

    return lesson;
  }

  async updateAiMentorLesson(
    id: UUIDType,
    data: UpdateLessonBody,
    dbInstance: PostgresJsDatabase<typeof schema> = this.db,
  ) {
    return dbInstance
      .update(lessons)
      .set({
        ...data,
        title: setJsonbField(lessons.title, data.language, data.title),
        description: setJsonbField(lessons.description, data.language, data.description),
      })
      .where(eq(lessons.id, id))
      .returning({
        ...getTableColumns(lessons),
        title: sql<string>`lessons.title->>${data.language}`,
        description: sql<string>`lessons.description->>${data.language}`,
      });
  }

  async updateAiMentorLessonData(
    lessonId: UUIDType,
    data: {
      aiMentorInstructions: string;
      completionConditions: string;
      type: AiMentorType;
      name?: string;
    },
    dbInstance: PostgresJsDatabase<typeof schema> = this.db,
  ) {
    return dbInstance
      .update(aiMentorLessons)
      .set(data)
      .where(eq(aiMentorLessons.lessonId, lessonId));
  }

  async createAiMentorLessonData(
    data: {
      lessonId: UUIDType;
      aiMentorInstructions: string;
      completionConditions: string;
      type: AiMentorType;
      name?: string;
    },
    dbInstance: PostgresJsDatabase<typeof schema> = this.db,
  ) {
    return dbInstance.insert(aiMentorLessons).values(data).returning();
  }

  async getMaxDisplayOrder(chapterId: UUIDType) {
    const [result] = await this.db
      .select({
        maxOrder: sql<number>`COALESCE(max(${lessons.displayOrder}), 0)`,
      })
      .from(lessons)
      .where(eq(lessons.chapterId, chapterId));

    return result.maxOrder;
  }

  async removeLesson(lessonId: UUIDType, dbInstance: PostgresJsDatabase<typeof schema> = this.db) {
    return dbInstance.delete(lessons).where(eq(lessons.id, lessonId)).returning();
  }

  async updateLessonCountForChapter(
    chapterId: UUIDType,
    dbInstance: PostgresJsDatabase<typeof schema> = this.db,
  ) {
    return dbInstance.execute(sql`
      UPDATE ${chapters}
      SET lesson_count = (
        SELECT count(*)
        FROM ${lessons}
        WHERE ${lessons.chapterId} = ${chapters.id}
      )
      WHERE ${chapters.id} = ${chapterId}
    `);
  }

  async updateLessonDisplayOrderAfterRemove(
    chapterId: UUIDType,
    dbInstance: PostgresJsDatabase<typeof schema> = this.db,
  ) {
    return dbInstance.execute(sql`
        WITH ranked_chapters AS (
          SELECT id, row_number() OVER (ORDER BY display_order) AS new_display_order
          FROM ${lessons}
          WHERE chapter_id = ${chapterId}
        )
        UPDATE ${lessons} cc
        SET display_order = rc.new_display_order
        FROM ranked_chapters rc
        WHERE cc.id = rc.id
          AND cc.chapter_id = ${chapterId}
      `);
  }

  async updateLessonDisplayOrder(
    chapterId: UUIDType,
    lessonId: UUIDType,
    newDisplayOrder: number,
    oldDisplayOrder: number,
  ) {
    await this.db
      .update(lessons)
      .set({
        displayOrder: sql`CASE
                WHEN ${eq(lessons.id, lessonId)}
                  THEN ${newDisplayOrder}
                WHEN ${newDisplayOrder < oldDisplayOrder}
                  AND ${gte(lessons.displayOrder, newDisplayOrder)}
                  AND ${lte(lessons.displayOrder, oldDisplayOrder)}
                  THEN ${lessons.displayOrder} + 1
                WHEN ${newDisplayOrder > oldDisplayOrder}
                  AND ${lte(lessons.displayOrder, newDisplayOrder)}
                  AND ${gte(lessons.displayOrder, oldDisplayOrder)}
                  THEN ${lessons.displayOrder} - 1
                ELSE ${lessons.displayOrder}
              END
              `,
      })
      .where(eq(lessons.chapterId, chapterId));
  }

  async getExistingQuestions(lessonId: UUIDType, trx: PostgresJsDatabase<typeof schema>) {
    return trx
      .select({
        id: questions.id,
        type: questions.type,
        displayOrder: questions.displayOrder,
      })
      .from(questions)
      .where(eq(questions.lessonId, lessonId));
  }

  async getExistingOptions(questionId: UUIDType, trx: PostgresJsDatabase<typeof schema>) {
    const existingOptions = await trx
      .select({
        id: questionAnswerOptions.id,
        displayOrder: questionAnswerOptions.displayOrder,
        isCorrect: questionAnswerOptions.isCorrect,
        matchedWord: questionAnswerOptions.matchedWord,
        scaleAnswer: questionAnswerOptions.scaleAnswer,
      })
      .from(questionAnswerOptions)
      .where(eq(questionAnswerOptions.questionId, questionId));

    return { existingOptions };
  }

  async updateOption(
    optionId: UUIDType,
    optionData: AdminOptionBody,
    trx: PostgresJsDatabase<typeof schema>,
  ) {
    return trx
      .update(questionAnswerOptions)
      .set({
        ...optionData,
        optionText: setJsonbField(
          questionAnswerOptions.optionText,
          optionData.language,
          optionData.optionText,
        ),
        matchedWord: setJsonbField(
          questionAnswerOptions.matchedWord,
          optionData.language,
          optionData.matchedWord,
        ),
      })
      .where(eq(questionAnswerOptions.id, optionId))
      .returning();
  }

  async insertOption(
    questionId: UUIDType,
    optionData: AdminOptionBody,
    trx: PostgresJsDatabase<typeof schema>,
  ) {
    return trx
      .insert(questionAnswerOptions)
      .values({
        questionId,
        ...optionData,
        optionText: buildJsonbField(optionData.language, optionData.optionText),
        matchedWord: buildJsonbField(optionData.language, optionData.matchedWord),
      })
      .returning();
  }

  async deleteOptions(optionIds: UUIDType[], trx: PostgresJsDatabase<typeof schema>) {
    await trx.delete(questionAnswerOptions).where(inArray(questionAnswerOptions.id, optionIds));
  }

  async deleteQuestions(questionsToDelete: UUIDType[], trx: PostgresJsDatabase<typeof schema>) {
    await trx.delete(questions).where(inArray(questions.id, questionsToDelete));
  }

  async deleteQuestionOptions(
    questionsToDelete: UUIDType[],
    trx: PostgresJsDatabase<typeof schema>,
  ) {
    await trx
      .delete(questionAnswerOptions)
      .where(inArray(questionAnswerOptions.questionId, questionsToDelete));
  }

  async upsertQuestion(
    questionData: AdminQuestionBody,
    lessonId: UUIDType,
    authorId: UUIDType,
    trx: PostgresJsDatabase<typeof schema>,
    questionId?: UUIDType,
  ): Promise<UUIDType> {
    const [result] = await trx
      .insert(questions)
      .values({
        id: questionId,
        lessonId,
        authorId,
        ...questionData,
        title: buildJsonbField(questionData.language, questionData.title),
        description: buildJsonbField(questionData.language, questionData.description),
      })
      .onConflictDoUpdate({
        target: questions.id,
        set: {
          lessonId,
          authorId,
          ...questionData,
          title: setJsonbField(questions.title, questionData.language, questionData.title),
          description: setJsonbField(
            questions.description,
            questionData.language,
            questionData.description,
          ),
        },
      })
      .returning({ id: questions.id });

    return result.id;
  }

  async getLessonResourcesForLesson(lessonId: UUIDType, language?: SupportedLanguages) {
    const resourceSelect = language
      ? {
          ...getTableColumns(resources),
          title: sql`COALESCE(${resources.title}->>${language}::text,'')`,
          description: sql`COALESCE(${resources.description}->>${language}::text,'')`,
        }
      : getTableColumns(resources);

    return this.db
      .select({
        ...resourceSelect,
      })
      .from(resourceEntity)
      .innerJoin(resources, eq(resources.id, resourceEntity.resourceId))
      .where(
        and(
          eq(resourceEntity.entityId, lessonId),
          eq(resourceEntity.entityType, ENTITY_TYPE.LESSON),
          eq(resources.archived, false),
        ),
      )
      .orderBy(resources.createdAt);
  }

  async createLessonResources(
    lessonId: UUIDType,
    data: Array<{
      reference: string;
      contentType?: string;
      metadata?: Record<string, unknown>;
      uploadedById?: UUIDType | null;
    }>,
    trx?: PostgresJsDatabase<typeof schema>,
  ) {
    const dbInstance = trx ?? this.db;

    return dbInstance.transaction(async (tx) => {
      const insertedResources = await tx
        .insert(resources)
        .values(
          data.map((resource) => ({
            reference: resource.reference,
            contentType: resource.contentType ?? "text/html",
            metadata: settingsToJSONBuildObject(resource.metadata ?? {}),
            uploadedBy: resource.uploadedById ?? null,
          })),
        )
        .returning();

      if (!insertedResources.length) return [];

      await tx.insert(resourceEntity).values(
        insertedResources.map((inserted) => ({
          resourceId: inserted.id,
          entityId: lessonId,
          entityType: ENTITY_TYPE.LESSON,
        })),
      );

      return insertedResources;
    });
  }

  async updateLessonResources(
    data: Array<{
      id: UUIDType;
      reference: string;
      contentType?: string;
      metadata?: Record<string, unknown>;
    }>,
    trx?: PostgresJsDatabase<typeof schema>,
  ) {
    const dbInstance = trx ?? this.db;

    return Promise.all(
      data.map((resource) =>
        dbInstance
          .update(resources)
          .set({
            reference: resource.reference,
            contentType: resource.contentType ?? "text/html",
            metadata: settingsToJSONBuildObject(resource.metadata ?? {}),
          })
          .where(eq(resources.id, resource.id))
          .returning(),
      ),
    );
  }

  async deleteLessonResourcesByIds(
    resourceIds: UUIDType[],
    trx?: PostgresJsDatabase<typeof schema>,
  ) {
    if (!resourceIds.length) return [];
    const dbInstance = trx ?? this.db;

    return dbInstance
      .update(resources)
      .set({ archived: true })
      .where(inArray(resources.id, resourceIds))
      .returning();
  }

  async deleteLessonResources(lessonId: UUIDType, trx?: PostgresJsDatabase<typeof schema>) {
    const dbInstance = trx ?? this.db;
    const resourceIds = await dbInstance
      .select({ id: resources.id })
      .from(resourceEntity)
      .innerJoin(resources, eq(resources.id, resourceEntity.resourceId))
      .where(
        and(
          eq(resourceEntity.entityId, lessonId),
          eq(resourceEntity.entityType, ENTITY_TYPE.LESSON),
        ),
      );

    if (!resourceIds.length) return [];

    return dbInstance
      .update(resources)
      .set({ archived: true })
      .where(
        inArray(
          resources.id,
          resourceIds.map((item) => item.id),
        ),
      )
      .returning();
  }

  async getCourseByLesson(lessonId: UUIDType) {
    return this.db
      .select({ ...getTableColumns(courses) })
      .from(lessons)
      .innerJoin(chapters, eq(chapters.id, lessons.chapterId))
      .innerJoin(courses, eq(chapters.courseId, courses.id))
      .where(eq(lessons.id, lessonId));
  }

  async getCourseByChapter(chapterId: UUIDType) {
    return this.db
      .select({ ...getTableColumns(courses) })
      .from(chapters)
      .innerJoin(courses, eq(chapters.courseId, courses.id))
      .where(eq(chapters.id, chapterId));
  }

  async getCourse(courseId: UUIDType) {
    return this.db.select().from(courses).where(eq(courses.id, courseId));
  }

  async updateAiMentorAvatar(lessonId: UUIDType, fileKey: string | null) {
    return this.db
      .update(aiMentorLessons)
      .set({ avatarReference: fileKey })
      .where(eq(aiMentorLessons.lessonId, lessonId));
  }
}
