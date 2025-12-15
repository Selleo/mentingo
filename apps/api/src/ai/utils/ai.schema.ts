import { AI_MENTOR_TYPE, SUPPORTED_LANGUAGES } from "@repo/shared";
import { type Static, Type } from "@sinclair/typebox";

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
  aiMentorLessonId: UUIDSchema,
  userLanguage: Type.Enum(SUPPORTED_LANGUAGES),
  userId: UUIDSchema,
  status: Type.Enum(THREAD_STATUS),
});
export const updateThreadSchema = Type.Partial(threadSchema);

export const responseThreadSchema = Type.Object({
  id: UUIDSchema,
  aiMentorLessonId: UUIDSchema,
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
  conditions: Type.String(),
  type: Type.Enum(AI_MENTOR_TYPE),
  name: Type.String(),
});

export const aiJudgeJudgementSchema = Type.Object({
  summary: Type.String({
    description:
      "Supportive overview of what was done well, and how to improve — but NEVER mention grading rules, criteria, numbers, or conditions.",
  }),
  minScore: Type.Integer({
    description: "Minimum score required to pass implied from the lesson conditions",
    default: 0,
  }),
  score: Type.Integer({ description: "Score implied from the user conversation", default: 0 }),
  maxScore: Type.Integer({
    description: "Maximum score possible to get implied from the lesson conditions",
    default: 0,
  }),
});

export const responseAiJudgeJudgementSchema = Type.Intersect([
  aiJudgeJudgementSchema,
  Type.Object({
    passed: Type.Boolean(),
    percentage: Type.Integer(),
  }),
]);

export const threadOwnershipSchema = Type.Object({
  threadId: UUIDSchema,
  userId: UUIDSchema,
});

export const responseJudgeSchema = Type.Object({
  summary: Type.String(),
  passed: Type.Boolean(),
});

export const streamChatSchema = Type.Object({
  threadId: UUIDSchema,
  content: Type.String({ minLength: 1 }),
  id: Type.Optional(UUIDSchema),
});

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
