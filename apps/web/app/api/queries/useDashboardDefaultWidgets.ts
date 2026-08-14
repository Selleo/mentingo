import { queryOptions, useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { useAuthStore } from "~/modules/Auth/authStore";

import { ApiClient } from "../api-client";

import type { GetDefaultDashboardWidgetsResponse } from "../generated-api";

export const dashboardDefaultWidgetsQueryOptions = queryOptions({
  queryKey: ["dashboard", "defaultWidgets"],
  queryFn: async () => {
    const response = await ApiClient.api.settingsControllerGetDefaultDashboardWidgets();

    return response.data;
  },
  staleTime: 1000 * 60 * 5,
});

export function useDashboardDefaultWidgets(enabled: boolean = true) {
  const isLoggedIn = useAuthStore((state) => state.isLoggedIn);

  return useQuery({
    ...dashboardDefaultWidgetsQueryOptions,
    enabled: enabled && isLoggedIn,
    select: (data: GetDefaultDashboardWidgetsResponse | null) => {
      return data?.data;
    },
  });
}

export function useDashboardDefaultWidgetsSuspense() {
  const { t } = useTranslation();

  return useSuspenseQuery({
    ...dashboardDefaultWidgetsQueryOptions,
    select: (data: GetDefaultDashboardWidgetsResponse | null) => {
      if (!data) {
        throw new Error(t("auth.error.unauthenticated"));
      }

      return data?.data;
    },
  });
}
