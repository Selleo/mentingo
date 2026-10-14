import { keepPreviousData, queryOptions, useQuery } from "@tanstack/react-query";

import { ApiClient } from "~/api/api-client";

import type { GetLearningPathExportCandidatesResponse } from "~/api/generated-api";
import type { ExportCandidatesSearchParams } from "~/api/queries/admin/exportCandidates.types";

export const LEARNING_PATH_EXPORT_CANDIDATES_QUERY_KEY = [
  "learning-path-export-candidates",
  "admin",
] as const;

export const learningPathExportCandidatesQueryOptions = (
  learningPathId: string,
  searchParams: ExportCandidatesSearchParams,
  enabled = true,
) =>
  queryOptions({
    queryKey: [...LEARNING_PATH_EXPORT_CANDIDATES_QUERY_KEY, learningPathId, searchParams],
    enabled: Boolean(learningPathId) && enabled,
    placeholderData: keepPreviousData,
    queryFn: async (): Promise<GetLearningPathExportCandidatesResponse> => {
      const response =
        await ApiClient.api.learningPathExportControllerGetLearningPathExportCandidates(
          learningPathId,
          searchParams,
        );
      return response.data;
    },
  });

export function useLearningPathExportCandidates(
  learningPathId: string,
  searchParams: ExportCandidatesSearchParams,
  enabled = true,
) {
  return useQuery(learningPathExportCandidatesQueryOptions(learningPathId, searchParams, enabled));
}
