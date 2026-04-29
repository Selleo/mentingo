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

export const listCourseDiscussionsParamsSchema = Type.Object({
  courseId: UUIDSchema,
});

export const createCourseDiscussionBodySchema = Type.Object({
  title: Type.String({ minLength: 3, maxLength: 150 }),
  content: Type.String({ minLength: 1, maxLength: 10_000 }),
});

export type CourseDiscussionThread = Static<typeof courseDiscussionThreadSchema>;
export type ListCourseDiscussionsParams = Static<typeof listCourseDiscussionsParamsSchema>;
export type CreateCourseDiscussionBody = Static<typeof createCourseDiscussionBodySchema>;
