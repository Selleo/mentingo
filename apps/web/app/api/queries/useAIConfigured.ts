import { queryOptions, useQuery } from "@tanstack/react-query";

import { ApiClient } from "~/api/api-client";

export const aiConfiguredQueryOptions = () =>
  queryOptions({
    queryKey: ["aiConfigured"],
    queryFn: async () => {
      const response = await ApiClient.api.envControllerGetAiConfigured();

      return response.data;
    },
    select: (data) => data.data,
  });

export function useAIConfigured() {
  return useQuery(aiConfiguredQueryOptions());
}
