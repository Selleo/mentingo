import { Type, type Static } from "@sinclair/typebox";

export const learningTimeStatisticsSchema = Type.Object({
  averagePerLesson: Type.Array(
    Type.Object({
      lessonId: Type.String(),
      lessonTitle: Type.String(),
      averageSeconds: Type.Number(),
      totalUsers: Type.Number(),
      totalSeconds: Type.Number(),
    }),
  ),
  totalPerStudent: Type.Array(
    Type.Object({
      userId: Type.String(),
      userFirstName: Type.String(),
      userLastName: Type.String(),
      userEmail: Type.String(),
      totalSeconds: Type.Number(),
      lessonsWithTime: Type.Number(),
    }),
  ),
  courseTotals: Type.Object({
    totalSeconds: Type.Number(),
    uniqueUsers: Type.Number(),
  }),
});

export type LearningTimeStatistics = Static<typeof learningTimeStatisticsSchema>;

export const detailedLearningTimeSchema = Type.Array(
  Type.Object({
    lessonId: Type.String(),
    lessonTitle: Type.String(),
    userId: Type.String(),
    userFirstName: Type.String(),
    userLastName: Type.String(),
    userEmail: Type.String(),
    totalSeconds: Type.Number(),
  }),
);

export type DetailedLearningTime = Static<typeof detailedLearningTimeSchema>;
