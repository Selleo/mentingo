import type { PermissionKey } from "@repo/shared";

export const hasPermission = (
  permissions: readonly PermissionKey[] | undefined,
  permission: PermissionKey,
): boolean => {
  if (!permissions?.length) return false;

  return permissions.includes(permission);
};

export const hasAnyPermission = (
  permissions: readonly PermissionKey[] | undefined,
  requiredPermissions: readonly PermissionKey[],
): boolean => {
  if (!requiredPermissions.length) return true;

  if (!permissions?.length) return false;

  return requiredPermissions.some((permission) => permissions.includes(permission));
};
