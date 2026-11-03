import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { ApiClient } from "../api-client";

export function useCompetencyCatalog(
  query: NonNullable<
    Parameters<typeof ApiClient.api.competenciesControllerGetCompetencyCatalog>[0]
  >,
  enabled = true,
) {
  return useQuery({
    queryKey: ["competencies", "catalog", query],
    queryFn: async () =>
      (await ApiClient.api.competenciesControllerGetCompetencyCatalog(query)).data.data,
    enabled,
    placeholderData: keepPreviousData,
  });
}
