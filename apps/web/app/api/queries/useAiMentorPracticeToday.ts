import { AI_MENTOR_PRACTICE_STATUSES } from "@repo/shared";
import { useQuery } from "@tanstack/react-query";

import { ApiClient } from "../api-client";

export function useAiMentorPracticeToday() {
  return useQuery({
    queryKey: ["aiMentorPractice", "today"],
    queryFn: async () => {
      const response = await ApiClient.api.aiControllerGetTodayPractice();
      return response.data.data;
    },
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === AI_MENTOR_PRACTICE_STATUSES.QUEUED ||
        status === AI_MENTOR_PRACTICE_STATUSES.PROCESSING
        ? 2000
        : false;
    },
  });
}
