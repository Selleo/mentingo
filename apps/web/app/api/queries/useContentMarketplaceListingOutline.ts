import { useQuery } from "@tanstack/react-query";

import { ApiClient } from "../api-client";

import type { SupportedLanguages } from "@repo/shared";

export const CONTENT_MARKETPLACE_LISTING_OUTLINE_QUERY_KEY = ["content-marketplace", "outline"];

export function useContentMarketplaceListingOutline(
  listingId: string,
  versionId: string,
  language: SupportedLanguages,
  enabled: boolean,
) {
  return useQuery({
    queryKey: [...CONTENT_MARKETPLACE_LISTING_OUTLINE_QUERY_KEY, listingId, versionId, language],
    queryFn: async ({ signal }) =>
      (
        await ApiClient.api.contentMarketplaceControllerGetContentMarketplaceListingOutline(
          listingId,
          { language },
          { signal },
        )
      ).data.data,
    enabled,
    staleTime: Infinity,
    retry: false,
  });
}
