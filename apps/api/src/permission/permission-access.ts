import { PERMISSIONS, type PermissionKey } from "./permission.constants";

export const hasPermission = (
  permissions: PermissionKey[] | undefined,
  permission: PermissionKey,
): boolean => Boolean(permissions?.includes(permission));

export const hasAnyPermission = (
  permissions: PermissionKey[] | undefined,
  required: PermissionKey[],
): boolean => required.some((permission) => hasPermission(permissions, permission));

export const isTenantManager = (permissions: PermissionKey[] | undefined): boolean =>
  hasPermission(permissions, PERMISSIONS.TENANT_MANAGE);

export const canManageCourseContent = (permissions: PermissionKey[] | undefined): boolean =>
  hasAnyPermission(permissions, [
    PERMISSIONS.TENANT_MANAGE,
    PERMISSIONS.COURSE_UPDATE,
    PERMISSIONS.COURSE_CREATE,
  ]);

export const canTrackLearningProgress = (permissions: PermissionKey[] | undefined): boolean =>
  hasAnyPermission(permissions, [
    PERMISSIONS.LEARNING_PROGRESS_UPDATE,
    PERMISSIONS.COURSE_ENROLLMENT,
  ]);
