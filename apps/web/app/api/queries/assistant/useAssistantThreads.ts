import { useInfiniteQuery } from "@tanstack/react-query";

import { ApiClient } from "~/api/api-client";

export const assistantThreadsKey = ["assistant", "threads"] as const;
export function useAssistantThreads(query: string, archived: boolean) {
  return useInfiniteQuery({
    queryKey: [...assistantThreadsKey, { query, archived }],
    initialPageParam: 1,
    queryFn: async ({ pageParam }) =>
      (
        await ApiClient.api.assistantControllerListThreads({
          page: pageParam,
          perPage: 30,
          query: query || undefined,
          archived,
        })
      ).data.data,
    getNextPageParam: (last) =>
      last.page * last.perPage < last.totalItems ? last.page + 1 : undefined,
  });
}
