import { useInfiniteQuery } from "@tanstack/react-query";

import { ApiClient } from "~/api/api-client";

export function useAdminAiThreadMessages(threadId: string) {
  return useInfiniteQuery({
    queryKey: ["admin-ai-thread-messages", threadId],
    initialPageParam: 1,
    queryFn: async ({ pageParam }) =>
      (
        await ApiClient.api.adminAiThreadsControllerGetAdminAiThreadMessages(threadId, {
          page: pageParam,
          perPage: 100,
        })
      ).data,
    getNextPageParam: ({ pagination }) => {
      if (pagination.page * pagination.perPage >= pagination.totalItems) return undefined;
      return pagination.page + 1;
    },
  });
}
