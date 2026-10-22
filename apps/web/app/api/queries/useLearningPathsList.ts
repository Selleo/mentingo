import {
  infiniteQueryOptions,
  useQuery,
  useSuspenseInfiniteQuery,
  useSuspenseQuery,
} from "@tanstack/react-query";

import { ApiClient } from "../api-client";

import type { SupportedLanguages } from "@repo/shared";

export const LEARNING_PATHS_QUERY_KEY = ["learning-paths"];
export const LEARNING_PATHS_PAGE_SIZE = 10;

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

export type InfiniteLearningPathListParams = Omit<LearningPathListParams, "page" | "perPage">;

export const infiniteLearningPathsQueryOptions = (
  params: InfiniteLearningPathListParams = {},
  perPage = LEARNING_PATHS_PAGE_SIZE,
) =>
  infiniteQueryOptions({
    queryKey: [...LEARNING_PATHS_QUERY_KEY, "infinite", params, perPage],
    queryFn: async ({ pageParam }) => {
      const response = await ApiClient.api.learningPathControllerGetLearningPaths({
        page: pageParam,
        perPage,
        language: params.language,
        searchQuery: params.searchQuery,
      });

      return response.data;
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      const loadedItemCount = lastPage.pagination.page * lastPage.pagination.perPage;
      if (loadedItemCount >= lastPage.pagination.totalItems) return undefined;

      return lastPage.pagination.page + 1;
    },
  });

export function useSuspenseInfiniteLearningPaths(params?: InfiniteLearningPathListParams) {
  return useSuspenseInfiniteQuery(infiniteLearningPathsQueryOptions(params));
}
