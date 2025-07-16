import { Inject, Injectable } from "@nestjs/common";
import { and, eq, gte, lte, sql } from "drizzle-orm";

import { DatabasePg, type UUIDType } from "src/common";
import {
  aiMentorLessons,
  chapters,
  courses,
  lessons,
  questionAnswerOptions,
  questions,
} from "src/storage/schema";

import type { UpdateChapterBody } from "../schemas/chapter.schema";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import type {
  AdminLessonWithContentSchema,
  AdminQuestionBody,
  AiMentorBody,
} from "src/lesson/lesson.schema";
import type { LessonTypes } from "src/lesson/lesson.type";
import type * as schema from "src/storage/schema";

@Injectable()
export class AdminChapterRepository {
  constructor(@Inject("DB") private readonly db: DatabasePg) {}

  async getChapterById(chapterId: UUIDType) {
    return await this.db.select().from(chapters).where(eq(chapters.id, chapterId));
  }

  async changeChapterDisplayOrder(
    courseId: UUIDType,
    chapterId: UUIDType,
    oldDisplayOrder: number,
    newDisplayOrder: number,
  ) {
    await this.db.transaction(async (trx) => {
      await trx
        .update(chapters)
        .set({
          displayOrder: sql`CASE
            WHEN ${eq(chapters.id, chapterId)}
              THEN ${newDisplayOrder}
            WHEN ${newDisplayOrder < oldDisplayOrder}
              AND ${gte(chapters.displayOrder, newDisplayOrder)}
              AND ${lte(chapters.displayOrder, oldDisplayOrder)}
              THEN ${chapters.displayOrder} + 1
            WHEN ${newDisplayOrder > oldDisplayOrder}
              AND ${lte(chapters.displayOrder, newDisplayOrder)}
              AND ${gte(chapters.displayOrder, oldDisplayOrder)}
              THEN ${chapters.displayOrder} - 1
            ELSE ${chapters.displayOrder}
          END
          `,
        })
        .where(eq(chapters.courseId, courseId));
    });
  }

  async updateChapterDisplayOrder(courseId: UUIDType, trx?: PostgresJsDatabase<typeof schema>) {
    const dbInstance = trx ?? this.db;

    return await dbInstance.execute(sql`
        WITH ranked_chapters AS (
          SELECT id, row_number() OVER (ORDER BY display_order) AS new_display_order
          FROM ${chapters}
          WHERE course_id = ${courseId}
        )
        UPDATE ${chapters} cc
        SET display_order = rc.new_display_order
        FROM ranked_chapters rc
        WHERE cc.id = rc.id
          AND cc.course_id = ${courseId}
      `);
  }

  async removeChapter(chapterId: UUIDType, trx?: PostgresJsDatabase<typeof schema>) {
    const dbInstance = trx ?? this.db;

    return dbInstance.delete(chapters).where(eq(chapters.id, chapterId)).returning();
  }

  async getBetaChapterLessons(chapterId: UUIDType): Promise<AdminLessonWithContentSchema[]> {
    return this.db
      .select({
        updatedAt: sql<string>`${lessons.updatedAt}`,
        id: lessons.id,
        title: lessons.title,
        type: sql<LessonTypes>`${lessons.type}`,
        description: sql<string>`${lessons.description}`,
        fileS3Key: sql<string>`${lessons.fileS3Key}`,
        fileType: sql<string>`${lessons.fileType}`,
        displayOrder: sql<number>`${lessons.displayOrder}`,
        isExternal: sql<boolean>`${lessons.isExternal}`,
        thresholdScore: sql<number>`${lessons.thresholdScore}`,
        attemptsLimit: sql<number | null>`${lessons.attemptsLimit}`,
        quizCooldown: sql<number | null>`${lessons.quizCooldown}`,
        questions: sql<AdminQuestionBody[]>`
        (
          SELECT ARRAY(
            SELECT json_build_object(
              'id', ${questions.id},
              'title', ${questions.title},
              'type', ${questions.type},
              'description', ${questions.description},
              'photoS3Key', ${questions.photoS3Key},
              'displayOrder', ${questions.displayOrder},
              'options', (
                SELECT ARRAY(
                  SELECT json_build_object(
                    'id', ${questionAnswerOptions.id},
                    'optionText', ${questionAnswerOptions.optionText},
                    'isCorrect', ${questionAnswerOptions.isCorrect},
                    'displayOrder', ${questionAnswerOptions.displayOrder},
                    'matchedWord', ${questionAnswerOptions.matchedWord},
                    'scaleAnswer', ${questionAnswerOptions.scaleAnswer}
                  )
                  FROM ${questionAnswerOptions} questionAnswerOptions
                  WHERE questionAnswerOptions.question_id = questions.id
                  ORDER BY ${questionAnswerOptions.displayOrder}
                )
              )
            )
            FROM ${questions}
            WHERE ${questions.lessonId} = lessons.id
            ORDER BY ${questions.displayOrder}
          )
        )
      `,
        aiMentor: sql<AiMentorBody>`
        (
          SELECT json_build_object(
            'id', aml.id,
            'lessonId', aml.lesson_id,
            'aiMentorInstructions', aml.ai_mentor_instructions,
            'completionConditions', aml.completion_conditions
          )
          FROM ${aiMentorLessons} aml
          WHERE lessons.id = aml.lesson_id 
          LIMIT 1
        )
      `,
      })
      .from(lessons)
      .where(and(eq(lessons.chapterId, chapterId)))
      .orderBy(lessons.displayOrder);
  }

  async updateFreemiumStatus(chapterId: UUIDType, isFreemium: boolean) {
    return this.db.update(chapters).set({ isFreemium }).where(eq(chapters.id, chapterId));
  }

  async updateChapter(id: UUIDType, body: UpdateChapterBody) {
    return this.db.update(chapters).set(body).where(eq(chapters.id, id)).returning();
  }

  async updateChapterCountForCourse(courseId: UUIDType, trx?: PostgresJsDatabase<typeof schema>) {
    const dbInstance = trx ?? this.db;

    return dbInstance
      .update(courses)
      .set({
        chapterCount: sql<number>`(
          SELECT COUNT(*)
          FROM ${chapters}
          WHERE ${chapters.courseId} = ${courseId}
      )`,
      })
      .where(eq(courses.id, courseId));
  }
}
