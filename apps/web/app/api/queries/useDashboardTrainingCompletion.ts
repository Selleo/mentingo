import { useQuery } from "@tanstack/react-query";

import { ApiClient } from "../api-client";

export const dashboardTrainingCompletionQueryOptions = () => ({
  queryKey: ["statistics/dashboard/training-completion"],
  queryFn: async () => {
    const response = await ApiClient.api.statisticsControllerGetDashboardTrainingCompletion();

    return response.data.data;
  },
  staleTime: 1000 * 60,
});

export function useDashboardTrainingCompletion() {
  return useQuery(dashboardTrainingCompletionQueryOptions());
}
