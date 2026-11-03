import { useQuery } from "@tanstack/react-query";

import { ApiClient } from "../api-client";

export function useCompetenciesConfiguration(enabled = true) {
  return useQuery({
    queryKey: ["competencies", "configuration"],
    queryFn: async () =>
      (await ApiClient.api.competenciesControllerGetCompetenciesConfiguration()).data.data,
    enabled,
    staleTime: 30000,
  });
}
