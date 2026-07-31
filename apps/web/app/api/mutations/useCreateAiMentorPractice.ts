import { useMutation } from "@tanstack/react-query";

import { queryClient } from "~/api/queryClient";

import { ApiClient } from "../api-client";
import { getBrowserTimezone } from "../queries/useAiMentorPracticeToday";

import type { CreatePracticeBody } from "../generated-api";

export function useCreateAiMentorPractice() {
  return useMutation({
    mutationFn: async (body: Omit<CreatePracticeBody, "timezone">) => {
      const response = await ApiClient.api.aiControllerCreatePractice({
        ...body,
        timezone: getBrowserTimezone(),
      });
      return response.data.data;
    },
    onSuccess: (practice) => {
      queryClient.setQueryData(["aiMentorPractice", "today", practice.timezone], practice);
      queryClient.setQueryData(["aiMentorPractice", practice.id], practice);
    },
  });
}
