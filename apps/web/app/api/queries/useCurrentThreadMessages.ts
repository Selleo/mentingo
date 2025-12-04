import { queryOptions, useQuery, useSuspenseQuery } from "@tanstack/react-query";

import { ApiClient } from "~/api/api-client";

interface CurrentThreadQueryParams {
  isThreadLoading: boolean;
  threadId?: string;
  studentId?: string | null;
}

export const getCurrentThreadMessagesQueryKey = (threadId: string) => [
  "threadMessages",
  { threadId },
];

export const currentThreadQueryOptions = ({
  isThreadLoading,
  threadId,
}: CurrentThreadQueryParams) =>
  queryOptions({
    enabled: !!threadId && !isThreadLoading,
    queryKey: ["threadMessages", { threadId }],
    queryFn: async () => {
      const response = await ApiClient.api.aiControllerGetThreadMessages({
        thread: threadId,
      });
      return response.data;
    },
  });

export function useCurrentThreadMessages({ isThreadLoading, threadId }: CurrentThreadQueryParams) {
  return useQuery(currentThreadQueryOptions({ isThreadLoading, threadId }));
}
export function useSuspenseCurrentThreadMessages({
  isThreadLoading,
  threadId,
}: CurrentThreadQueryParams) {
  return useSuspenseQuery(currentThreadQueryOptions({ isThreadLoading, threadId }));
}
