import { queryOptions, useQuery } from "@tanstack/react-query";

import { ApiClient } from "~/api/api-client";

export const POST_HOG_QUERY_KEY = "posthogConfig";

export const postHogQueryOptions = () =>
  queryOptions({
    queryKey: [POST_HOG_QUERY_KEY],
    queryFn: async () => {
      const response = await ApiClient.api.envControllerGetPostHogConfig();

      return response.data;
    },
  });

export function usePostHogConfig() {
  return useQuery(postHogQueryOptions());
}
