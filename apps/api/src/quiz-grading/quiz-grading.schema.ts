import { ASSESSMENT_ANSWER_GRADING_STATUSES } from "@repo/shared";
import { Type, type Static } from "@sinclair/typebox";

import { UUIDSchema } from "src/common";

export const quizGradingStatusSchema = Type.Union([
  Type.Literal(ASSESSMENT_ANSWER_GRADING_STATUSES.PENDING),
  Type.Literal(ASSESSMENT_ANSWER_GRADING_STATUSES.GRADED),
]);

const namedEntitySchema = Type.Object({ id: UUIDSchema, name: Type.String() });

export const quizGradingAnswerListItemSchema = Type.Object({
  id: UUIDSchema,
  gradingStatus: quizGradingStatusSchema,
  awardedPoints: Type.Union([Type.Number(), Type.Null()]),
  maximumPoints: Type.Number(),
  submittedAt: Type.String(),
  questionTitle: Type.String(),
  course: namedEntitySchema,
  lesson: namedEntitySchema,
  student: namedEntitySchema,
});

export const quizGradingAnswerListSchema = Type.Array(quizGradingAnswerListItemSchema);

export const quizGradingFiltersSchema = Type.Object({
  courses: Type.Array(namedEntitySchema),
  lessons: Type.Array(Type.Object({ id: UUIDSchema, name: Type.String(), courseId: UUIDSchema })),
  students: Type.Array(namedEntitySchema),
});

export const quizGradingReviewSchema = Type.Object({
  id: UUIDSchema,
  revisionNumber: Type.Number(),
  reviewerName: Type.String(),
  awardedPoints: Type.Number(),
  comment: Type.String(),
  reviewedAt: Type.String(),
});

export const quizGradingAnswerDetailsSchema = Type.Intersect([
  quizGradingAnswerListItemSchema,
  Type.Object({
    questionDescription: Type.Union([Type.String(), Type.Null()]),
    reviewerInstructions: Type.Union([Type.String(), Type.Null()]),
    studentAnswer: Type.String(),
    attemptNumber: Type.Number(),
    reviews: Type.Array(quizGradingReviewSchema),
    nextAnswerId: Type.Union([UUIDSchema, Type.Null()]),
  }),
]);

export const gradeQuizAnswerSchema = Type.Object({
  awardedPoints: Type.Integer({ minimum: 0 }),
  comment: Type.Optional(Type.String({ maxLength: 5000 })),
});

export const gradeQuizAnswerResponseSchema = Type.Object({
  attemptGraded: Type.Boolean(),
  nextAnswerId: Type.Union([UUIDSchema, Type.Null()]),
});

export type QuizGradingStatus = Static<typeof quizGradingStatusSchema>;
export type QuizGradingAnswerListResponse = Static<typeof quizGradingAnswerListSchema>;
export type QuizGradingFiltersResponse = Static<typeof quizGradingFiltersSchema>;
export type QuizGradingAnswerDetailsResponse = Static<typeof quizGradingAnswerDetailsSchema>;
export type GradeQuizAnswerBody = Static<typeof gradeQuizAnswerSchema>;
export type GradeQuizAnswerResponse = Static<typeof gradeQuizAnswerResponseSchema>;
