import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { ApiClient } from "../api-client";

export function useCompetencyCategories(
  query: NonNullable<
    Parameters<typeof ApiClient.api.competenciesControllerGetCompetencyCategories>[0]
  >,
  enabled = true,
) {
  return useQuery({
    queryKey: ["competencies", "categories", query],
    queryFn: async () =>
      (await ApiClient.api.competenciesControllerGetCompetencyCategories(query)).data.data,
    enabled,
    placeholderData: keepPreviousData,
  });
}
