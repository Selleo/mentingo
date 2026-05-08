import { queryOptions, useQuery } from "@tanstack/react-query";

import { ApiClient } from "~/api/api-client";

import type { GetLearningPathExportsResponse } from "~/api/generated-api";

export const LEARNING_PATH_EXPORTS_QUERY_KEY = ["learning-path-exports", "admin"] as const;

export type LearningPathExportLink = GetLearningPathExportsResponse["data"][number];

export const learningPathExportsQueryOptions = (learningPathId: string, enabled = true) =>
  queryOptions({
    queryKey: [...LEARNING_PATH_EXPORTS_QUERY_KEY, learningPathId],
    enabled: Boolean(learningPathId) && enabled,
    queryFn: async (): Promise<GetLearningPathExportsResponse> => {
      const response =
        await ApiClient.api.learningPathExportControllerGetLearningPathExports(learningPathId);
      return response.data;
    },
    select: (response) => response.data,
  });

export function useLearningPathExports(learningPathId: string, enabled = true) {
  return useQuery(learningPathExportsQueryOptions(learningPathId, enabled));
}
