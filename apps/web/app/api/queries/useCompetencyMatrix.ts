import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { ApiClient } from "../api-client";

export function useCompetencyMatrix(
  query: NonNullable<Parameters<typeof ApiClient.api.competenciesControllerGetCompetencyMatrix>[0]>,
  enabled = true,
) {
  return useQuery({
    queryKey: ["competencies", "matrix", query],
    queryFn: async () =>
      (await ApiClient.api.competenciesControllerGetCompetencyMatrix(query)).data.data,
    enabled,
    placeholderData: keepPreviousData,
  });
}
