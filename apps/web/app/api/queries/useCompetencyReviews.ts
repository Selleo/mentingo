import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { ApiClient } from "../api-client";

export function useCompetencyReviews(
  query: NonNullable<
    Parameters<typeof ApiClient.api.competenciesControllerGetCompetencyReviews>[0]
  >,
  enabled = true,
) {
  return useQuery({
    queryKey: ["competencies", "reviews", query],
    queryFn: async () =>
      (await ApiClient.api.competenciesControllerGetCompetencyReviews(query)).data.data,
    enabled,
    placeholderData: keepPreviousData,
  });
}
