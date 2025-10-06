import { Inject, Injectable } from "@nestjs/common";
import { and, eq, inArray, sql } from "drizzle-orm";

import { DatabasePg, type UUIDType } from "src/common";
import {
  lessons,
  questionAnswerOptions,
  questions,
  studentQuestionAnswers,
} from "src/storage/schema";

import { QUESTION_TYPE, type QuestionType } from "./schema/question.types";

import type { AnswerQuestionSchema, QuestionSchema } from "./schema/question.schema";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import type { OptionBody, QuestionBody } from "src/lesson/lesson.schema";
import type * as schema from "src/storage/schema";

@Injectable()
export class QuestionRepository {
  constructor(@Inject("DB") private readonly db: DatabasePg) {}

  async getQuestionsForLesson(
    lessonId: UUIDType,
    isCompleted: boolean,
    userId: UUIDType,
  ): Promise<QuestionBody[]> {
    return this.db
      .select({
        id: sql<UUIDType>`${questions.id}`,
        type: sql<QuestionType>`${questions.type}`,
        title: questions.title,
        description: sql<string>`${questions.description}`,
        solutionExplanation: sql<string | null>`CASE
              WHEN ${isCompleted} THEN ${questions.solutionExplanation} 
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
                  'id', qao.id,
                  'optionText',  
                    CASE 
                      WHEN ${!isCompleted} AND ${questions.type} = ${
                        QUESTION_TYPE.FILL_IN_THE_BLANKS_TEXT
                      } THEN NULL
                      ELSE qao.option_text
                    END,
                  'isCorrect', CASE WHEN ${isCompleted} THEN qao.is_correct ELSE NULL END,
                  'displayOrder',
                    CASE
                      WHEN ${isCompleted} THEN qao.display_order
                      ELSE NULL
                    END,
                    'isStudentAnswer',
                    CASE
                      WHEN ${studentQuestionAnswers.id} IS NULL THEN NULL
                      WHEN ${
                        studentQuestionAnswers.answer
                      }->>CAST(qao.display_order AS text) = qao.option_text AND
                      ${questions.type} IN (${QUESTION_TYPE.FILL_IN_THE_BLANKS_DND}, ${
                        QUESTION_TYPE.FILL_IN_THE_BLANKS_TEXT
                      })
                      THEN TRUE
                    WHEN ${
                      studentQuestionAnswers.answer
                    }->>CAST(qao.display_order AS text) = qao.is_correct::text AND
                      ${questions.type} = ${QUESTION_TYPE.TRUE_OR_FALSE}
                      THEN TRUE
                    WHEN EXISTS (
                      SELECT 1
                      FROM jsonb_object_keys(${studentQuestionAnswers.answer}) AS key
                      WHERE ${studentQuestionAnswers.answer}->key = to_jsonb(qao.option_text))
                      AND  ${questions.type} NOT IN (${QUESTION_TYPE.FILL_IN_THE_BLANKS_DND}, ${
                        QUESTION_TYPE.FILL_IN_THE_BLANKS_TEXT
                      })
                      THEN TRUE
                      ELSE FALSE
                    END,
                  'studentAnswer',  
                    CASE
                      WHEN ${studentQuestionAnswers.id} IS NULL THEN NULL
                      ELSE ${studentQuestionAnswers.answer}->>CAST(qao.display_order AS text)
                    END
                )
                FROM ${questionAnswerOptions} qao
                WHERE qao.question_id = questions.id
                ORDER BY
                  CASE
                    WHEN ${questions.type} in (${
                      QUESTION_TYPE.FILL_IN_THE_BLANKS_DND
                    }) AND ${!isCompleted}
                      THEN random()
                    ELSE qao.display_order
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

  async getQuestions(
    answerQuestion: AnswerQuestionSchema,
    trx?: PostgresJsDatabase<typeof schema>,
  ): Promise<QuestionSchema> {
    const dbInstance = trx ?? this.db;

    const [questionData] = await dbInstance
      .select({
        lessonId: lessons.id,
        questionId: sql<string>`${questions.id}`,
        questionType: sql<string>`${questions.type}`,
      })
      .from(lessons)
      .leftJoin(questions, and(eq(questions.lessonId, lessons.id)))
      .where(and(eq(lessons.id, answerQuestion.lessonId)));

    return questionData;
  }

  async findExistingAnswer(
    userId: UUIDType,
    questionId: UUIDType,
    trx?: PostgresJsDatabase<typeof schema>,
  ): Promise<UUIDType | null> {
    const dbInstance = trx ?? this.db;
    const [existingAnswer] = await dbInstance
      .select({
        id: studentQuestionAnswers.id,
      })
      .from(studentQuestionAnswers)
      .where(
        and(
          eq(studentQuestionAnswers.studentId, userId),
          eq(studentQuestionAnswers.questionId, questionId),
        ),
      );

    return existingAnswer?.id;
  }

  async getQuestionAnswers(
    questionId: UUIDType,
    answerList: string[],
    trx?: PostgresJsDatabase<typeof schema>,
  ) {
    const dbInstance = trx ?? this.db;

    return await dbInstance
      .select({
        answer: questionAnswerOptions.optionText,
      })
      .from(questionAnswerOptions)
      .where(
        and(
          eq(questionAnswerOptions.questionId, questionId),
          inArray(questionAnswerOptions.id, answerList),
        ),
      );
  }

  async deleteAnswer(answerId: UUIDType, trx?: PostgresJsDatabase<typeof schema>) {
    const dbInstance = trx ?? this.db;

    return await dbInstance
      .delete(studentQuestionAnswers)
      .where(eq(studentQuestionAnswers.id, answerId));
  }

  async upsertAnswer(
    questionId: UUIDType,
    userId: UUIDType,
    answerId: UUIDType | null,
    answer: string[],
    trx?: PostgresJsDatabase<typeof schema>,
  ): Promise<void> {
    const jsonBuildObjectArgs = answer.join(",");
    const dbInstance = trx ?? this.db;

    if (answerId) {
      await dbInstance
        .update(studentQuestionAnswers)
        .set({
          answer: sql`json_build_object(${sql.raw(jsonBuildObjectArgs)})`,
        })
        .where(eq(studentQuestionAnswers.id, answerId));
      return;
    }

    await dbInstance.insert(studentQuestionAnswers).values({
      questionId,
      answer: sql`json_build_object(${sql.raw(jsonBuildObjectArgs)})`,
      studentId: userId,
    });

    return;
  }

  async getQuizQuestionsToEvaluation(lessonId: UUIDType) {
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
                'value', ${questionAnswerOptions.optionText}
              )
              FROM ${questionAnswerOptions}
              WHERE ${questionAnswerOptions.questionId} = ${questions.id} AND ${questionAnswerOptions.isCorrect} = TRUE
              GROUP BY ${questionAnswerOptions.displayOrder}, ${questionAnswerOptions.id}, ${questionAnswerOptions.optionText}
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
                'value', ${questionAnswerOptions.optionText},
                'isCorrect', ${questionAnswerOptions.isCorrect}
              )
              FROM ${questionAnswerOptions}
              WHERE ${questionAnswerOptions.questionId} = ${questions.id}
              GROUP BY ${questionAnswerOptions.displayOrder}, ${questionAnswerOptions.id}, ${questionAnswerOptions.optionText}
              ORDER BY ${questionAnswerOptions.displayOrder}
            )
          )
        `,
      })
      .from(questions)
      .leftJoin(questionAnswerOptions, eq(questions.id, questionAnswerOptions.questionId))
      .where(and(eq(questions.lessonId, lessonId)))
      .groupBy(questions.id)
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
    if (answers.length === 0) {
      return;
    }

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
