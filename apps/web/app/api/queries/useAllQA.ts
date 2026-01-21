import { queryOptions, useQuery } from "@tanstack/react-query";

import { ApiClient } from "~/api/api-client";
import { QA_QUERY_KEY } from "~/api/queries/useQA";

import type { SupportedLanguages } from "@repo/shared";

export type AllQAParams = {
  language: SupportedLanguages;
  searchQuery?: string;
};

type QueryOptions = {
  enabled?: boolean;
};

export const allQAQueryOptions = (language: SupportedLanguages) =>
  queryOptions({
    queryKey: [QA_QUERY_KEY],
    queryFn: async () => {
      const response = await ApiClient.api.qaControllerGetAllQa({ language });

      return response.data;
    },
  });

export const qaSearchQueryOptions = (
  params: { searchQuery: string; language?: SupportedLanguages },
  options: QueryOptions = { enabled: true },
) =>
  queryOptions({
    queryKey: ["qa-search", params],
    queryFn: async () => {
      const response = await ApiClient.api.qaControllerGetAllQa({
        language: params?.language ?? "en",
        searchQuery: params.searchQuery,
      });
      return response.data;
    },
    ...options,
  });

export default function useAllQA(language: SupportedLanguages) {
  return useQuery(allQAQueryOptions(language));
}
