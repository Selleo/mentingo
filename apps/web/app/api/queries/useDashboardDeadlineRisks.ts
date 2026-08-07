import { useQuery } from "@tanstack/react-query";

import { ApiClient } from "../api-client";

import type { GetDashboardDeadlineRisksResponse } from "../generated-api";
import type { SupportedLanguages } from "@repo/shared";

export type DashboardDeadlineRiskType = "overdue" | "dueSoon";

type DashboardDeadlineRisksParams = {
  language: SupportedLanguages;
  type: DashboardDeadlineRiskType;
  page: number;
  perPage: number;
};

export const dashboardDeadlineRisksQueryOptions = (
  params: DashboardDeadlineRisksParams,
  enabled: boolean,
) => ({
  queryKey: ["statistics/dashboard/deadline-risks", params],
  queryFn: async () => {
    const response = await ApiClient.api.statisticsControllerGetDashboardDeadlineRisks(params);

    return response.data;
  },
  enabled,
  placeholderData: (previousData: GetDashboardDeadlineRisksResponse | undefined) => previousData,
  staleTime: 1000 * 60,
});

export function useDashboardDeadlineRisks(params: DashboardDeadlineRisksParams, enabled: boolean) {
  return useQuery(dashboardDeadlineRisksQueryOptions(params, enabled));
}
