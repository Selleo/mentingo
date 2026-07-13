import { useQuery } from "@tanstack/react-query";

import { ApiClient } from "~/api/api-client";

import type { GetLayoutResponse } from "~/api/generated-api";

export const DASHBOARD_LAYOUT_QUERY_KEY = "dashboard-layout";

export const dashboardLayoutQueryOptions = {
  queryKey: [DASHBOARD_LAYOUT_QUERY_KEY],
  queryFn: async () => {
    const response = await ApiClient.api.dashboardControllerGetLayout();

    return response.data;
  },
  select: (response: GetLayoutResponse) => response.data,
};

export function useDashboardLayout() {
  return useQuery(dashboardLayoutQueryOptions);
}
