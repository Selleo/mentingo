import { queryOptions, useQuery } from "@tanstack/react-query";

import { ApiClient } from "../api-client";

import type { SupportedLanguages } from "@repo/shared";

export type ArticlesSearchParams = {
  searchQuery: string;
  language?: SupportedLanguages;
};

type QueryOptions = {
  enabled?: boolean;
};

export const ARTICLES_SEARCH_QUERY_KEY = ["articles-search"];

export const articlesSearchQueryOptions = (
  params: ArticlesSearchParams,
  options: QueryOptions = { enabled: true },
) =>
  queryOptions({
    queryKey: [...ARTICLES_SEARCH_QUERY_KEY, params],
    queryFn: async () => {
      const response = await ApiClient.api.articlesControllerGetArticles({
        language: params?.language ?? "en",
        searchQuery: params.searchQuery,
      });
      return response.data;
    },
    ...options,
  });

export function useArticlesSearch(params: ArticlesSearchParams, options?: QueryOptions) {
  return useQuery(articlesSearchQueryOptions(params, options));
}
