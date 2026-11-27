import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { ApiClient } from "../api-client";

export function useCompetencyTracks(
  query: NonNullable<Parameters<typeof ApiClient.api.competenciesControllerGetCompetencyTracks>[0]>,
  enabled = true,
) {
  return useQuery({
    queryKey: ["competencies", "tracks", query],
    queryFn: async () =>
      (await ApiClient.api.competenciesControllerGetCompetencyTracks(query)).data.data,
    enabled,
    placeholderData: keepPreviousData,
  });
}
