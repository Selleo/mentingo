import { useQuery } from "@tanstack/react-query";

import { ApiClient } from "../api-client";

export const CONTENT_MARKETPLACE_THUMBNAIL_QUERY_KEY = ["content-marketplace", "thumbnail"];

export function useContentMarketplaceThumbnail(
  listingId: string,
  versionId: string,
  enabled: boolean,
) {
  return useQuery({
    queryKey: [...CONTENT_MARKETPLACE_THUMBNAIL_QUERY_KEY, listingId, versionId],
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
