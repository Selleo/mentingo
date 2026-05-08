import { Type } from "@sinclair/typebox";

import { UUIDSchema } from "src/common";

import type { Static } from "@sinclair/typebox";

const userSchema = Type.Object({
  id: UUIDSchema,
  firstName: Type.String(),
  lastName: Type.String(),
  avatarReference: Type.Union([Type.String(), Type.Null()]),
});

export const courseChatMessageReactionSchema = Type.Object({
  reaction: Type.String(),
  count: Type.Number(),
  reactedByCurrentUser: Type.Boolean(),
});

const courseChatMessageBaseSchema = Type.Object({
  id: UUIDSchema,
  courseId: UUIDSchema,
  userId: UUIDSchema,
  content: Type.String(),
  parentMessageId: Type.Union([UUIDSchema, Type.Null()]),
  deletedAt: Type.Union([Type.String(), Type.Null()]),
  createdAt: Type.String(),
  updatedAt: Type.String(),
  user: userSchema,
  reactions: Type.Array(courseChatMessageReactionSchema),
});

export const courseChatMessagePreviewSchema = courseChatMessageBaseSchema;

export const courseChatMessageSchema = Type.Composite([
  courseChatMessageBaseSchema,
  Type.Object({
    replyCount: Type.Number(),
    latestReply: Type.Union([courseChatMessagePreviewSchema, Type.Null()]),
    replyParticipants: Type.Array(userSchema),
  }),
]);

export const courseChatUserSchema = Type.Object({
  id: UUIDSchema,
  firstName: Type.String(),
  lastName: Type.String(),
  avatarReference: Type.Union([Type.String(), Type.Null()]),
  isOnline: Type.Boolean(),
});

export const createCourseChatMessageSchema = Type.Object({
  content: Type.String({ minLength: 1, maxLength: 5000 }),
  parentMessageId: Type.Optional(UUIDSchema),
  mentionedUserIds: Type.Optional(Type.Array(UUIDSchema)),
});

export const toggleCourseChatMessageReactionSchema = Type.Object({
  reaction: Type.String({ minLength: 1, maxLength: 16 }),
});

export const courseChatMessageReactionsUpdatedSchema = Type.Object({
  courseId: UUIDSchema,
  messageId: UUIDSchema,
  reactions: Type.Array(courseChatMessageReactionSchema),
});

export const deleteCourseChatMessageResponseSchema = Type.Object({
  courseId: UUIDSchema,
  messageId: UUIDSchema,
  parentMessageId: Type.Union([UUIDSchema, Type.Null()]),
  removed: Type.Boolean(),
  deletedAt: Type.Union([Type.String(), Type.Null()]),
});

export const courseChatPaginationQuerySchema = Type.Optional(Type.Number({ minimum: 1 }));

export const courseChatMessagesResponseSchema = Type.Array(courseChatMessageSchema);
export const courseChatRepliesResponseSchema = Type.Array(courseChatMessageSchema);
export const courseChatUsersResponseSchema = Type.Array(courseChatUserSchema);

export type CourseChatMessagePreviewResponse = Static<typeof courseChatMessagePreviewSchema>;
export type CourseChatMessageResponse = Static<typeof courseChatMessageSchema>;
export type CourseChatMessageReactionResponse = Static<typeof courseChatMessageReactionSchema>;
export type CourseChatMessageReactionsUpdatedResponse = Static<
  typeof courseChatMessageReactionsUpdatedSchema
>;
export type DeleteCourseChatMessageResponse = Static<typeof deleteCourseChatMessageResponseSchema>;
export type CourseChatUserResponse = Static<typeof courseChatUserSchema>;
export type CreateCourseChatMessageBody = Static<typeof createCourseChatMessageSchema>;
export type ToggleCourseChatMessageReactionBody = Static<
  typeof toggleCourseChatMessageReactionSchema
>;
