import {
  DASHBOARD_DEADLINE_RISK_TYPES,
  DASHBOARD_DEADLINE_RISK_URGENCY_ORDERS,
} from "@repo/shared";
import { Type } from "@sinclair/typebox";

import { nextLessonSchema } from "src/lesson/lesson.schema";

import type { Static } from "@sinclair/typebox";

export const ActivityHistorySchema = Type.Record(Type.String(), Type.Boolean());

export const QuizStatsSchema = Type.Object({
  totalAttempts: Type.Number(),
  totalCorrectAnswers: Type.Number(),
  totalWrongAnswers: Type.Number(),
  totalQuestions: Type.Number(),
  averageScore: Type.Number(),
  uniqueQuizzesTaken: Type.Number(),
});

const MonthlyStatsSchema = Type.Object({
  started: Type.Number(),
  completed: Type.Number(),
  completionRate: Type.Number(),
});

const StatsByMonthSchema = Type.Object({
  month: Type.String(),
  ...MonthlyStatsSchema.properties,
});

export const CourseStatsSchema = Type.Record(Type.String(), MonthlyStatsSchema);

export const LessonsStatsSchema = Type.Record(Type.String(), MonthlyStatsSchema);

export const StreakSchema = Type.Object({
  current: Type.Number(),
  longest: Type.Number(),
  activityHistory: ActivityHistorySchema,
});

export const UserStatsSchema = Type.Object({
  averageStats: Type.Object({
    lessonStats: MonthlyStatsSchema,
    courseStats: MonthlyStatsSchema,
  }),
  quizzes: QuizStatsSchema,
  courses: CourseStatsSchema,
  lessons: LessonsStatsSchema,
  streak: StreakSchema,
  nextLesson: nextLessonSchema,
});

export const PopularCourseStatsSchema = Type.Object({
  courseName: Type.String(),
  studentCount: Type.Number(),
});

const MonthlyCourseStudentsStatsSchema = Type.Object({
  newStudentsCount: Type.Number(),
});

const CourseStudentsStatsByMonthSchema = Type.Object({
  month: Type.String(),
  ...MonthlyCourseStudentsStatsSchema.properties,
});

const CourseStudentsStatsSchema = Type.Record(Type.String(), MonthlyCourseStudentsStatsSchema);

const QuizScoreSchema = Type.Object({
  correctAnswerCount: Type.Number(),
  wrongAnswerCount: Type.Number(),
  answerCount: Type.Number(),
});

export const StatsSchema = Type.Object({
  fiveMostPopularCourses: Type.Array(PopularCourseStatsSchema),
  totalCoursesCompletionStats: Type.Object({
    completionPercentage: Type.Number(),
    totalCoursesCompletion: Type.Number(),
    totalCourses: Type.Number(),
  }),
  conversionAfterFreemiumLesson: Type.Object({
    conversionPercentage: Type.Number(),
    purchasedCourses: Type.Number(),
    remainedOnFreemium: Type.Number(),
  }),
  courseStudentsStats: CourseStudentsStatsSchema,
  avgQuizScore: QuizScoreSchema,
});

const DashboardCourseProgressSchema = Type.Object({
  completed: Type.Number(),
  inProgress: Type.Number(),
  notStarted: Type.Number(),
});

const DashboardDeadlineStudentSchema = Type.Object({
  id: Type.String(),
  name: Type.String(),
  dueDate: Type.String(),
});

export const DashboardDeadlineRiskTypeSchema = Type.Enum(DASHBOARD_DEADLINE_RISK_TYPES);

export const DashboardDeadlineRiskCourseSchema = Type.Object({
  id: Type.String(),
  title: Type.String(),
  students: Type.Array(DashboardDeadlineStudentSchema),
});

export const DashboardDeadlineRiskUrgencyOrderSchema = Type.Enum(
  DASHBOARD_DEADLINE_RISK_URGENCY_ORDERS,
);

export const DashboardDeadlineRiskCourseSummarySchema = Type.Object({
  id: Type.String(),
  title: Type.String(),
  thumbnailUrl: Type.Union([Type.String(), Type.Null()]),
  overdueCount: Type.Number(),
  dueSoonCount: Type.Number(),
  nearestDueDate: Type.String(),
  urgency: DashboardDeadlineRiskTypeSchema,
});

export const DashboardDeadlineRiskStudentSchema = Type.Object({
  id: Type.String(),
  name: Type.String(),
});

export const DashboardDeadlineRiskGroupSchema = Type.Object({
  id: Type.String(),
  name: Type.String(),
  dueDate: Type.String(),
  urgency: DashboardDeadlineRiskTypeSchema,
  studentCount: Type.Number(),
  students: Type.Array(DashboardDeadlineRiskStudentSchema),
});

export const DashboardTrainingCompletionSchema = Type.Object({
  ...DashboardCourseProgressSchema.properties,
  total: Type.Number(),
  percentage: Type.Number(),
});

export const DashboardDeadlineRiskSummarySchema = Type.Object({
  overdueCount: Type.Number(),
  dueSoonCount: Type.Number(),
});

export const DashboardIncompleteCoursesSchema = Type.Object({
  hasEnrollments: Type.Boolean(),
  courses: Type.Array(
    Type.Object({
      id: Type.String(),
      title: Type.String(),
      total: Type.Number(),
      overdue: Type.Number(),
      ...DashboardCourseProgressSchema.properties,
    }),
  ),
});

const UserStatisticSchema = Type.Object({
  currentStreak: Type.Number(),
  longestStreak: Type.Number(),
  lastActivityDate: Type.Date(),
  activityHistory: ActivityHistorySchema,
});

export type UserStats = Static<typeof UserStatsSchema>;
export type StatsByMonth = Static<typeof StatsByMonthSchema>;
export type UserStatistic = Static<typeof UserStatisticSchema>;
export type Stats = Static<typeof StatsSchema>;
export type DashboardTrainingCompletion = Static<typeof DashboardTrainingCompletionSchema>;
export type DashboardDeadlineRiskSummary = Static<typeof DashboardDeadlineRiskSummarySchema>;
export type DashboardIncompleteCourses = Static<typeof DashboardIncompleteCoursesSchema>;
export type DashboardDeadlineRiskType = Static<typeof DashboardDeadlineRiskTypeSchema>;
export type DashboardDeadlineRiskCourse = Static<typeof DashboardDeadlineRiskCourseSchema>;
export type DashboardDeadlineRiskUrgencyOrder = Static<
  typeof DashboardDeadlineRiskUrgencyOrderSchema
>;
export type DashboardDeadlineRiskCourseSummary = Static<
  typeof DashboardDeadlineRiskCourseSummarySchema
>;
export type DashboardDeadlineRiskStudent = Static<typeof DashboardDeadlineRiskStudentSchema>;
export type DashboardDeadlineRiskGroup = Static<typeof DashboardDeadlineRiskGroupSchema>;
export type CourseStudentsStatsByMonth = Static<typeof CourseStudentsStatsByMonthSchema>;
