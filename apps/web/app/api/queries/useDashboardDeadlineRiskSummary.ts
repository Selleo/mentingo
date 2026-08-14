import { useQuery } from "@tanstack/react-query";

import { ApiClient } from "../api-client";

export const dashboardDeadlineRiskSummaryQueryOptions = () => ({
  queryKey: ["statistics/dashboard/deadline-risks/summary"],
  queryFn: async () => {
    const response = await ApiClient.api.statisticsControllerGetDashboardDeadlineRiskSummary();

    return response.data.data;
  },
  staleTime: 1000 * 60,
});

export function useDashboardDeadlineRiskSummary() {
  return useQuery(dashboardDeadlineRiskSummaryQueryOptions());
}
