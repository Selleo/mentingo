import { useQuery } from "@tanstack/react-query";

import { ApiClient } from "../api-client";

export function useCompetencySubject(subjectId: string, trackId?: string) {
  return useQuery({
    queryKey: ["competencies", "subject", subjectId, trackId ?? null],
    queryFn: async () =>
      (
        await ApiClient.api.competenciesControllerGetCompetencySubject(
          subjectId,
          trackId ? { trackId } : {},
        )
      ).data.data,
    enabled: Boolean(subjectId),
  });
}
