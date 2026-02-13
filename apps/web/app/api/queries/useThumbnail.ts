import { VIDEO_EMBED_PROVIDERS } from "@repo/shared";
import { queryOptions, useQuery } from "@tanstack/react-query";

import { ApiClient } from "../api-client";

import type { VideoProvider } from "@repo/shared";

export const THUMBNAIL_QUERY_KEY = ["thumbnail"];

export const thumbnailQueryOptions = (sourceUrl?: string | null, provider?: VideoProvider) =>
  queryOptions({
    enabled: !!sourceUrl,
    queryKey: [THUMBNAIL_QUERY_KEY, { sourceUrl, provider }],
    queryFn: async () => {
      const response = await ApiClient.api.fileControllerGetThumbnail({
        sourceUrl: sourceUrl ?? "",
        provider: provider ?? VIDEO_EMBED_PROVIDERS.UNKNOWN,
      });

      return response.data;
    },
    select: (data) => data.data,
  });

export function useThumbnail(sourceUrl?: string | null, provider?: VideoProvider) {
  return useQuery(thumbnailQueryOptions(sourceUrl, provider));
}
