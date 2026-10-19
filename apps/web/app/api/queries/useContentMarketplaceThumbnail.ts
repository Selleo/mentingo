import { useQuery } from "@tanstack/react-query";

import { ApiClient } from "../api-client";

import { CONTENT_MARKETPLACE_LISTINGS_QUERY_KEY } from "./useContentMarketplaceListings";

export function useContentMarketplaceThumbnail(listingId: string, enabled: boolean) {
  return useQuery({
    queryKey: [...CONTENT_MARKETPLACE_LISTINGS_QUERY_KEY, listingId, "thumbnail"],
    queryFn: async () =>
      (
        await ApiClient.api.contentMarketplaceControllerStreamContentMarketplaceThumbnail(
          listingId,
          { format: "blob" },
        )
      ).data as unknown as Blob,
    enabled,
    staleTime: Infinity,
  });
}
