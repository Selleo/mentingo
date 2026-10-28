import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { ApiClient } from "../api-client";

export function useCompetencySubjectDocuments(
  subjectId: string,
  query: NonNullable<
    Parameters<typeof ApiClient.api.competenciesControllerGetCompetencySubjectDocuments>[1]
  >,
  enabled = true,
) {
  return useQuery({
    queryKey: ["competencies", "documents", subjectId, query],
    queryFn: async () =>
      (await ApiClient.api.competenciesControllerGetCompetencySubjectDocuments(subjectId, query))
        .data.data,
    enabled: enabled && Boolean(subjectId),
    placeholderData: keepPreviousData,
  });
}
