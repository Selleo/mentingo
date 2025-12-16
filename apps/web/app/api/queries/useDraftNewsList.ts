import { useQuery, useSuspenseQuery } from "@tanstack/react-query";

import { ApiClient } from "../api-client";

import type { NewsListParams } from "./useNewsList";

type DraftNewsQueryOptions = {
  enabled?: boolean;
};

export const DRAFT_NEWS_LIST_QUERY_KEY = ["news-draft-list"];

export const draftNewsListQueryOptions = (
  params?: NewsListParams,
  options: DraftNewsQueryOptions = { enabled: true },
) => ({
  queryKey: [...DRAFT_NEWS_LIST_QUERY_KEY, params],
  queryFn: async () => {
    const response = await ApiClient.api.newsControllerGetDraftNewsList({
      language: params?.language ?? "en",
      page: params?.page,
    });
    return response.data;
  },
  ...options,
});

export function useDraftNewsList(params?: NewsListParams, options?: DraftNewsQueryOptions) {
  return useQuery(draftNewsListQueryOptions(params, options));
}

export function useDraftNewsListSuspense(params?: NewsListParams, options?: DraftNewsQueryOptions) {
  return useSuspenseQuery(draftNewsListQueryOptions(params, options));
}
