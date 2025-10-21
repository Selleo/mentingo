import { type Static, Type } from "@sinclair/typebox";

import { UUIDSchema } from "src/common";
import { PROGRESS_STATUSES } from "src/utils/types/progress.type";

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
  stripeProductId: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  stripePriceId: Type.Optional(Type.Union([Type.String(), Type.Null()])),
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

export const courseStatusDistributionSchema = Type.Array(
  Type.Object({
    status: Type.Union([
      Type.Literal(PROGRESS_STATUSES.NOT_STARTED),
      Type.Literal(PROGRESS_STATUSES.IN_PROGRESS),
      Type.Literal(PROGRESS_STATUSES.COMPLETED),
      Type.Literal(PROGRESS_STATUSES.BLOCKED),
    ]),
    count: Type.Number(),
  }),
);

export const getCourseStatisticsSchema = Type.Object({
  enrolledCount: Type.Number(),
  completionPercentage: Type.Number(),
  averageCompletionPercentage: Type.Number(),
  courseStatusDistribution: courseStatusDistributionSchema,
});

export const allCoursesSchema = Type.Array(courseSchema);
export const allStudentCoursesSchema = Type.Array(studentCourseSchema);
export const allCoursesForContentCreatorSchema = Type.Array(coursesForContentCreatorSchema);

export type AllCoursesResponse = Static<typeof allCoursesSchema>;
export type AllStudentCoursesResponse = Static<typeof allStudentCoursesSchema>;
export type AllCoursesForContentCreatorResponse = Static<typeof allCoursesForContentCreatorSchema>;

export type CourseStatisticsResponse = Static<typeof getCourseStatisticsSchema>;
export type CourseStatusDistribution = Static<typeof courseStatusDistributionSchema>;
