import { useMutation } from "@tanstack/react-query";

import { getAiMentorPracticeQueryKey } from "~/api/queries/useAiMentorPractice";
import { getAiMentorPracticeTodayQueryKey } from "~/api/queries/useAiMentorPracticeToday";
import { queryClient } from "~/api/queryClient";

import { ApiClient } from "../api-client";

export function useRetryAiMentorPractice() {
  return useMutation({
    mutationFn: async (id: string) => {
      const response = await ApiClient.api.aiControllerRetryPractice(id);
      return response.data.data;
    },
    onSuccess: (practice) => {
      queryClient.setQueryData(getAiMentorPracticeQueryKey(practice.id), practice);
      queryClient.setQueryData(getAiMentorPracticeTodayQueryKey(), practice);
    },
  });
}
