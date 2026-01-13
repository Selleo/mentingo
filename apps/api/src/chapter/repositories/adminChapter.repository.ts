import { Inject, Injectable } from "@nestjs/common";
import { and, eq, getTableColumns, gte, lte, sql } from "drizzle-orm";

import { DatabasePg, type UUIDType } from "src/common";
import { setJsonbField } from "src/common/helpers/sqlHelpers";
import { LocalizationService } from "src/localization/localization.service";
import { ENTITY_TYPE } from "src/localization/localization.types";
import {
  aiMentorLessons,
  chapters,
  courses,
  lessons,
  questionAnswerOptions,
  questions,
} from "src/storage/schema";

import type { UpdateChapterBody } from "../schemas/chapter.schema";
import type { SupportedLanguages } from "@repo/shared";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import type {
  AdminLessonWithContentSchema,
  AdminQuestionBody,
  AiMentorBody,
  LessonResource,
} from "src/lesson/lesson.schema";
import type { LessonTypes } from "src/lesson/lesson.type";
import type * as schema from "src/storage/schema";

@Injectable()
export class AdminChapterRepository {
  constructor(
    @Inject("DB") private readonly db: DatabasePg,
    private readonly localizationService: LocalizationService,
  ) {}

  async getChapterById(chapterId: UUIDType, language?: SupportedLanguages) {
    return this.db
      .select({
        ...getTableColumns(chapters),
        title: this.localizationService.getLocalizedSqlField(chapters.title, language),
      })
      .from(chapters)
      .innerJoin(courses, eq(courses.id, chapters.courseId))
      .where(eq(chapters.id, chapterId));
  }

  async changeChapterDisplayOrder(
    courseId: UUIDType,
    chapterId: UUIDType,
    oldDisplayOrder: number,
    newDisplayOrder: number,
    language: SupportedLanguages,
  ) {
    return await this.db.transaction(async (trx) => {
      return await trx
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
        .where(eq(chapters.courseId, courseId))
        .returning({
          ...getTableColumns(chapters),
          title: sql<string>`${chapters.title}->>${language}::text`,
        });
    });
  }

  async updateChapterDisplayOrder(courseId: UUIDType, trx?: PostgresJsDatabase<typeof schema>) {
    const dbInstance = trx ?? this.db;

    return dbInstance.execute(sql`
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

  async getBetaChapterLessons(
    chapterId: UUIDType,
    language: SupportedLanguages,
  ): Promise<AdminLessonWithContentSchema[]> {
    return this.db
      .select({
        updatedAt: sql<string>`${lessons.updatedAt}`,
        id: lessons.id,
        title: this.localizationService.getFieldByLanguage(lessons.title, language),
        type: sql<LessonTypes>`${lessons.type}`,
        description: this.localizationService.getFieldByLanguage(lessons.description, language),
        fileS3Key: sql<string>`${lessons.fileS3Key}`,
        fileType: sql<string>`${lessons.fileType}`,
        displayOrder: sql<number>`${lessons.displayOrder}`,
        isExternal: sql<boolean>`${lessons.isExternal}`,
        thresholdScore: sql<number>`${lessons.thresholdScore}`,
        attemptsLimit: sql<number | null>`${lessons.attemptsLimit}`,
        quizCooldownInHours: sql<number | null>`${lessons.quizCooldownInHours}`,
        questions: sql<AdminQuestionBody[]>`
        (
          SELECT ARRAY(
            SELECT json_build_object(
              'id', ${questions.id},
              'title', ${this.localizationService.getFieldByLanguage(questions.title, language)},
              'type', ${questions.type},
              'description', ${this.localizationService.getFieldByLanguage(
                questions.description,
                language,
              )},
              'photoS3Key', ${questions.photoS3Key},
              'displayOrder', ${questions.displayOrder},
              'options', (
                SELECT ARRAY(
                  SELECT json_build_object(
                    'id', ${questionAnswerOptions.id},
                    'optionText', ${this.localizationService.getFieldByLanguage(
                      questionAnswerOptions.optionText,
                      language,
                    )},
                    'isCorrect', ${questionAnswerOptions.isCorrect},
                    'displayOrder', ${questionAnswerOptions.displayOrder},
                    'matchedWord', ${this.localizationService.getFieldByLanguage(
                      questionAnswerOptions.matchedWord,
                      language,
                    )},
                    'scaleAnswer', ${questionAnswerOptions.scaleAnswer}
                  )
                  FROM ${questionAnswerOptions}
                  WHERE ${questionAnswerOptions.questionId} = questions.id
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
            'completionConditions', aml.completion_conditions,
            'type', aml.type,
            'name', aml.name,
            'avatarReference', aml.avatar_reference
          )
          FROM ${aiMentorLessons} aml
          WHERE lessons.id = aml.lesson_id 
          LIMIT 1
        )
      `,
        lessonResources: sql<LessonResource[]>`
            ARRAY(
              SELECT json_build_object(
                'id', r.id,
                'fileUrl', r.reference,
                'contentType', r.content_type,
                'title', COALESCE(r.title->>${language}::text, ''),
                'description', COALESCE(r.description->>${language}::text, ''),
                'fileName', r.metadata->>'originalFilename',
                'allowFullscreen', (r.metadata->>'allowFullscreen')::boolean
              )
              FROM resources r
              INNER JOIN resource_entity re ON re.resource_id = r.id
              WHERE re.entity_id = lessons.id
                AND re.entity_type = ${ENTITY_TYPE.LESSON}
                AND r.archived = false
              ORDER BY r.created_at
            )
      `,
      })
      .from(lessons)
      .innerJoin(chapters, eq(chapters.id, lessons.chapterId))
      .innerJoin(courses, eq(courses.id, chapters.courseId))
      .where(and(eq(lessons.chapterId, chapterId)))
      .orderBy(lessons.displayOrder);
  }

  async updateFreemiumStatus(chapterId: UUIDType, isFreemium: boolean) {
    return this.db.update(chapters).set({ isFreemium }).where(eq(chapters.id, chapterId));
  }

  async updateChapter(id: UUIDType, body: UpdateChapterBody) {
    return this.db
      .update(chapters)
      .set({
        ...body,
        title: setJsonbField(chapters.title, body.language, body.title),
      })
      .where(eq(chapters.id, id))
      .returning({
        ...getTableColumns(chapters),
        title: sql<string>`${chapters.title}->>${body.language}::text`,
      });
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
