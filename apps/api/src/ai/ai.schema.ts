import { type Static, Type } from "@sinclair/typebox";

import { THREAD_STATUS, SUPPORTED_LANGUAGES, MESSAGE_ROLE } from "src/ai/ai.type";
import { UUIDSchema } from "src/common";

export const createThreadSchema = Type.Object({
  aiMentorLessonId: UUIDSchema,
  userLanguage: Type.Enum(SUPPORTED_LANGUAGES),
});

export const threadSchema = Type.Intersect([
  createThreadSchema,
  Type.Object({
    userId: UUIDSchema,
    status: Type.Enum(THREAD_STATUS),
  }),
]);

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

export type CreateThreadBody = Static<typeof createThreadSchema>;
export type ThreadBody = Static<typeof threadSchema>;
export type CreateThreadMessageBody = Static<typeof createThreadMessageSchema>;
export type ThreadMessageBody = Static<typeof threadMessageSchema>;
