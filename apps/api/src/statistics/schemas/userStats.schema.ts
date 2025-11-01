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
export type CourseStudentsStatsByMonth = Static<typeof CourseStudentsStatsByMonthSchema>;
