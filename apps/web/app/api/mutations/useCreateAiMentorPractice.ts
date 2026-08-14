import { useMutation } from "@tanstack/react-query";

import { getAiMentorPracticeTodayQueryKey } from "~/api/queries/useAiMentorPracticeToday";
import { queryClient } from "~/api/queryClient";

import { ApiClient } from "../api-client";

import type { CreatePracticeBody } from "../generated-api";

export function useCreateAiMentorPractice() {
  return useMutation({
    mutationFn: async (body: CreatePracticeBody) => {
      const response = await ApiClient.api.aiControllerCreatePractice(body);
      return response.data.data;
    },
    onSuccess: (practice) => {
      queryClient.setQueryData(getAiMentorPracticeTodayQueryKey(), practice);
      queryClient.setQueryData(["aiMentorPractice", practice.id], practice);
    },
  });
}
