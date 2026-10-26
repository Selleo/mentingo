import { ASSISTANT_MESSAGE_ROLES, ASSISTANT_MESSAGE_STATUSES } from "@repo/shared";
import { useInfiniteQuery } from "@tanstack/react-query";

import { ApiClient } from "~/api/api-client";
import {
  currentAssistantScope,
  inAssistantSession,
  useAssistantScope,
  type AssistantScope,
} from "~/api/assistantIdentity";
import { isAssistantRunActive } from "~/modules/Assistant/assistant.types";

export const assistantMessagesKey = (
  threadId: string,
  scope: AssistantScope | undefined = currentAssistantScope(),
) => [...(scope ?? ["assistant", "anonymous"]), "messages", threadId] as const;
export function useAssistantMessages(threadId: string) {
  const scope = useAssistantScope();
  return useInfiniteQuery({
    queryKey: assistantMessagesKey(threadId, scope),
    enabled: Boolean(threadId && scope),
    staleTime: 0,
    initialPageParam: 1,
    queryFn: async ({ pageParam }) =>
      inAssistantSession(
        scope,
        async () =>
          (
            await ApiClient.api.assistantControllerListMessages(threadId, {
              page: pageParam,
              perPage: 50,
            })
          ).data.data,
      ),
    getNextPageParam: (last) =>
      last.page * last.perPage < last.totalItems ? last.page + 1 : undefined,
    refetchInterval: (query) => {
      const page = query.state.data?.pages[0];
      const pendingMessage = page?.items.some(
        (message) =>
          message.role === ASSISTANT_MESSAGE_ROLES.ASSISTANT &&
          (message.status === ASSISTANT_MESSAGE_STATUSES.PENDING ||
            message.status === ASSISTANT_MESSAGE_STATUSES.RUNNING),
      );
      // A terminal run can arrive just before its final message snapshot.
      return isAssistantRunActive(page?.latestRun) || pendingMessage ? 1000 : false;
    },
    retry: false,
  });
}
