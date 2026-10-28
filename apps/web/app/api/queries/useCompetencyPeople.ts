import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { ApiClient } from "../api-client";

export function useCompetencyPeople(
  query: NonNullable<Parameters<typeof ApiClient.api.competenciesControllerGetCompetencyPeople>[0]>,
  enabled = true,
) {
  return useQuery({
    queryKey: ["competencies", "people", query],
    queryFn: async () =>
      (await ApiClient.api.competenciesControllerGetCompetencyPeople(query)).data.data,
    enabled,
    placeholderData: keepPreviousData,
  });
}
