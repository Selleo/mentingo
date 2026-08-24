import { PERMISSIONS } from "@repo/shared";

import { hasPermission } from "~/common/permissions/permission.utils";

import type { CurrentUserResponse, GetPublicGlobalSettingsResponse } from "~/api/generated-api";

type CurrentUser = CurrentUserResponse["data"];
type GlobalSettings = GetPublicGlobalSettingsResponse["data"] | null | undefined;

type DefaultRedirectOptions = {
  exclude?: string[];
};

const DEFAULT_AUTHENTICATED_ROUTE = "/settings";

const isAvailableRoute = (route: string, excludedRoutes: Set<string>) => !excludedRoutes.has(route);

export const getDefaultAuthenticatedRedirect = (
  currentUser: CurrentUser,
  globalSettings?: GlobalSettings,
  options: DefaultRedirectOptions = {},
) => {
  const excludedRoutes = new Set(options.exclude ?? []);
  const permissions = currentUser.permissions;

  if (
    isAvailableRoute("/courses", excludedRoutes) &&
    hasPermission(permissions, PERMISSIONS.MANAGED_GROUP_RESULTS_READ)
  ) {
    return "/courses";
  }

  if (
    isAvailableRoute("/dashboard", excludedRoutes) &&
    hasPermission(permissions, PERMISSIONS.DASHBOARD_READ)
  ) {
    return "/dashboard";
  }

  if (
    isAvailableRoute("/courses", excludedRoutes) &&
    hasPermission(permissions, PERMISSIONS.COURSE_READ)
  ) {
    return "/courses";
  }

  if (
    isAvailableRoute("/calendar", excludedRoutes) &&
    hasPermission(permissions, PERMISSIONS.CALENDAR_READ)
  ) {
    return "/calendar";
  }

  if (
    isAvailableRoute("/development-paths", excludedRoutes) &&
    globalSettings?.learningPathsEnabled !== false &&
    (hasPermission(permissions, PERMISSIONS.LEARNING_PATH_READ) ||
      hasPermission(permissions, PERMISSIONS.MANAGED_GROUP_RESULTS_READ))
  ) {
    return "/development-paths";
  }

  return DEFAULT_AUTHENTICATED_ROUTE;
};
