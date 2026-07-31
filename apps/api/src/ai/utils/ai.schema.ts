import { AI_MENTOR_TYPE, SUPPORTED_LANGUAGES } from "@repo/shared";
import { type Static, Type } from "@sinclair/typebox";

import { AI_JUDGE_CRITERION_STATUS } from "src/ai/judge-configuration/judge-configuration.types";
import { THREAD_STATUS, MESSAGE_ROLE } from "src/ai/utils/ai.type";
import { UUIDSchema } from "src/common";

export const requestThreadSchema = Type.Object({
  lessonId: UUIDSchema,
  userLanguage: Type.Enum(SUPPORTED_LANGUAGES),
});

export const createThreadSchema = Type.Object({
  lessonId: UUIDSchema,
  userLanguage: Type.Enum(SUPPORTED_LANGUAGES),
  userId: UUIDSchema,
  status: Type.Enum(THREAD_STATUS),
});

export const threadSchema = Type.Object({
  aiMentorLessonId: Type.Optional(Type.Union([UUIDSchema, Type.Null()])),
  practiceSessionId: Type.Optional(Type.Union([UUIDSchema, Type.Null()])),
  userLanguage: Type.Enum(SUPPORTED_LANGUAGES),
  userId: UUIDSchema,
  status: Type.Enum(THREAD_STATUS),
});
export const updateThreadSchema = Type.Partial(threadSchema);

export const responseThreadSchema = Type.Object({
  id: UUIDSchema,
  aiMentorLessonId: Type.Union([UUIDSchema, Type.Null()]),
  practiceSessionId: Type.Union([UUIDSchema, Type.Null()]),
  userId: UUIDSchema,
  userLanguage: Type.Enum(SUPPORTED_LANGUAGES),
  createdAt: Type.String(),
  updatedAt: Type.String(),
  status: Type.Enum(THREAD_STATUS),
});

export const createThreadMessageSchema = Type.Object({
  id: Type.Optional(Type.String()),
  threadId: UUIDSchema,
  content: Type.String(),
});

export const threadMessageSchema = Type.Intersect([
  Type.Omit(createThreadMessageSchema, ["id"]),
  Type.Object({
    role: Type.Enum(MESSAGE_ROLE),
    tokenCount: Type.Integer(),
    isJudge: Type.Optional(Type.Boolean()),
    userName: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  }),
]);

export const responseThreadMessageSchema = Type.Intersect([
  Type.Omit(threadMessageSchema, ["tokenCount", "threadId"]),
  Type.Object({
    id: Type.String(),
  }),
]);

export const aiMentorGroupsSchema = Type.Array(
  Type.Object({
    name: Type.String(),
    characteristic: Type.Union([Type.String(), Type.Null()]),
  }),
);

export const aiMentorLessonSchema = Type.Object({
  title: Type.String(),
  instructions: Type.String(),
  type: Type.Enum(AI_MENTOR_TYPE),
  name: Type.String(),
});

export const aiJudgeJudgementSchema = Type.Object(
  {
    criterionResults: Type.Array(
      Type.Object(
        {
          criterionRef: Type.String({ pattern: "^C[1-9][0-9]*$" }),
          awardedScore: Type.Integer({ minimum: 0 }),
          learnerSafeFeedback: Type.String(),
        },
        { additionalProperties: false },
      ),
    ),
    triggeredBlockingErrors: Type.Array(
      Type.Object(
        {
          blockingErrorRef: Type.String({ pattern: "^B[1-9][0-9]*$" }),
          learnerSafeFeedback: Type.String(),
        },
        { additionalProperties: false },
      ),
    ),
  },
  { additionalProperties: false },
);

const responseAiJudgeCriterionSchema = Type.Object({
  criterionId: UUIDSchema,
  title: Type.String(),
  awardedScore: Type.Integer(),
  maxScore: Type.Integer(),
  status: Type.Enum(AI_JUDGE_CRITERION_STATUS),
  learnerSafeFeedback: Type.String(),
});

const responseAiJudgeBlockingErrorSchema = Type.Object({
  blockingErrorId: UUIDSchema,
  description: Type.String(),
  learnerSafeFeedback: Type.String(),
});

export const responseAiJudgeJudgementSchema = Type.Object({
  passed: Type.Boolean(),
  minScore: Type.Integer(),
  score: Type.Integer(),
  maxScore: Type.Integer(),
  percentage: Type.Integer(),
  criteria: Type.Array(responseAiJudgeCriterionSchema),
  blockingErrors: Type.Array(responseAiJudgeBlockingErrorSchema),
});

export const threadOwnershipSchema = Type.Object({
  threadId: UUIDSchema,
  userId: UUIDSchema,
});

export const responseJudgeSchema = Type.Object({
  passed: Type.Boolean(),
  minScore: Type.Integer(),
  score: Type.Integer(),
  maxScore: Type.Integer(),
  percentage: Type.Integer(),
  criteria: Type.Array(responseAiJudgeCriterionSchema),
  blockingErrors: Type.Array(responseAiJudgeBlockingErrorSchema),
});

export const streamChatSchema = Type.Object({
  threadId: UUIDSchema,
  message: Type.Object(
    {
      id: Type.String(),
      role: Type.String(),
      parts: Type.Array(Type.Any()),
    },
    { additionalProperties: true },
  ),
  id: Type.Optional(UUIDSchema),
});

export const generateTranslationSchema = Type.Object(
  {
    translations: Type.Array(Type.String()),
  },
  { additionalProperties: false },
);

export type GenerateTranslationBody = Static<typeof generateTranslationSchema>;
export type StreamChatBody = Static<typeof streamChatSchema>;
export type ResponseJudgeBody = Static<typeof responseJudgeSchema>;
export type UpdateThreadBody = Static<typeof updateThreadSchema>;
export type ThreadOwnershipBody = Static<typeof threadOwnershipSchema>;
export type ResponseAiJudgeJudgementBody = Static<typeof responseAiJudgeJudgementSchema>;
export type AiJudgeJudgementBody = Static<typeof aiJudgeJudgementSchema>;
export type ResponseThreadMessageBody = Static<typeof responseThreadMessageSchema>;
export type AiMentorGroupsBody = Static<typeof aiMentorGroupsSchema>;
export type AiMentorLessonBody = Static<typeof aiMentorLessonSchema>;
export type ResponseThreadBody = Static<typeof responseThreadSchema>;
export type CreateThreadBody = Static<typeof createThreadSchema>;
export type ThreadBody = Static<typeof threadSchema>;
export type ThreadMessageBody = Static<typeof threadMessageSchema>;
