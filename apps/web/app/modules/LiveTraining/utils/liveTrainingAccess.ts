import { PERMISSIONS } from "@repo/shared";

import { hasAnyPermission } from "~/common/permissions/permission.utils";

import type { PermissionKey } from "@repo/shared";

export const canReadLiveTrainingPage = (
  permissions: PermissionKey[],
  liveTrainingEnabled: boolean,
) =>
  liveTrainingEnabled &&
  hasAnyPermission(permissions, [
    PERMISSIONS.LIVE_TRAINING_READ,
    PERMISSIONS.MANAGED_GROUP_RESULTS_READ,
  ]);
