import { useInfiniteQuery } from "@tanstack/react-query";

import { ApiClient } from "~/api/api-client";
import { isAssistantRunActive } from "~/modules/Assistant/assistant.types";

export const assistantMessagesKey = (threadId: string) =>
  ["assistant", "messages", threadId] as const;
export function useAssistantMessages(threadId: string) {
  return useInfiniteQuery({
    queryKey: assistantMessagesKey(threadId),
    enabled: Boolean(threadId),
    staleTime: 0,
    initialPageParam: 1,
    queryFn: async ({ pageParam }) =>
      (
        await ApiClient.api.assistantControllerListMessages(threadId, {
          page: pageParam,
          perPage: 50,
        })
      ).data.data,
    getNextPageParam: (last) =>
      last.page * last.perPage < last.totalItems ? last.page + 1 : undefined,
    refetchInterval: (query) => {
      const page = query.state.data?.pages[0];
      const pendingMessage = page?.items.some(
        (message) =>
          message.role === "assistant" &&
          (message.status === "pending" || message.status === "running"),
      );
      // A terminal run can arrive just before its final message snapshot.
      return isAssistantRunActive(page?.latestRun) || pendingMessage ? 1000 : false;
    },
    retry: false,
  });
}
