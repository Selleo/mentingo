import { Type } from "@sinclair/typebox";

import { UUIDSchema } from "src/common";

import type { Static } from "@sinclair/typebox";

const userSchema = Type.Object({
  id: UUIDSchema,
  firstName: Type.String(),
  lastName: Type.String(),
  avatarReference: Type.Union([Type.String(), Type.Null()]),
});

export const courseChatMessageSchema = Type.Object({
  id: UUIDSchema,
  threadId: UUIDSchema,
  courseId: UUIDSchema,
  userId: UUIDSchema,
  content: Type.String(),
  parentMessageId: Type.Union([UUIDSchema, Type.Null()]),
  deletedAt: Type.Union([Type.String(), Type.Null()]),
  createdAt: Type.String(),
  updatedAt: Type.String(),
  user: userSchema,
});

export const courseChatThreadSchema = Type.Object({
  id: UUIDSchema,
  courseId: UUIDSchema,
  createdByUserId: UUIDSchema,
  archived: Type.Boolean(),
  createdAt: Type.String(),
  updatedAt: Type.String(),
  messageCount: Type.Number(),
  createdBy: userSchema,
  rootMessage: courseChatMessageSchema,
  latestMessage: Type.Union([courseChatMessageSchema, Type.Null()]),
});

export const courseChatUserSchema = Type.Object({
  id: UUIDSchema,
  firstName: Type.String(),
  lastName: Type.String(),
  avatarReference: Type.Union([Type.String(), Type.Null()]),
  isOnline: Type.Boolean(),
});

export const createCourseChatThreadSchema = Type.Object({
  content: Type.String({ minLength: 1, maxLength: 5000 }),
  mentionedUserIds: Type.Optional(Type.Array(UUIDSchema)),
});

export const createCourseChatMessageSchema = Type.Object({
  content: Type.String({ minLength: 1, maxLength: 5000 }),
  parentMessageId: Type.Optional(UUIDSchema),
  mentionedUserIds: Type.Optional(Type.Array(UUIDSchema)),
});

export const courseChatPaginationQuerySchema = Type.Optional(Type.Number({ minimum: 1 }));

export const courseChatThreadsResponseSchema = Type.Array(courseChatThreadSchema);
export const courseChatMessagesResponseSchema = Type.Array(courseChatMessageSchema);
export const courseChatUsersResponseSchema = Type.Array(courseChatUserSchema);

export const createCourseChatThreadResponseSchema = Type.Object({
  thread: courseChatThreadSchema,
  message: courseChatMessageSchema,
});

export type CourseChatMessageResponse = Static<typeof courseChatMessageSchema>;
export type CourseChatThreadResponse = Static<typeof courseChatThreadSchema>;
export type CourseChatUserResponse = Static<typeof courseChatUserSchema>;
export type CreateCourseChatThreadBody = Static<typeof createCourseChatThreadSchema>;
export type CreateCourseChatMessageBody = Static<typeof createCourseChatMessageSchema>;
export type CreateCourseChatThreadResponse = Static<typeof createCourseChatThreadResponseSchema>;
