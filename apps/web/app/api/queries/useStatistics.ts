import { useQuery } from "@tanstack/react-query";

import { ApiClient } from "../api-client";

import type { GetStatsResponse } from "../generated-api";

export const statistics = () => {
  return {
    queryKey: ["statistics/stats"],
    queryFn: async () => {
      const response = await ApiClient.api.statisticsControllerGetStats();

      return response.data;
    },
    select: (data: GetStatsResponse) => data.data,
  };
};

export function useStatistics() {
  return useQuery(statistics());
}
