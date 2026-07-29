import {
  PERMISSIONS,
  hasAllPermissions,
  hasAnyPermission,
  hasPermission,
  matchesRequirement,
} from "@repo/shared";

import type { PermissionKey } from "@repo/shared";

export { hasAllPermissions, hasAnyPermission, hasPermission, matchesRequirement };
export type { PermissionKey, PermissionRequirement } from "@repo/shared";

export const canManageCourseByAuthor = ({
  permissions,
  courseAuthorId,
  currentUserId,
}: {
  permissions: PermissionKey[];
  courseAuthorId?: string;
  currentUserId?: string;
}): boolean =>
  hasPermission(permissions, PERMISSIONS.COURSE_UPDATE) ||
  (hasPermission(permissions, PERMISSIONS.COURSE_UPDATE_OWN) &&
    Boolean(courseAuthorId && currentUserId === courseAuthorId));
