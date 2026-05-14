import { queryOptions, useQuery } from "@tanstack/react-query";

import { ApiClient } from "~/api/api-client";

import type { GetLearningPathExportCandidatesResponse } from "~/api/generated-api";

export const LEARNING_PATH_EXPORT_CANDIDATES_QUERY_KEY = [
  "learning-path-export-candidates",
  "admin",
] as const;

export const learningPathExportCandidatesQueryOptions = (learningPathId: string, enabled = true) =>
  queryOptions({
    queryKey: [...LEARNING_PATH_EXPORT_CANDIDATES_QUERY_KEY, learningPathId],
    enabled: Boolean(learningPathId) && enabled,
    queryFn: async (): Promise<GetLearningPathExportCandidatesResponse> => {
      const response =
        await ApiClient.api.learningPathExportControllerGetLearningPathExportCandidates(
          learningPathId,
        );
      return response.data;
    },
    select: (response) => response.data,
  });

export function useLearningPathExportCandidates(learningPathId: string, enabled = true) {
  return useQuery(learningPathExportCandidatesQueryOptions(learningPathId, enabled));
}
