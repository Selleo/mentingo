import { Inject, Injectable } from "@nestjs/common";
import { and, eq, gte, inArray, lte, sql } from "drizzle-orm";

import { DatabasePg, type UUIDType } from "src/common";
import {
  aiMentorLessons,
  chapters,
  lessons,
  questionAnswerOptions,
  questions,
  studentQuestionAnswers,
} from "src/storage/schema";

import { LESSON_TYPES } from "../lesson.type";

import type {
  AdminOptionBody,
  AdminQuestionBody,
  CreateAiMentorLessonBody,
  CreateLessonBody,
  CreateQuizLessonBody,
  UpdateAiMentorLessonBody,
  UpdateLessonBody,
  UpdateQuizLessonBody,
} from "../lesson.schema";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import type * as schema from "src/storage/schema";

@Injectable()
export class AdminLessonRepository {
  constructor(@Inject("DB") private readonly db: DatabasePg) {}

  async getLesson(id: UUIDType) {
    return await this.db.select().from(lessons).where(eq(lessons.id, id));
  }

  async createLessonForChapter(data: CreateLessonBody) {
    const [lesson] = await this.db.insert(lessons).values(data).returning();
    return lesson;
  }

  async updateLesson(id: UUIDType, data: UpdateLessonBody) {
    const [updatedLesson] = await this.db
      .update(lessons)
      .set(data)
      .where(eq(lessons.id, id))
      .returning();
    return updatedLesson;
  }

  async updateQuizLessonWithQuestionsAndOptions(
    id: UUIDType,
    data: UpdateQuizLessonBody,
    dbInstance: PostgresJsDatabase<typeof schema> = this.db,
  ) {
    return dbInstance
      .update(lessons)
      .set({
        title: data.title,
        type: LESSON_TYPES.QUIZ,
        description: data.description,
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
    dbInstance: PostgresJsDatabase<typeof schema> = this.db,
  ) {
    const [lesson] = await dbInstance
      .insert(lessons)
      .values({
        title: data.title,
        type: LESSON_TYPES.QUIZ,
        description: data.description,
        chapterId: data?.chapterId,
        displayOrder,
        thresholdScore: data.thresholdScore,
        attemptsLimit: data.attemptsLimit,
        quizCooldownInHours: data.quizCooldownInHours,
      })
      .returning();

    return lesson;
  }

  async createAiMentorLesson(
    data: CreateAiMentorLessonBody,
    displayOrder: number,
    dbInstance: PostgresJsDatabase<typeof schema> = this.db,
  ) {
    const [lesson] = await dbInstance
      .insert(lessons)
      .values({
        title: data.title,
        type: LESSON_TYPES.AI_MENTOR,
        chapterId: data?.chapterId,
        displayOrder,
        isExternal: true,
      })
      .returning();

    return lesson;
  }

  async updateAiMentorLesson(
    id: UUIDType,
    data: UpdateAiMentorLessonBody,
    dbInstance: PostgresJsDatabase<typeof schema> = this.db,
  ) {
    return dbInstance.update(lessons).set(data).where(eq(lessons.id, id)).returning();
  }

  async updateAiMentorLessonData(
    lessonId: UUIDType,
    data: {
      aiMentorInstructions: string;
      completionConditions: string;
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
    },
    dbInstance: PostgresJsDatabase<typeof schema> = this.db,
  ) {
    return dbInstance.insert(aiMentorLessons).values(data).returning();
  }

  async getQuestions(conditions: any[]) {
    return this.db
      .select()
      .from(questions)
      .where(and(...conditions));
  }

  async getQuestionAnswers(questionId: UUIDType, trx?: PostgresJsDatabase<typeof schema>) {
    const dbInstance = trx ?? this.db;

    return dbInstance
      .select({
        id: questionAnswerOptions.id,
        optionText: questionAnswerOptions.optionText,
        isCorrect: questionAnswerOptions.isCorrect,
        displayOrder: questionAnswerOptions.displayOrder,
        questionId: questionAnswerOptions.questionId,
      })
      .from(questionAnswerOptions)
      .where(eq(questionAnswerOptions.questionId, questionId));
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

  async getQuestionAnswerOptions(questionId: UUIDType, trx?: PostgresJsDatabase<typeof schema>) {
    const dbInstance = trx ?? this.db;

    return dbInstance
      .select()
      .from(questionAnswerOptions)
      .where(eq(questionAnswerOptions.questionId, questionId));
  }

  async getQuestionStudentAnswers(
    questionId: UUIDType,
    dbInstance: PostgresJsDatabase<typeof schema> = this.db,
  ) {
    return dbInstance
      .select()
      .from(studentQuestionAnswers)
      .where(eq(studentQuestionAnswers.questionId, questionId));
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
    return trx.select({ id: questions.id }).from(questions).where(eq(questions.lessonId, lessonId));
  }

  async getExistingOptions(questionId: UUIDType, trx: PostgresJsDatabase<typeof schema>) {
    const existingOptions = await trx
      .select({ id: questionAnswerOptions.id })
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
      .set(optionData)
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
      })
      .onConflictDoUpdate({
        target: questions.id,
        set: {
          lessonId,
          authorId,
          ...questionData,
        },
      })
      .returning({ id: questions.id });

    return result.id;
  }

  async removeQuestionAnswerOptions(
    questionId: UUIDType,
    idsToDelete: UUIDType[],
    dbInstance: PostgresJsDatabase<typeof schema> = this.db,
  ) {
    return dbInstance
      .delete(questionAnswerOptions)
      .where(
        and(
          eq(questionAnswerOptions.questionId, questionId),
          inArray(questionAnswerOptions.id, idsToDelete),
        ),
      );
  }

  async upsertQuestionAnswerOptions(
    questionId: UUIDType,
    option: {
      id?: UUIDType;
      optionText: string;
      isCorrect: boolean;
      displayOrder: number;
    },
    dbInstance: PostgresJsDatabase<typeof schema> = this.db,
  ) {
    return dbInstance
      .insert(questionAnswerOptions)
      .values({
        id: option.id,
        questionId,
        optionText: option.optionText,
        isCorrect: option.isCorrect,
        displayOrder: option.displayOrder,
      })
      .onConflictDoUpdate({
        target: questionAnswerOptions.id,
        set: {
          optionText: option.optionText,
          isCorrect: option.isCorrect,
          displayOrder: option.displayOrder,
        },
      });
  }
}
