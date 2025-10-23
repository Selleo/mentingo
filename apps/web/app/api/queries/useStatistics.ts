import { useQuery } from "@tanstack/react-query";

import { ApiClient } from "../api-client";

import type { GetContentCreatorStatsResponse, GetAdminStatsResponse } from "../generated-api";

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

export const AdminStatistics = () => {
  return {
    queryKey: ["statistics/admin-stats"],
    queryFn: async () => {
      const response = await ApiClient.api.statisticsControllerGetAdminStats();

      return response.data;
    },
    select: (data: GetAdminStatsResponse) => data.data,
  };
};

export function useStatistics(type: string) {
  return useQuery(type === "content_creator" ? contentCreatorStatistics() : AdminStatistics());
}
