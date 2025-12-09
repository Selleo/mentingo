import { useQuery, useSuspenseQuery } from "@tanstack/react-query";

import { ApiClient } from "../api-client";

import type { GetUserStatisticsResponse } from "../generated-api";
import type { SupportedLanguages } from "@repo/shared";

export const userStatistics = (language: SupportedLanguages) => {
  return {
    queryKey: ["user-statistics/user-stats", { language }],
    queryFn: async () => {
      const response = await ApiClient.api.statisticsControllerGetUserStatistics({ language });

      return response.data;
    },
    select: (data: GetUserStatisticsResponse) => data.data,
  };
};

export function useUserStatistics(language: SupportedLanguages) {
  return useQuery(userStatistics(language));
}

export function useUserStatisticsSuspense(language: SupportedLanguages) {
  return useSuspenseQuery(userStatistics(language));
}
