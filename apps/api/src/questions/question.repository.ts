import { Inject, Injectable } from "@nestjs/common";
import { and, eq, inArray, sql } from "drizzle-orm";

import { DatabasePg, type UUIDType } from "src/common";
import { LocalizationService } from "src/localization/localization.service";
import {
  chapters,
  courses,
  lessons,
  questionAnswerOptions,
  questions,
  studentQuestionAnswers,
} from "src/storage/schema";

import { QUESTION_TYPE, type QuestionType } from "./schema/question.types";

import type { SupportedLanguages } from "@repo/shared";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import type { OptionBody, QuestionBody } from "src/lesson/lesson.schema";
import type * as schema from "src/storage/schema";

@Injectable()
export class QuestionRepository {
  constructor(
    @Inject("DB") private readonly db: DatabasePg,
    private readonly localizationService: LocalizationService,
  ) {}

  async getQuestionsForLesson(
    lessonId: UUIDType,
    isCompleted: boolean,
    userId: UUIDType,
    language: SupportedLanguages,
  ): Promise<QuestionBody[]> {
    return this.db
      .select({
        id: sql<UUIDType>`${questions.id}`,
        type: sql<QuestionType>`${questions.type}`,
        title: this.localizationService.getLocalizedSqlField(questions.title, language),
        description: this.localizationService.getLocalizedSqlField(questions.description, language),
        solutionExplanation: sql<string | null>`CASE
              WHEN ${isCompleted} THEN ${this.localizationService.getLocalizedSqlField(
                questions.solutionExplanation,
                language,
              )} 
              ELSE NULL 
            END`,
        photoS3Key: sql<string>`${questions.photoS3Key}`,
        passQuestion: sql<boolean | null>`CASE
              WHEN ${isCompleted} THEN ${studentQuestionAnswers.isCorrect}
              ELSE NULL END`,
        displayOrder: sql<number>`${questions.displayOrder}`,
        options: sql<OptionBody[]>`CASE
            WHEN ${questions.type} in (${QUESTION_TYPE.BRIEF_RESPONSE}, ${
              QUESTION_TYPE.DETAILED_RESPONSE
            }) AND ${isCompleted} THEN
              ARRAY[json_build_object(
                'id', ${studentQuestionAnswers.id},
                'optionText', '',
                'isCorrect', TRUE,
                'displayOrder', 1,
                'isStudentAnswer', TRUE,
                'studentAnswer', ${studentQuestionAnswers.answer}->>'1'
              )]
            ELSE
            (
              SELECT ARRAY(
                SELECT json_build_object(
                  'id', ${questionAnswerOptions.id},
                  'optionText',  
                    CASE 
                      WHEN ${!isCompleted} AND ${questions.type} = ${
                        QUESTION_TYPE.FILL_IN_THE_BLANKS_TEXT
                      } THEN NULL
                      ELSE ${this.localizationService.getLocalizedSqlField(
                        questionAnswerOptions.optionText,
                        language,
                      )}
                    END,
                  'isCorrect', CASE WHEN ${isCompleted} THEN ${
                    questionAnswerOptions.isCorrect
                  } ELSE NULL END,
                  'displayOrder',
                    CASE
                      WHEN ${isCompleted} THEN ${questionAnswerOptions.displayOrder}
                      ELSE NULL
                    END,
                    'isStudentAnswer',
                    CASE
                      WHEN ${studentQuestionAnswers.id} IS NULL THEN NULL
                      WHEN ${studentQuestionAnswers.answer}->>CAST(${
                        questionAnswerOptions.displayOrder
                      } AS text) = ${this.localizationService.getLocalizedSqlField(
                        questionAnswerOptions.optionText,
                        language,
                      )} AND
                      ${questions.type} IN (${QUESTION_TYPE.FILL_IN_THE_BLANKS_DND}, ${
                        QUESTION_TYPE.FILL_IN_THE_BLANKS_TEXT
                      })
                      THEN TRUE
                    WHEN ${studentQuestionAnswers.answer}->>CAST(${
                      questionAnswerOptions.displayOrder
                    } AS text) = ${questionAnswerOptions.isCorrect}::text AND
                      ${questions.type} = ${QUESTION_TYPE.TRUE_OR_FALSE}
                      THEN TRUE
                    WHEN EXISTS (
                      SELECT 1
                      FROM jsonb_object_keys(${studentQuestionAnswers.answer}) AS key
                      WHERE ${
                        studentQuestionAnswers.answer
                      }->key = to_jsonb(${this.localizationService.getLocalizedSqlField(
                        questionAnswerOptions.optionText,
                        language,
                      )}))
                      AND  ${questions.type} NOT IN (${QUESTION_TYPE.FILL_IN_THE_BLANKS_DND}, ${
                        QUESTION_TYPE.FILL_IN_THE_BLANKS_TEXT
                      })
                      THEN TRUE
                      ELSE FALSE
                    END,
                  'studentAnswer',  
                    CASE
                      WHEN ${studentQuestionAnswers.id} IS NULL THEN NULL
                      ELSE ${studentQuestionAnswers.answer}->>CAST(${
                        questionAnswerOptions.displayOrder
                      } AS text)
                    END
                )
                FROM ${questionAnswerOptions}
                WHERE ${questionAnswerOptions.questionId} = questions.id
                ORDER BY
                  CASE
                    WHEN ${questions.type} in (${
                      QUESTION_TYPE.FILL_IN_THE_BLANKS_DND
                    }) AND ${!isCompleted}
                      THEN random()
                    ELSE ${questionAnswerOptions.displayOrder}
                  END
              )
            )
          END
        `,
      })
      .from(questions)
      .leftJoin(
        studentQuestionAnswers,
        and(
          eq(studentQuestionAnswers.questionId, questions.id),
          eq(studentQuestionAnswers.studentId, userId),
        ),
      )
      .innerJoin(lessons, eq(lessons.id, questions.lessonId))
      .innerJoin(chapters, eq(chapters.id, lessons.chapterId))
      .innerJoin(courses, eq(courses.id, chapters.courseId))
      .where(eq(questions.lessonId, lessonId))
      .orderBy(questions.displayOrder);
  }

  async getQuestionsIdsByLessonId(lessonId: UUIDType): Promise<UUIDType[]> {
    const questionsList = await this.db
      .select({ id: questions.id })
      .from(questions)
      .where(eq(questions.lessonId, lessonId));

    return questionsList.map((question) => question.id);
  }

  async getQuizQuestionsToEvaluation(lessonId: UUIDType, language?: SupportedLanguages) {
    return this.db
      .select({
        id: questions.id,
        type: sql<QuestionType>`${questions.type}`,
        correctAnswers: sql<{ answerId: UUIDType; displayOrder: number; value: string }[]>`
          (
            SELECT ARRAY(
              SELECT json_build_object(
                'answerId', ${questionAnswerOptions.id},
                'displayOrder', ${questionAnswerOptions.displayOrder},
                'value', ${this.localizationService.getLocalizedSqlField(
                  questionAnswerOptions.optionText,
                  language,
                )}
              )
              FROM ${questionAnswerOptions}
              WHERE ${questionAnswerOptions.questionId} = ${questions.id} AND ${
                questionAnswerOptions.isCorrect
              } = TRUE
              GROUP BY ${questionAnswerOptions.displayOrder}, ${questionAnswerOptions.id}, ${
                questionAnswerOptions.optionText
              }
              ORDER BY ${questionAnswerOptions.displayOrder}
            )
          )
        `,
        allAnswers: sql<
          { answerId: UUIDType; displayOrder: number; value: string; isCorrect: boolean }[]
        >`
          (
            SELECT ARRAY(
              SELECT json_build_object(
                'answerId', ${questionAnswerOptions.id},
                'displayOrder', ${questionAnswerOptions.displayOrder},
                'value', ${this.localizationService.getLocalizedSqlField(
                  questionAnswerOptions.optionText,
                  language,
                )},
                'isCorrect', ${questionAnswerOptions.isCorrect}
              )
              FROM ${questionAnswerOptions}
              WHERE ${questionAnswerOptions.questionId} = ${questions.id}
              GROUP BY ${questionAnswerOptions.displayOrder}, ${questionAnswerOptions.id}, ${
                questionAnswerOptions.optionText
              }
              ORDER BY ${questionAnswerOptions.displayOrder}
            )
          )
        `,
      })
      .from(questions)
      .innerJoin(lessons, eq(lessons.id, questions.lessonId))
      .innerJoin(chapters, eq(chapters.id, lessons.chapterId))
      .innerJoin(courses, eq(courses.id, chapters.courseId))
      .where(and(eq(questions.lessonId, lessonId)))
      .groupBy(questions.id, courses.availableLocales, courses.baseLanguage)
      .orderBy(questions.displayOrder);
  }

  async insertQuizAnswers(
    answers: {
      questionId: UUIDType;
      answer: unknown;
      studentId: UUIDType;
      isCorrect: boolean;
    }[],
    trx: PostgresJsDatabase<typeof schema>,
  ) {
    return trx.insert(studentQuestionAnswers).values(answers);
  }

  async deleteStudentQuizAnswers(
    questionsId: UUIDType[],
    studentId: UUIDType,
    trx: PostgresJsDatabase<typeof schema>,
  ) {
    return trx
      .delete(studentQuestionAnswers)
      .where(
        and(
          eq(studentQuestionAnswers.studentId, studentId),
          inArray(studentQuestionAnswers.questionId, questionsId),
        ),
      );
  }
}
