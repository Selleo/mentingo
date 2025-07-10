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
  aiMentorLessonId: UUIDSchema,
  userLanguage: Type.Enum(SUPPORTED_LANGUAGES),
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

export type RequestThreadBody = Static<typeof requestThreadSchema>;
export type ResponseThreadBody = Static<typeof responseThreadSchema>;
export type CreateThreadBody = Static<typeof createThreadSchema>;
export type ThreadBody = Static<typeof threadSchema>;
export type CreateThreadMessageBody = Static<typeof createThreadMessageSchema>;
export type ThreadMessageBody = Static<typeof threadMessageSchema>;
