import { queryOptions, useQuery, useSuspenseQuery } from "@tanstack/react-query";

import { ApiClient } from "~/api/api-client";

export const currentThreadQueryOptions = (
  lessonId: string,
  isThreadLoading: boolean,
  threadId?: string,
) =>
  queryOptions({
    enabled: !!threadId && !isThreadLoading,
    queryKey: ["threadMessages", { lessonId }],
    queryFn: async () => {
      const response = await ApiClient.api.aiControllerGetThreadMessages({ thread: threadId });
      return response.data;
    },
  });

export function useCurrentThreadMessages(
  lessonId: string,
  isThreadLoading: boolean,
  threadId?: string,
) {
  return useQuery(currentThreadQueryOptions(lessonId, isThreadLoading, threadId));
}
export function useSuspenseCurrentThreadMessages(
  lessonId: string,
  isThreadLoading: boolean,
  threadId?: string,
) {
  return useSuspenseQuery(currentThreadQueryOptions(lessonId, isThreadLoading, threadId));
}
