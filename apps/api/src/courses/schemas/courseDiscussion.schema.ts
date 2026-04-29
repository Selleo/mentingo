import { Type, type Static } from "@sinclair/typebox";

import { UUIDSchema } from "src/common";

export const discussionPostTypeSchema = Type.Union([
  Type.Literal("question"),
  Type.Literal("discussion"),
  Type.Literal("progress"),
]);

export const discussionFilterSchema = Type.Union([
  Type.Literal("all"),
  Type.Literal("questions"),
  Type.Literal("latest"),
  Type.Literal("pinned"),
]);

export const createCourseDiscussionPostSchema = Type.Object({
  type: discussionPostTypeSchema,
  content: Type.String({ minLength: 1, maxLength: 5000 }),
});

export const courseDiscussionPostSchema = Type.Object({
  id: UUIDSchema,
  authorId: UUIDSchema,
  authorName: Type.String(),
  authorAvatarUrl: Type.Union([Type.String(), Type.Null()]),
  type: discussionPostTypeSchema,
  content: Type.String(),
  createdAt: Type.String(),
  commentsCount: Type.Number(),
  reactions: Type.Object({
    like: Type.Number(),
    heart: Type.Number(),
    celebrate: Type.Number(),
  }),
  isPinned: Type.Boolean(),
});

export const courseDiscussionPostsSchema = Type.Array(courseDiscussionPostSchema);

export type DiscussionFilter = Static<typeof discussionFilterSchema>;
export type DiscussionPostType = Static<typeof discussionPostTypeSchema>;
export type CreateCourseDiscussionPostBody = Static<typeof createCourseDiscussionPostSchema>;
export type CourseDiscussionPostResponse = Static<typeof courseDiscussionPostSchema>;
