import { AI_MENTOR_PRACTICE_STATUSES } from "@repo/shared";
import { useQuery } from "@tanstack/react-query";

import { ApiClient } from "../api-client";

export function useAiMentorPractice(id: string) {
  return useQuery({
    queryKey: ["aiMentorPractice", id],
    queryFn: async () => {
      const response = await ApiClient.api.aiControllerGetPractice(id);
      return response.data.data;
    },
    enabled: Boolean(id),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === AI_MENTOR_PRACTICE_STATUSES.QUEUED ||
        status === AI_MENTOR_PRACTICE_STATUSES.PROCESSING
        ? 2000
        : false;
    },
  });
}
