import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { ApiClient } from "../api-client";

export function useCompetencyProfiles(
  query: NonNullable<
    Parameters<typeof ApiClient.api.competenciesControllerGetCompetencyProfiles>[0]
  >,
  enabled = true,
) {
  return useQuery({
    queryKey: ["competencies", "profiles", query],
    queryFn: async () =>
      (await ApiClient.api.competenciesControllerGetCompetencyProfiles(query)).data.data,
    enabled,
    placeholderData: keepPreviousData,
  });
}
