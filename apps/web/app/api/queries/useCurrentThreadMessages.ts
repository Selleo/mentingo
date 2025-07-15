import { queryOptions, useQuery, useSuspenseQuery } from "@tanstack/react-query";

import { ApiClient } from "~/api/api-client";

export const currentThreadQueryOptions = (threadId: string) =>
  queryOptions({
    queryKey: ["threadMessages", { threadId }],
    queryFn: async () => {
      const response = await ApiClient.api.aiControllerGetThreadMessages({ thread: threadId });
      return response.data;
    },
  });

export function useCurrentThreadMessages(threadId: string) {
  return useQuery(currentThreadQueryOptions(threadId));
}
export function useSuspenseCurrentThreadMessages(threadId: string) {
  return useSuspenseQuery(currentThreadQueryOptions(threadId));
}
