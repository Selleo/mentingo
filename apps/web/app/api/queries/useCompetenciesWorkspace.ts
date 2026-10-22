import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { ApiClient } from "../api-client";

export function useCompetenciesWorkspace(
  query: Parameters<typeof ApiClient.api.competenciesControllerGetCompetenciesWorkspace>[0],
) {
  return useQuery({
    queryKey: ["competencies", "workspace", query],
    placeholderData: keepPreviousData,
    queryFn: async () =>
      (await ApiClient.api.competenciesControllerGetCompetenciesWorkspace(query)).data.data,
  });
}
