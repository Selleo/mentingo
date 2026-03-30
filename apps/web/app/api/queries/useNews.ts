import { SUPPORTED_LANGUAGES, type SupportedLanguages } from "@repo/shared";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";

import { ApiClient } from "../api-client";

import type { GetNewsResponse } from "../generated-api";

export type NewsQueryParams = {
  language?: SupportedLanguages;
};

type QueryOptions = {
  enabled?: boolean;
};

export const NEWS_QUERY_KEY = ["news"];

export const newsQueryOptions = (
  id: string,
  params?: NewsQueryParams,
  options: QueryOptions = { enabled: true },
) => ({
  queryKey: [...NEWS_QUERY_KEY, id, params?.language ?? SUPPORTED_LANGUAGES.EN],
  queryFn: async () => {
    const response = await ApiClient.api.newsControllerGetNews(id, {
      language: params?.language ?? SUPPORTED_LANGUAGES.EN,
    });
    return response.data;
  },
  select: (data: GetNewsResponse) => data.data,
  ...options,
});

export function useNews(id: string, params?: NewsQueryParams, options?: QueryOptions) {
  return useQuery(newsQueryOptions(id, params, options));
}

export function useNewsSuspense(id: string, params?: NewsQueryParams, options?: QueryOptions) {
  return useSuspenseQuery(newsQueryOptions(id, params, options));
}
