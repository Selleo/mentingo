import { useQuery } from "@tanstack/react-query";

import { ApiClient } from "../api-client";

export function useCompetencySubject(subjectId: string, profileId?: string) {
  return useQuery({
    queryKey: ["competencies", "subject", subjectId, profileId ?? null],
    queryFn: async () =>
      (
        await ApiClient.api.competenciesControllerGetCompetencySubject(
          subjectId,
          profileId ? { profileId } : {},
        )
      ).data.data,
    enabled: Boolean(subjectId),
  });
}
