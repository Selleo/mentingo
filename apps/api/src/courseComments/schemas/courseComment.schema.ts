import { Type, type Static } from "@sinclair/typebox";

import { UUIDSchema } from "src/common";

export const COMMENT_CONTENT_MAX = 2000;
export const COMMENTS_PAGE_SIZE = 20;
export const INLINED_REPLIES_PER_COMMENT = 3;

export const courseCommentAuthorSchema = Type.Object({
  id: UUIDSchema,
  firstName: Type.String(),
  lastName: Type.String(),
  profilePictureUrl: Type.Union([Type.String(), Type.Null()]),
});

export const courseCommentSchema = Type.Object({
  id: UUIDSchema,
  courseId: UUIDSchema,
  parentCommentId: Type.Union([UUIDSchema, Type.Null()]),
  content: Type.String(),
  isDeleted: Type.Boolean(),
  createdAt: Type.String(),
  updatedAt: Type.String(),
  replyCount: Type.Number(),
  author: Type.Union([courseCommentAuthorSchema, Type.Null()]),
});

export const courseCommentWithRepliesSchema = Type.Intersect([
  courseCommentSchema,
  Type.Object({
    replies: Type.Array(courseCommentSchema),
  }),
]);

export const cursorSchema = Type.Optional(Type.String());

export const listCourseCommentsResponseSchema = Type.Object({
  data: Type.Array(courseCommentWithRepliesSchema),
  nextCursor: Type.Union([Type.String(), Type.Null()]),
});

export const listRepliesResponseSchema = Type.Object({
  data: Type.Array(courseCommentSchema),
  nextCursor: Type.Union([Type.String(), Type.Null()]),
});

export const createCourseCommentSchema = Type.Object({
  content: Type.String({ minLength: 1, maxLength: COMMENT_CONTENT_MAX }),
  parentCommentId: Type.Optional(UUIDSchema),
});

export const updateCourseCommentSchema = Type.Object({
  content: Type.String({ minLength: 1, maxLength: COMMENT_CONTENT_MAX }),
});

export const createCourseCommentResponseSchema = Type.Object({
  data: courseCommentSchema,
});

export type CourseCommentAuthor = Static<typeof courseCommentAuthorSchema>;
export type CourseComment = Static<typeof courseCommentSchema>;
export type CourseCommentWithReplies = Static<typeof courseCommentWithRepliesSchema>;
export type ListCourseCommentsResponse = Static<typeof listCourseCommentsResponseSchema>;
export type ListRepliesResponse = Static<typeof listRepliesResponseSchema>;
export type CreateCourseCommentBody = Static<typeof createCourseCommentSchema>;
export type UpdateCourseCommentBody = Static<typeof updateCourseCommentSchema>;
export type CreateCourseCommentResponse = Static<typeof createCourseCommentResponseSchema>;
