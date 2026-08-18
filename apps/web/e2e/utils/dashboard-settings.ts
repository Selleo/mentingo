import type { FixtureApiClient } from "./api-client";
import type { DashboardWidgetSize, DashboardWidgetType } from "@repo/shared";

export const setDashboardWidgets = async (
  apiClient: FixtureApiClient,
  widgets: { type: DashboardWidgetType; size: DashboardWidgetSize; visible?: boolean }[],
) => {
  const response = await apiClient.api.settingsControllerGetDashboardSettings();

  await apiClient.api.settingsControllerUpdateDashboardSettings({
    expectedRevision: response.data.data.layout.revision,
    widgets: widgets.map(({ type, size, visible = true }) => ({ type, size, visible })),
  });
};
