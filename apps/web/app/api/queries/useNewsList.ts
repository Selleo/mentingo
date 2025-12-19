import { queryOptions, useQuery, useSuspenseQuery } from "@tanstack/react-query";

import { ApiClient } from "../api-client";

import type { SupportedLanguages } from "@repo/shared";

export type NewsListParams = {
  language?: SupportedLanguages;
  page?: number;
  perPage?: number;
  searchQuery?: string;
};

type QueryOptions = {
  enabled?: boolean;
};

export const NEWS_LIST_QUERY_KEY = ["news-list"];

export const newsListQueryOptions = (
  params?: NewsListParams,
  options: QueryOptions = { enabled: true },
) =>
  queryOptions({
    queryKey: [...NEWS_LIST_QUERY_KEY, params],
    queryFn: async () => {
      const response = await ApiClient.api.newsControllerGetNewsList({
        language: params?.language ?? "en",
        page: params?.page,
        searchQuery: params?.searchQuery,
      });
      return response.data;
    },
    ...options,
  });

export const newsSearchQueryOptions = (
  params: { searchQuery: string; language?: SupportedLanguages },
  options: QueryOptions = { enabled: true },
) =>
  queryOptions({
    queryKey: ["news-search", params],
    queryFn: async () => {
      const response = await ApiClient.api.newsControllerGetNewsList({
        language: params?.language ?? "en",
        searchQuery: params.searchQuery,
      });
      return response.data;
    },
    select: (data) => data.data,
    ...options,
  });

export function useNewsList(params?: NewsListParams, options?: QueryOptions) {
  return useQuery(newsListQueryOptions(params, options));
}

export function useNewsListSuspense(params?: NewsListParams, options?: QueryOptions) {
  return useSuspenseQuery(newsListQueryOptions(params, options));
}
