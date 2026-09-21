import { PERMISSIONS, type PermissionKey } from "@repo/shared";

import { hasAnyPermission } from "~/common/permissions/permission.utils";

export const COURSE_STATISTICS_VIEW_PERMISSIONS: PermissionKey[] = [
  PERMISSIONS.COURSE_UPDATE,
  PERMISSIONS.COURSE_UPDATE_OWN,
  PERMISSIONS.MANAGED_GROUP_RESULTS_READ,
];

export const canViewCourseStatistics = (permissions: PermissionKey[]) =>
  hasAnyPermission(permissions, COURSE_STATISTICS_VIEW_PERMISSIONS);
