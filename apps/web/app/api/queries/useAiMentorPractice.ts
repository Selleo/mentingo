import { AI_MENTOR_PRACTICE_STATUSES } from "@repo/shared";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";

import { queryClient } from "~/api/queryClient";

import { ApiClient } from "../api-client";

import { getCurrentThreadMessagesQueryKey } from "./useCurrentThreadMessages";

export const getAiMentorPracticeQueryKey = (id: string) => ["aiMentorPractice", id] as const;

export function useAiMentorPractice(id: string) {
  const query = useQuery({
    queryKey: getAiMentorPracticeQueryKey(id),
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

  useEffect(() => {
    const threadId = query.data?.threadId;
    if (!threadId) return;

    void queryClient.invalidateQueries({
      queryKey: getCurrentThreadMessagesQueryKey(threadId),
    });
  }, [query.data?.status, query.data?.threadId]);

  return query;
}
