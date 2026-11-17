import {
  DISCUSSION_SCOPES,
  FORUM_POST_MAX_LENGTH,
  FORUM_SEARCH_MAX_LENGTH,
  FORUM_TOPIC_SORTS,
  FORUM_TOPIC_TITLE_MAX_LENGTH,
} from "@repo/shared";
import { Type } from "@sinclair/typebox";

import { UUIDSchema } from "src/common";
import { courseChatMessageReactionSchema } from "src/course-chat/schemas/course-chat.schema";
import { FORUM_MAX_PAGE_SIZE } from "src/forum/forum.constants";

import type { Static } from "@sinclair/typebox";

const forumAuthorSchema = Type.Object({
  id: UUIDSchema,
  firstName: Type.String(),
  lastName: Type.String(),
  avatarReference: Type.Union([Type.String(), Type.Null()]),
});

const forumTopicCourseSchema = Type.Object({
  id: UUIDSchema,
  title: Type.String(),
});

export const forumPostSchema = Type.Object({
  id: UUIDSchema,
  topicId: UUIDSchema,
  userId: UUIDSchema,
  content: Type.String(),
  isFirstPost: Type.Boolean(),
  deletedAt: Type.Union([Type.String(), Type.Null()]),
  createdAt: Type.String(),
  updatedAt: Type.String(),
  user: forumAuthorSchema,
  reactions: Type.Array(courseChatMessageReactionSchema),
});

const forumTopicBaseSchema = Type.Object({
  id: UUIDSchema,
  scope: Type.Enum(DISCUSSION_SCOPES),
  title: Type.Union([Type.String(), Type.Null()]),
  course: Type.Union([forumTopicCourseSchema, Type.Null()]),
  author: forumAuthorSchema,
  replyCount: Type.Number(),
  lastActivityAt: Type.String(),
  createdAt: Type.String(),
});

export const forumTopicListItemSchema = Type.Composite([
  forumTopicBaseSchema,
  Type.Object({
    excerpt: Type.String(),
    isDeleted: Type.Boolean(),
  }),
]);

export const forumTopicSchema = Type.Composite([
  forumTopicBaseSchema,
  Type.Object({
    firstPost: forumPostSchema,
  }),
]);

export const forumTopicListSchema = Type.Array(forumTopicListItemSchema);
export const forumPostListSchema = Type.Array(forumPostSchema);

export const createForumTopicSchema = Type.Object({
  title: Type.String({ minLength: 1, maxLength: FORUM_TOPIC_TITLE_MAX_LENGTH }),
  content: Type.String({ minLength: 1, maxLength: FORUM_POST_MAX_LENGTH }),
});

export const createForumPostSchema = Type.Object({
  content: Type.String({ minLength: 1, maxLength: FORUM_POST_MAX_LENGTH }),
});

export const deleteForumPostResponseSchema = Type.Object({
  topicId: UUIDSchema,
  postId: UUIDSchema,
  isFirstPost: Type.Boolean(),
  removed: Type.Boolean(),
  deletedAt: Type.Union([Type.String(), Type.Null()]),
  topicRemoved: Type.Boolean(),
});

export const forumPageQuerySchema = Type.Optional(Type.Number({ minimum: 1 }));
export const forumPerPageQuerySchema = Type.Optional(
  Type.Number({ minimum: 1, maximum: FORUM_MAX_PAGE_SIZE }),
);
export const forumTopicSortQuerySchema = Type.Optional(Type.Enum(FORUM_TOPIC_SORTS));
export const forumTopicScopeQuerySchema = Type.Optional(Type.Enum(DISCUSSION_SCOPES));
export const forumSearchQuerySchema = Type.Optional(
  Type.String({ maxLength: FORUM_SEARCH_MAX_LENGTH }),
);

export type ForumPostResponse = Static<typeof forumPostSchema>;
export type ForumTopicListItemResponse = Static<typeof forumTopicListItemSchema>;
export type ForumTopicResponse = Static<typeof forumTopicSchema>;
export type CreateForumTopicBody = Static<typeof createForumTopicSchema>;
export type CreateForumPostBody = Static<typeof createForumPostSchema>;
export type DeleteForumPostResponse = Static<typeof deleteForumPostResponseSchema>;
