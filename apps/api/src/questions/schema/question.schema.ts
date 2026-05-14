import { type Static, Type } from "@sinclair/typebox";

import { UUIDSchema } from "src/common";

import { QUESTION_TYPE } from "./question.types";

export const answerQuestionSchema = Type.Object({
  courseId: UUIDSchema,
  lessonId: UUIDSchema,
  questionId: UUIDSchema,
  answer: Type.Union([
    Type.Array(UUIDSchema),
    Type.String(),
    Type.Array(Type.Object({ index: Type.Number(), value: Type.String() })),
  ]),
});

export const questionSchema = Type.Object({
  lessonId: UUIDSchema,
  questionId: UUIDSchema,
  questionType: Type.String(),
});

export type AnswerQuestionSchema = Static<typeof answerQuestionSchema>;
export type QuestionSchema = Static<typeof questionSchema>;

export const quizEvaluationSchema = Type.Object({
  answers: Type.Array(
    Type.Object({
      questionId: UUIDSchema,
      studentId: UUIDSchema,
      answer: Type.Unknown(),
      isCorrect: Type.Boolean(),
    }),
  ),
  correctAnswerCount: Type.Number(),
  wrongAnswerCount: Type.Number(),
});

const quizQuestionSchema = Type.Object({
  id: Type.String(),
  title: Type.String(),
  type: Type.Enum(QUESTION_TYPE),
  correctAnswers: Type.Array(
    Type.Object({
      answerId: UUIDSchema,
      displayOrder: Type.Number(),
      value: Type.String(),
    }),
  ),
  allAnswers: Type.Array(
    Type.Object({
      answerId: UUIDSchema,
      displayOrder: Type.Number(),
      value: Type.String(),
      isCorrect: Type.Boolean(),
    }),
  ),
});

export type QuizQuestion = Static<typeof quizQuestionSchema>;
export type QuizEvaluation = Static<typeof quizEvaluationSchema>;
