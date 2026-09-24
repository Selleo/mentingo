import {
  AI_THREAD_STATUSES,
  AI_THREAD_TYPES,
  MESSAGE_ROLE,
  SUPPORTED_LANGUAGES,
} from "@repo/shared";
import { Type, type Static } from "@sinclair/typebox";

import { AI_JUDGE_CRITERION_STATUS } from "src/ai/judge-configuration/judge-configuration.types";
import { UUIDSchema } from "src/common";

const nullableString = Type.Union([Type.String(), Type.Null()]);
const nullableId = Type.Union([UUIDSchema, Type.Null()]);
export const adminAiThreadTypeSchema = Type.Union([
  Type.Literal(AI_THREAD_TYPES.PRACTICE),
  Type.Literal(AI_THREAD_TYPES.AI_MENTOR),
]);
export const adminAiThreadPaginationSchema = Type.Object({
  page: Type.Optional(Type.Integer({ minimum: 1, default: 1 })),
  perPage: Type.Optional(Type.Integer({ minimum: 1, maximum: 100 })),
});
export const adminAiThreadQuerySchema = Type.Object({
  ...adminAiThreadPaginationSchema.properties,
  userId: Type.Optional(UUIDSchema),
  type: Type.Optional(adminAiThreadTypeSchema),
  status: Type.Optional(Type.Enum(AI_THREAD_STATUSES)),
  search: Type.Optional(Type.String({ maxLength: 200 })),
  from: Type.Optional(Type.String({ format: "date-time" })),
  to: Type.Optional(Type.String({ format: "date-time" })),
  language: Type.Optional(Type.Enum(SUPPORTED_LANGUAGES)),
});
export const adminAiThreadSummarySchema = Type.Object({
  id: UUIDSchema,
  type: adminAiThreadTypeSchema,
  practiceSessionId: nullableId,
  aiMentorLessonId: nullableId,
  lessonId: nullableId,
  courseId: nullableId,
  courseTitle: nullableString,
  title: Type.String(),
  openingPreview: nullableString,
  owner: Type.Object({
    id: UUIDSchema,
    firstName: Type.String(),
    lastName: Type.String(),
    profilePictureUrl: nullableString,
  }),
  status: Type.Enum(AI_THREAD_STATUSES),
  language: Type.String(),
  createdAt: Type.String(),
  lastActivityAt: Type.String(),
});
export const adminAiThreadEvaluationSchema = Type.Object({
  passed: Type.Boolean(),
  score: Type.Integer(),
  maxScore: Type.Integer(),
  percentage: Type.Integer(),
  criteria: Type.Array(
    Type.Object({
      criterionId: nullableId,
      title: Type.String(),
      awardedScore: Type.Integer(),
      maxScore: Type.Integer(),
      status: Type.Enum(AI_JUDGE_CRITERION_STATUS),
      learnerSafeFeedback: Type.String(),
    }),
  ),
  blockingErrors: Type.Array(
    Type.Object({
      blockingErrorId: nullableId,
      description: Type.String(),
      learnerSafeFeedback: Type.String(),
    }),
  ),
});
export const adminAiThreadDetailSchema = Type.Intersect([
  adminAiThreadSummarySchema,
  Type.Object({ evaluation: Type.Union([adminAiThreadEvaluationSchema, Type.Null()]) }),
]);
export const adminAiThreadMessageSchema = Type.Object({
  id: UUIDSchema,
  role: Type.Union([Type.Literal(MESSAGE_ROLE.USER), Type.Literal(MESSAGE_ROLE.MENTOR)]),
  content: Type.String(),
  createdAt: Type.String(),
});
export type AdminAiThreadQuery = Static<typeof adminAiThreadQuerySchema>;
export type AdminAiThreadPagination = Static<typeof adminAiThreadPaginationSchema>;
export type AdminAiThreadSummary = Static<typeof adminAiThreadSummarySchema>;
export type AdminAiThreadDetail = Static<typeof adminAiThreadDetailSchema>;
export type AdminAiThreadMessage = Static<typeof adminAiThreadMessageSchema>;
export type AdminAiThreadEvaluation = Static<typeof adminAiThreadEvaluationSchema>;
