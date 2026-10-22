import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { ApiClient } from "../api-client";

export function useCompetencyRecords(
  query: Parameters<typeof ApiClient.api.competenciesControllerGetCompetencyRecords>[0],
  enabled = true,
) {
  return useQuery({
    queryKey: ["competencies", "records", query],
    queryFn: async () =>
      (await ApiClient.api.competenciesControllerGetCompetencyRecords(query)).data.data,
    enabled,
    placeholderData: keepPreviousData,
  });
}
