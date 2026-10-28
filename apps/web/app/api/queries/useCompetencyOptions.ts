import { useQuery } from "@tanstack/react-query";

import { ApiClient } from "../api-client";

export function useCompetencyOptions(
  query: NonNullable<
    Parameters<typeof ApiClient.api.competenciesControllerGetCompetencyOptions>[0]
  >,
  enabled = true,
) {
  return useQuery({
    queryKey: ["competencies", "options", query],
    queryFn: async () =>
      (await ApiClient.api.competenciesControllerGetCompetencyOptions(query)).data.data,
    enabled,
  });
}
