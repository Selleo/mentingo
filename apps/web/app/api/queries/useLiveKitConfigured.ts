import { queryOptions, useQuery } from "@tanstack/react-query";

import { ApiClient } from "../api-client";

export const liveKitConfiguredQueryOptions = queryOptions({
  queryKey: ["livekitConfigured"],
  queryFn: async () => {
    const response = await ApiClient.api.envControllerGetLiveKitConfigured();

    return response.data.data;
  },
});

export function useLiveKitConfigured() {
  return useQuery(liveKitConfiguredQueryOptions);
}
