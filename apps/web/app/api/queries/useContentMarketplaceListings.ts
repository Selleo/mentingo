import { useQuery } from "@tanstack/react-query";

import { ApiClient } from "../api-client";

export const CONTENT_MARKETPLACE_LISTINGS_QUERY_KEY = ["content-marketplace", "listings"];
type MarketplaceListingsQuery = NonNullable<
  Parameters<typeof ApiClient.api.contentMarketplaceControllerListContentMarketplaceListings>[0]
>;

export function useContentMarketplaceListings(query: MarketplaceListingsQuery, enabled = true) {
  return useQuery({
    queryKey: [...CONTENT_MARKETPLACE_LISTINGS_QUERY_KEY, query],
    enabled,
    queryFn: async ({ signal }) =>
      (
        await ApiClient.api.contentMarketplaceControllerListContentMarketplaceListings(query, {
          signal,
        })
      ).data,
  });
}
