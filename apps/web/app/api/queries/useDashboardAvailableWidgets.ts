import { queryOptions, useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { useAuthStore } from "~/modules/Auth/authStore";

import { ApiClient } from "../api-client";

import type { GetAvailableDashboardWidgetsResponse } from "../generated-api";

export const dashboardAvailableWidgetsQueryOptions = queryOptions({
  queryKey: ["dashboard", "availableWidgets"],
  queryFn: async () => {
    const response = await ApiClient.api.settingsControllerGetAvailableDashboardWidgets();

    return response.data;
  },
  staleTime: 1000 * 60 * 5,
});

export function useDashboardAvailableWidgets(enabled: boolean = true) {
  const isLoggedIn = useAuthStore((state) => state.isLoggedIn);

  return useQuery({
    ...dashboardAvailableWidgetsQueryOptions,
    enabled: enabled && isLoggedIn,
    select: (data: GetAvailableDashboardWidgetsResponse | null) => {
      return data?.data;
    },
  });
}

export function useDashboardAvailableWidgetsSuspense() {
  const { t } = useTranslation();

  return useSuspenseQuery({
    ...dashboardAvailableWidgetsQueryOptions,
    select: (data: GetAvailableDashboardWidgetsResponse | null) => {
      if (!data) {
        throw new Error(t("auth.error.unauthenticated"));
      }

      return data?.data;
    },
  });
}
