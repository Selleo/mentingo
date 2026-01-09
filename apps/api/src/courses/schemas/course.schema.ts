import { SUPPORTED_LANGUAGES } from "@repo/shared";
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
  dueDate: Type.Union([Type.String(), Type.Null()]),
  slug: Type.String(),
});

export const coursesForContentCreatorSchema = Type.Object({
  ...studentCourseSchema.properties,
  authorId: UUIDSchema,
  authorEmail: Type.String(),
});

export const courseStatusDistributionSchema = Type.Array(
  Type.Object({
    status: Type.Enum(PROGRESS_STATUSES),
    count: Type.Number(),
  }),
);

export const getCourseStatisticsSchema = Type.Object({
  enrolledCount: Type.Number(),
  completionPercentage: Type.Number(),
  averageCompletionPercentage: Type.Number(),
  courseStatusDistribution: courseStatusDistributionSchema,
});

export const getLessonSequenceEnabledSchema = Type.Object({
  lessonSequenceEnabled: Type.Boolean(),
});

export const courseAverageQuizScorePerQuizSchema = Type.Object({
  quizId: UUIDSchema,
  name: Type.String(),
  averageScore: Type.Number(),
  finishedCount: Type.Number(),
  lessonOrder: Type.Number(),
});

export const courseAverageQuizScoresSchema = Type.Object({
  averageScoresPerQuiz: Type.Array(courseAverageQuizScorePerQuizSchema),
});

export const studentCourseProgressionSchema = Type.Object({
  studentId: UUIDSchema,
  studentName: Type.String(),
  studentAvatarUrl: Type.Union([Type.String(), Type.Null()]),
  groups: Type.Union([
    Type.Array(
      Type.Object({
        id: Type.String(),
        name: Type.String(),
      }),
    ),
    Type.Null(),
  ]),
  completedLessonsCount: Type.Number(),
  lastActivity: Type.Union([Type.String(), Type.Null()]),
});

export const studentQuizResultSchema = Type.Object({
  studentId: UUIDSchema,
  studentName: Type.String(),
  studentAvatarUrl: Type.Union([Type.String(), Type.Null()]),
  lessonId: UUIDSchema,
  quizName: Type.String(),
  quizScore: Type.Number(),
  attempts: Type.Number(),
  lastAttempt: Type.String(),
});

export const studentAiMentorResultSchema = Type.Object({
  studentId: UUIDSchema,
  studentName: Type.String(),
  studentAvatarUrl: Type.Union([Type.String(), Type.Null()]),
  lessonId: UUIDSchema,
  lessonName: Type.String(),
  score: Type.Number(),
  lastSession: Type.String(),
});

export const supportedLanguagesSchema = Type.Enum(SUPPORTED_LANGUAGES, { default: "en" });
export const enrolledCourseGroupsPayload = Type.Object({
  groups: Type.Array(
    Type.Object({
      id: UUIDSchema,
      isMandatory: Type.Boolean(),
      dueDate: Type.Optional(Type.Union([Type.String(), Type.Null()])),
    }),
  ),
});

export const allStudentCourseProgressionSchema = Type.Array(studentCourseProgressionSchema);
export const allStudentQuizResultsSchema = Type.Array(studentQuizResultSchema);
export const allStudentAiMentorResultsSchema = Type.Array(studentAiMentorResultSchema);

export const allCoursesSchema = Type.Array(courseSchema);
export const allStudentCoursesSchema = Type.Array(studentCourseSchema);
export const allCoursesForContentCreatorSchema = Type.Array(coursesForContentCreatorSchema);

export type AllCoursesResponse = Static<typeof allCoursesSchema>;
export type AllStudentCoursesResponse = Static<typeof allStudentCoursesSchema>;
export type AllCoursesForContentCreatorResponse = Static<typeof allCoursesForContentCreatorSchema>;

export type CourseStatisticsResponse = Static<typeof getCourseStatisticsSchema>;
export type LessonSequenceEnabledResponse = Static<typeof getLessonSequenceEnabledSchema>;
export type CourseStatusDistribution = Static<typeof courseStatusDistributionSchema>;
export type CourseAverageQuizScorePerQuiz = Static<typeof courseAverageQuizScorePerQuizSchema>;
export type CourseAverageQuizScoresResponse = Static<typeof courseAverageQuizScoresSchema>;
export type AllStudentCourseProgressionResponse = Static<typeof allStudentCourseProgressionSchema>;
export type AllStudentQuizResultsResponse = Static<typeof allStudentQuizResultsSchema>;
export type AllStudentAiMentorResultsResponse = Static<typeof allStudentAiMentorResultsSchema>;
export type SupportedLanguagesBody = Static<typeof supportedLanguagesSchema>;
export type EnrolledCourseGroupsPayload = Static<typeof enrolledCourseGroupsPayload>;
