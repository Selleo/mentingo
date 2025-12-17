import { useQuery, useSuspenseQuery } from "@tanstack/react-query";

import { ApiClient } from "../api-client";

export type NewsListParams = {
  language?: "en" | "pl";
  page?: number;
  perPage?: number;
};

type QueryOptions = {
  enabled?: boolean;
};

export const NEWS_LIST_QUERY_KEY = ["news-list"];

export const newsListQueryOptions = (
  params?: NewsListParams,
  options: QueryOptions = { enabled: true },
) => ({
  queryKey: [...NEWS_LIST_QUERY_KEY, params],
  queryFn: async () => {
    const response = await ApiClient.api.newsControllerGetNewsList({
      language: params?.language ?? "en",
      page: params?.page,
    });
    return response.data;
  },
  ...options,
});

export function useNewsList(params?: NewsListParams, options?: QueryOptions) {
  return useQuery(newsListQueryOptions(params, options));
}

export function useNewsListSuspense(params?: NewsListParams, options?: QueryOptions) {
  return useSuspenseQuery(newsListQueryOptions(params, options));
}
