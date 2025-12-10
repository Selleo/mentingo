import { useQuery } from "@tanstack/react-query";

import { ApiClient } from "../api-client";

import type { GetStatsResponse } from "../generated-api";
import type { SupportedLanguages } from "@repo/shared";

export const statistics = (language: SupportedLanguages) => {
  return {
    queryKey: ["statistics/stats", { language }],
    queryFn: async () => {
      const response = await ApiClient.api.statisticsControllerGetStats({ language });

      return response.data;
    },
    select: (data: GetStatsResponse) => data.data,
  };
};

export function useStatistics(language: SupportedLanguages) {
  return useQuery(statistics(language));
}
