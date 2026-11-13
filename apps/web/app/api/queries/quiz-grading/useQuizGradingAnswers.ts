import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { ApiClient } from "../../api-client";

import type { QuizGradingAnswersQuery } from "~/modules/QuizGrading/quizGrading.utils";

export const QUIZ_GRADING_QUERY_KEY = ["quiz-grading"];

export function useQuizGradingAnswers(query: QuizGradingAnswersQuery) {
  return useQuery({
    queryKey: [...QUIZ_GRADING_QUERY_KEY, "answers", query],
    queryFn: async () => (await ApiClient.api.quizGradingControllerGetAnswers(query)).data,
    placeholderData: keepPreviousData,
  });
}
