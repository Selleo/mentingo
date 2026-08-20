import { queryOptions, useQuery } from "@tanstack/react-query";

import { ApiClient } from "../api-client";

import type { DashboardWidgetSize, DashboardWidgetType } from "@repo/shared";

export type DashboardLayoutSetting = {
  type: DashboardWidgetType;
  size: DashboardWidgetSize;
  visible: boolean;
};

export type DashboardCatalogEntry = {
  type: DashboardWidgetType;
  alwaysVisible: boolean;
  allowedSizes: DashboardWidgetSize[];
  defaultSize: DashboardWidgetSize;
};

export type DashboardSettingsLayout = {
  schemaVersion: number;
  revision: number;
  widgets: DashboardLayoutSetting[];
};

export type DashboardSettingsResponse = {
  layout: DashboardSettingsLayout;
  catalog: DashboardCatalogEntry[];
};

export const getDashboardSettingsQueryKey = (userId: string) =>
  ["dashboard", "settings", userId] as const;

export const dashboardSettingsQueryOptions = (userId: string) =>
  queryOptions({
    queryKey: getDashboardSettingsQueryKey(userId),
    queryFn: async () => {
      const response = await ApiClient.api.settingsControllerGetDashboardSettings();
      return response.data.data;
    },
  });

export function useDashboardSettings(userId?: string) {
  return useQuery({
    ...dashboardSettingsQueryOptions(userId ?? ""),
    enabled: Boolean(userId),
  });
}
