import { SUPPORTED_LANGUAGES, type SupportedLanguages } from "@repo/shared";
import { useQuery } from "@tanstack/react-query";

import { ApiClient } from "../api-client";

type GlobalSearchParams = {
  searchQuery: string;
  language?: SupportedLanguages;
};

type QueryOptions = {
  enabled?: boolean;
};

export const GLOBAL_SEARCH_QUERY_KEY = ["global-search"];

export const globalSearchQueryOptions = (
  searchParams: GlobalSearchParams,
  options: QueryOptions = { enabled: true },
) => ({
  queryKey: [...GLOBAL_SEARCH_QUERY_KEY, searchParams],
  queryFn: async () => {
    const response = await ApiClient.api.globalSearchControllerSearch({
      searchQuery: searchParams.searchQuery,
      language: searchParams.language ?? SUPPORTED_LANGUAGES.EN,
    });

    return response.data.data;
  },
  ...options,
});

export function useGlobalSearch(searchParams: GlobalSearchParams, options?: QueryOptions) {
  return useQuery(globalSearchQueryOptions(searchParams, options));
}
