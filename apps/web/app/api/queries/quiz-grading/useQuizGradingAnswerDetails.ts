import { useQuery } from "@tanstack/react-query";

import { ApiClient } from "../../api-client";

import { QUIZ_GRADING_QUERY_KEY } from "./useQuizGradingAnswers";

export function useQuizGradingAnswerDetails(answerId: string) {
  return useQuery({
    queryKey: [...QUIZ_GRADING_QUERY_KEY, "answer", answerId],
    queryFn: async () =>
      (await ApiClient.api.quizGradingControllerGetAnswerDetails(answerId)).data.data,
    enabled: Boolean(answerId),
  });
}
