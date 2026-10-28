import { useQuery } from "@tanstack/react-query";

import { ApiClient } from "../api-client";

export function useCompetenciesSummary(enabled = true) {
  return useQuery({
    queryKey: ["competencies", "summary"],
    queryFn: async () =>
      (await ApiClient.api.competenciesControllerGetCompetenciesSummary()).data.data,
    enabled,
  });
}
