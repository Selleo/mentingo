import { queryOptions, useQuery } from "@tanstack/react-query";

import { ApiClient } from "~/api/api-client";

export const lumaConfiguredQueryOptions = () =>
  queryOptions({
    queryKey: ["lumaConfigured"],
    queryFn: async () => {
      const response = await ApiClient.api.envControllerGetLumaConfigured();

      return response.data;
    },
    select: (data) => data.data,
  });

export function useLumaConfigured() {
  return useQuery(lumaConfiguredQueryOptions());
}
