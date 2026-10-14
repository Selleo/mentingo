import {
  SUPPORTED_LANGUAGES,
  type SupportedLanguages,
  type GlobalSearchMode,
  GLOBAL_SEARCH_MODES,
} from "@repo/shared";
import { useQuery } from "@tanstack/react-query";

import { ApiClient } from "../api-client";

import type { QueryFunctionContext } from "@tanstack/react-query";

type GlobalSearchParams = {
  searchQuery: string;
  language?: SupportedLanguages;
  mode?: GlobalSearchMode;
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
  queryFn: async ({ signal }: QueryFunctionContext) => {
    const response = await ApiClient.api.globalSearchControllerSearch(
      {
        searchQuery: searchParams.searchQuery,
        mode: searchParams.mode ?? GLOBAL_SEARCH_MODES.KEYWORD,
        language: searchParams.language ?? SUPPORTED_LANGUAGES.EN,
      },
      { signal },
    );

    return response.data.data;
  },
  ...options,
});

export function useGlobalSearch(searchParams: GlobalSearchParams, options?: QueryOptions) {
  return useQuery(globalSearchQueryOptions(searchParams, options));
}
