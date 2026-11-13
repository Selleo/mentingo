import { useQuery } from "@tanstack/react-query";

import { ApiClient } from "../../api-client";

import { QUIZ_GRADING_QUERY_KEY } from "./useQuizGradingAnswers";

export function useQuizGradingFilterOptions() {
  return useQuery({
    queryKey: [...QUIZ_GRADING_QUERY_KEY, "filters"],
    queryFn: async () => (await ApiClient.api.quizGradingControllerGetFilterOptions()).data.data,
  });
}
