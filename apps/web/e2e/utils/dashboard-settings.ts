import { DASHBOARD_DEFAULT_LAYOUTS } from "@repo/shared";

import type { FixtureApiClient } from "./api-client";
import type {
  DashboardLayoutWidget,
  DashboardWidgetSize,
  DashboardWidgetType,
  SystemRoleSlug,
} from "@repo/shared";

export const getDashboardLayout = async (apiClient: FixtureApiClient) =>
  (await apiClient.api.settingsControllerGetDashboardSettings()).data.data.layout;

/**
 * The layout "Restore default" should give the current user: the role's shared default, limited to
 * the widgets the API offers them (features, AI configuration and permissions).
 */
export const getRoleDefaultDashboardWidgets = async (
  apiClient: FixtureApiClient,
  role: SystemRoleSlug,
): Promise<DashboardLayoutWidget[]> => {
  const { catalog } = (await apiClient.api.settingsControllerGetDashboardSettings()).data.data;
  const available = new Set(catalog.map(({ type }) => type));

  return DASHBOARD_DEFAULT_LAYOUTS[role]
    .filter(({ type }) => available.has(type))
    .map(({ type, size }) => ({ type, size, visible: true }));
};

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
