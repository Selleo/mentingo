import { useQuery } from "@tanstack/react-query";

import { ApiClient } from "../api-client";

export const CONTENT_MARKETPLACE_FILTER_OPTIONS_QUERY_KEY = [
  "content-marketplace",
  "filter-options",
];

export function useContentMarketplaceFilterOptions() {
  return useQuery({
    queryKey: CONTENT_MARKETPLACE_FILTER_OPTIONS_QUERY_KEY,
    queryFn: async ({ signal }) =>
      (
        await ApiClient.api.contentMarketplaceControllerGetContentMarketplaceFilterOptions({
          signal,
        })
      ).data.data,
  });
}
