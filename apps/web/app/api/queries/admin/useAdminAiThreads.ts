import { useQuery } from "@tanstack/react-query";

import { ApiClient } from "~/api/api-client";

export type AdminAiThreadsParams = NonNullable<
  Parameters<typeof ApiClient.api.adminAiThreadsControllerGetAdminAiThreadSummaries>[0]
>;

export function useAdminAiThreads(params: AdminAiThreadsParams) {
  return useQuery({
    queryKey: ["admin-ai-threads", params],
    queryFn: async () =>
      (await ApiClient.api.adminAiThreadsControllerGetAdminAiThreadSummaries(params)).data,
  });
}
