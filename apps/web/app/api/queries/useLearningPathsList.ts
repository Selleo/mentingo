import { useQuery, useSuspenseQuery } from "@tanstack/react-query";

import { ApiClient } from "../api-client";

import type { SupportedLanguages } from "@repo/shared";

export const LEARNING_PATHS_QUERY_KEY = ["learning-paths"];

export type LearningPathListParams = {
  page?: number;
  perPage?: number;
  language?: SupportedLanguages;
  searchQuery?: string;
};

type QueryOptions = {
  enabled?: boolean;
};

export const learningPathsQueryOptions = (
  params: LearningPathListParams = {},
  options: QueryOptions = { enabled: true },
) => ({
  queryKey: [...LEARNING_PATHS_QUERY_KEY, params],
  queryFn: async () => {
    const response = await ApiClient.api.learningPathControllerGetLearningPaths({
      page: params.page ?? 1,
      perPage: params.perPage ?? 100,
      language: params.language,
      searchQuery: params.searchQuery,
    });

    return response.data;
  },
  ...options,
});

export function useLearningPaths(params?: LearningPathListParams, options?: QueryOptions) {
  return useQuery(learningPathsQueryOptions(params, options));
}

export function useLearningPathsSuspense(params?: LearningPathListParams, options?: QueryOptions) {
  return useSuspenseQuery(learningPathsQueryOptions(params, options));
}
