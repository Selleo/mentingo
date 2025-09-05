import { type Static, Type } from "@sinclair/typebox";

import { UUIDSchema } from "src/common";

import { coursesStatusOptions } from "./courseQuery";

export const courseSchema = Type.Object({
  id: UUIDSchema,
  title: Type.String(),
  thumbnailUrl: Type.Union([Type.String(), Type.Null()]),
  description: Type.String(),
  authorId: Type.Optional(UUIDSchema),
  author: Type.String(),
  authorEmail: Type.Optional(Type.String()),
  authorAvatarUrl: Type.Union([Type.String(), Type.Null()]),
  category: Type.String(),
  courseChapterCount: Type.Number(),
  // completedChapterCount: Type.Number(),
  enrolledParticipantCount: Type.Number(),
  priceInCents: Type.Number(),
  currency: Type.String(),
  status: Type.Optional(coursesStatusOptions),
  createdAt: Type.Optional(Type.String()),
  hasFreeChapters: Type.Optional(Type.Boolean()),
});

export const studentCourseSchema = Type.Object({
  ...courseSchema.properties,
  completedChapterCount: Type.Number(),
  enrolled: Type.Optional(Type.Boolean()),
});

export const coursesForContentCreatorSchema = Type.Object({
  ...studentCourseSchema.properties,
  authorId: UUIDSchema,
  authorEmail: Type.String(),
});

export const allCoursesSchema = Type.Array(courseSchema);
export const allStudentCoursesSchema = Type.Array(studentCourseSchema);
export const allCoursesForContentCreatorSchema = Type.Array(coursesForContentCreatorSchema);

export type AllCoursesResponse = Static<typeof allCoursesSchema>;
export type AllStudentCoursesResponse = Static<typeof allStudentCoursesSchema>;
export type AllCoursesForContentCreatorResponse = Static<typeof allCoursesForContentCreatorSchema>;
