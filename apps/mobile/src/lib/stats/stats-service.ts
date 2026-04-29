import { apiClient } from "@/lib/auth/api-client";

export type UserStatistics = {
  averageStats: {
    lessonStats: { started: number; completed: number; completionRate: number };
    courseStats: { started: number; completed: number; completionRate: number };
  };
  quizzes: {
    totalAttempts: number;
    totalCorrectAnswers: number;
    totalWrongAnswers: number;
    totalQuestions: number;
    averageScore: number;
    uniqueQuizzesTaken: number;
  };
  streak: { current: number; longest: number };
};

type Response<T> = { data: T };

export async function getUserStatistics(): Promise<UserStatistics> {
  const { data } = await apiClient.get<Response<UserStatistics>>("/statistics/user-stats", {
    params: { language: "en" },
  });
  return data.data;
}
