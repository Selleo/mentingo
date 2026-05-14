import { useQuery, useSuspenseQuery } from "@tanstack/react-query";

import { ApiClient } from "../api-client";

import { LEARNING_PATHS_QUERY_KEY } from "./useLearningPathsList";

import type { SupportedLanguages } from "@repo/shared";

type LearningPathSingleParams = {
  language?: SupportedLanguages;
};

type QueryOptions = {
  enabled?: boolean;
};

export const learningPathQueryOptions = (
  learningPathId: string,
  params: LearningPathSingleParams = {},
  options: QueryOptions = { enabled: true },
) => ({
  queryKey: [...LEARNING_PATHS_QUERY_KEY, learningPathId, params],
  queryFn: async () => {
    const response = await ApiClient.api.learningPathControllerGetLearningPathById(learningPathId, {
      language: params.language,
    });

    return response.data;
  },
  ...options,
});

export function useLearningPath(
  learningPathId: string,
  params?: LearningPathSingleParams,
  options?: QueryOptions,
) {
  return useQuery(learningPathQueryOptions(learningPathId, params, options));
}

export function useLearningPathSuspense(
  learningPathId: string,
  params?: LearningPathSingleParams,
  options?: QueryOptions,
) {
  return useSuspenseQuery(learningPathQueryOptions(learningPathId, params, options));
}
