import { STUDENT_COURSE_URGENCY } from "@repo/shared";
import { Type, type Static } from "@sinclair/typebox";

import { UUIDSchema } from "src/common";

const dashboardCourseBaseSchema = Type.Object({
  courseId: UUIDSchema,
  slug: Type.String(),
  title: Type.String(),
});

export const continueLearningCourseSchema = Type.Object({
  ...dashboardCourseBaseSchema.properties,
  thumbnailUrl: Type.Union([Type.String(), Type.Null()]),
  completedChapterCount: Type.Number(),
  courseChapterCount: Type.Number(),
  lesson: Type.Union([
    Type.Object({
      id: UUIDSchema,
      title: Type.Union([Type.String(), Type.Null()]),
    }),
    Type.Null(),
  ]),
});

export const requiredDashboardCourseSchema = Type.Object({
  ...dashboardCourseBaseSchema.properties,
  thumbnailUrl: Type.Union([Type.String(), Type.Null()]),
  dueDate: Type.Union([Type.String(), Type.Null()]),
  urgency: Type.Enum(STUDENT_COURSE_URGENCY),
});

export const studentCourseCompletionSchema = Type.Object({
  total: Type.Number(),
  completed: Type.Number(),
  inProgress: Type.Number(),
  notStarted: Type.Number(),
  percentage: Type.Number(),
});

export const studentCourseDashboardSummarySchema = Type.Object({
  continueLearningCourses: Type.Array(continueLearningCourseSchema),
  requiredCourses: Type.Array(requiredDashboardCourseSchema),
  completion: studentCourseCompletionSchema,
});

export type StudentCourseDashboardSummary = Static<typeof studentCourseDashboardSummarySchema>;
