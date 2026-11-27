import { useInfiniteQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { ApiClient } from "~/api/api-client";
import {
  currentAssistantScope,
  inAssistantSession,
  useAssistantScope,
  type AssistantScope,
} from "~/api/assistantIdentity";

import {
  assistantTranscriptRefetchInterval,
  keepNewerAssistantTranscript,
} from "./assistantTranscriptCache";
import { useAssistantMessagesRealtime } from "./useAssistantMessagesRealtime";

export const assistantMessagesKey = (
  threadId: string,
  scope: AssistantScope | undefined = currentAssistantScope(),
) => [...(scope ?? ["assistant", "anonymous"]), "messages", threadId] as const;
export function useAssistantMessages(threadId: string) {
  const [, origin, tenant, actor] = useAssistantScope() ?? [];
  const scope = useMemo<AssistantScope | undefined>(
    () =>
      origin !== undefined && tenant !== undefined && actor !== undefined
        ? ["assistant", origin, tenant, actor]
        : undefined,
    [actor, origin, tenant],
  );
  const queryKey = useMemo(() => assistantMessagesKey(threadId, scope), [scope, threadId]);
  const query = useInfiniteQuery({
    queryKey,
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
    structuralSharing: keepNewerAssistantTranscript,
    refetchInterval: (query) => assistantTranscriptRefetchInterval(query.state.data),
    retry: false,
  });
  useAssistantMessagesRealtime({ threadId, scope, queryKey });
  return query;
}
