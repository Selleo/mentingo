import { type Static, Type } from "@sinclair/typebox";

import { THREAD_STATUS, SUPPORTED_LANGUAGES, MESSAGE_ROLE } from "src/ai/ai.type";
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
  threadId: UUIDSchema,
  content: Type.String(),
});

export const threadMessageSchema = Type.Intersect([
  createThreadMessageSchema,
  Type.Object({
    role: Type.Enum(MESSAGE_ROLE),
    tokenCount: Type.Integer(),
  }),
]);
export const responseThreadMessageSchema = Type.Omit(threadMessageSchema, [
  "tokenCount",
  "threadId",
]);

export const aiMentorGroupsSchema = Type.Array(
  Type.Object({
    name: Type.String(),
    characteristic: Type.Union([Type.String(), Type.Null()]),
  }),
);

export const aiMentorLessonSchema = Type.Object({
  title: Type.Optional(Type.String()),
  instructions: Type.Optional(Type.String()),
  conditions: Type.Optional(Type.String()),
});

export const aiJudgeJudgementSchema = Type.Object({
  summary: Type.String(),
  minScore: Type.Integer(),
  score: Type.Integer(),
  maxScore: Type.Integer(),
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

export type ThreadOwnershipBody = Static<typeof threadOwnershipSchema>;
export type ResponseAiJudgeJudgementBody = Static<typeof responseAiJudgeJudgementSchema>;
export type AiJudgeJudgementBody = Static<typeof aiJudgeJudgementSchema>;
export type ResponseThreadMessageBody = Static<typeof responseThreadMessageSchema>;
export type AiMentorGroupsBody = Static<typeof aiMentorGroupsSchema>;
export type AiMentorLessonBody = Static<typeof aiMentorLessonSchema>;
export type RequestThreadBody = Static<typeof requestThreadSchema>;
export type ResponseThreadBody = Static<typeof responseThreadSchema>;
export type CreateThreadBody = Static<typeof createThreadSchema>;
export type ThreadBody = Static<typeof threadSchema>;
export type CreateThreadMessageBody = Static<typeof createThreadMessageSchema>;
export type ThreadMessageBody = Static<typeof threadMessageSchema>;
