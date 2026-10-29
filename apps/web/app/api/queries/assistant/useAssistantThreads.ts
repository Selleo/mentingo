import { useInfiniteQuery } from "@tanstack/react-query";

import { ApiClient } from "~/api/api-client";
import {
  currentAssistantScope,
  inAssistantSession,
  useAssistantScope,
  type AssistantScope,
} from "~/api/assistantIdentity";

export const assistantThreadsKey = (scope: AssistantScope | undefined = currentAssistantScope()) =>
  [...(scope ?? ["assistant", "anonymous"]), "threads"] as const;
export function useAssistantThreads(query: string, archived: boolean) {
  const scope = useAssistantScope();
  return useInfiniteQuery({
    queryKey: [...assistantThreadsKey(scope), { query, archived }],
    enabled: Boolean(scope),
    initialPageParam: 1,
    queryFn: async ({ pageParam }) =>
      inAssistantSession(
        scope,
        async () =>
          (
            await ApiClient.api.assistantControllerListThreads({
              page: pageParam,
              perPage: 30,
              query: query || undefined,
              archived,
            })
          ).data.data,
      ),
    getNextPageParam: (last) =>
      last.page * last.perPage < last.totalItems ? last.page + 1 : undefined,
  });
}
