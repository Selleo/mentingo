import { useQuery } from "@tanstack/react-query";

import { ApiClient } from "../api-client";

export const CONTENT_MARKETPLACE_CONFIGURATION_QUERY_KEY = ["content-marketplace", "configuration"];

export function useContentMarketplaceConfiguration(enabled = true) {
  return useQuery({
    queryKey: CONTENT_MARKETPLACE_CONFIGURATION_QUERY_KEY,
    queryFn: async () =>
      (await ApiClient.api.contentMarketplaceControllerGetContentMarketplaceAvailability()).data
        .data,
    enabled,
    staleTime: 30000,
  });
}
