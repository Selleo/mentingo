import { PERMISSIONS, type PermissionKey } from "@repo/shared";

import { hasPermission } from "~/common/permissions/permission.utils";

export const getLearningPathViewerAccess = (permissions: PermissionKey[]) => {
  const isGroupManager = hasPermission(permissions, PERMISSIONS.MANAGED_GROUP_RESULTS_READ);

  return {
    canSelfEnroll: !isGroupManager,
    showCourseProgress: !isGroupManager,
  };
};
