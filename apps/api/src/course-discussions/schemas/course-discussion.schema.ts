import { type Static, Type } from "@sinclair/typebox";

import { UUIDSchema } from "src/common";

export const courseDiscussionThreadSchema = Type.Object({
  id: UUIDSchema,
  courseId: UUIDSchema,
  lessonId: Type.Union([UUIDSchema, Type.Null()]),
  authorId: UUIDSchema,
  title: Type.String({ minLength: 3, maxLength: 150 }),
  content: Type.String({ minLength: 1, maxLength: 10_000 }),
  status: Type.Union([
    Type.Literal("visible"),
    Type.Literal("deleted_by_author"),
    Type.Literal("hidden_by_staff"),
  ]),
  lastActivityAt: Type.String(),
  createdAt: Type.String(),
  updatedAt: Type.String(),
});

export const courseDiscussionCommentSchema = Type.Object({
  id: UUIDSchema,
  threadId: UUIDSchema,
  authorId: UUIDSchema,
  content: Type.String({ minLength: 1, maxLength: 10_000 }),
  status: Type.Union([
    Type.Literal("visible"),
    Type.Literal("deleted_by_author"),
    Type.Literal("hidden_by_staff"),
  ]),
  createdAt: Type.String(),
  updatedAt: Type.String(),
});

export const courseDiscussionThreadDetailSchema = Type.Object({
  ...courseDiscussionThreadSchema.properties,
  comments: Type.Array(courseDiscussionCommentSchema),
});

export const updateCourseDiscussionBodySchema = Type.Object({
  title: Type.Optional(Type.String({ minLength: 3, maxLength: 150 })),
  content: Type.Optional(Type.String({ minLength: 1, maxLength: 10_000 })),
});

export const createCourseDiscussionCommentBodySchema = Type.Object({
  content: Type.String({ minLength: 1, maxLength: 10_000 }),
});

export const listCourseDiscussionsParamsSchema = Type.Object({
  courseId: UUIDSchema,
});

export const createCourseDiscussionBodySchema = Type.Object({
  title: Type.String({ minLength: 3, maxLength: 150 }),
  content: Type.String({ minLength: 1, maxLength: 10_000 }),
});

export type CourseDiscussionThread = Static<typeof courseDiscussionThreadSchema>;
export type CourseDiscussionComment = Static<typeof courseDiscussionCommentSchema>;
export type CourseDiscussionThreadDetail = Static<typeof courseDiscussionThreadDetailSchema>;
export type ListCourseDiscussionsParams = Static<typeof listCourseDiscussionsParamsSchema>;
export type CreateCourseDiscussionBody = Static<typeof createCourseDiscussionBodySchema>;
export type UpdateCourseDiscussionBody = Static<typeof updateCourseDiscussionBodySchema>;
export type CreateCourseDiscussionCommentBody = Static<
  typeof createCourseDiscussionCommentBodySchema
>;
