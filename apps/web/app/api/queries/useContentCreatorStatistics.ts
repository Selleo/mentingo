import { useQuery } from "@tanstack/react-query";

import { ApiClient } from "../api-client";

import type { GetContentCreatorStatsResponse } from "../generated-api";

export const contentCreatorStatistics = () => {
  return {
    queryKey: ["statistics/content-creator-stats"],
    queryFn: async () => {
      const response = await ApiClient.api.statisticsControllerGetContentCreatorStats();

      return response.data;
    },
    select: (data: GetContentCreatorStatsResponse) => data.data,
  };
};

export function useContentCreatorStatistics() {
  return useQuery(contentCreatorStatistics());
}
