import type { FixtureApiClient } from "./api-client";
import type { DashboardWidgetSize, DashboardWidgetType } from "@repo/shared";

/**
 * Replaces the current user's dashboard widgets. Returns a task that restores the original
 * layout; register it with `cleanup.add` for shared worker accounts.
 */
export const setDashboardWidgets = async (
  apiClient: FixtureApiClient,
  widgets: { type: DashboardWidgetType; size: DashboardWidgetSize; visible?: boolean }[],
) => {
  const original = (await apiClient.api.settingsControllerGetDashboardSettings()).data.data.layout;

  await apiClient.api.settingsControllerUpdateDashboardSettings({
    expectedRevision: original.revision,
    widgets: widgets.map(({ type, size, visible = true }) => ({ type, size, visible })),
  });

  return async () => {
    const current = await apiClient.api.settingsControllerGetDashboardSettings();
    await apiClient.api.settingsControllerUpdateDashboardSettings({
      expectedRevision: current.data.data.layout.revision,
      widgets: original.widgets,
    });
  };
};
