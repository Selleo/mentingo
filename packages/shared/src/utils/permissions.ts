import type { PermissionKey } from "../constants/permissions";

export type PermissionRequirement = {
  anyOf?: readonly PermissionKey[];
  allOf?: readonly PermissionKey[];
};

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

export const hasAllPermissions = (
  permissions: readonly PermissionKey[] | undefined,
  requiredPermissions: readonly PermissionKey[],
): boolean => {
  if (!requiredPermissions.length) return true;
  if (!permissions?.length) return false;

  return requiredPermissions.every((permission) => permissions.includes(permission));
};

export const matchesRequirement = (
  permissions: readonly PermissionKey[] | undefined,
  requirement: PermissionRequirement | undefined,
): boolean => {
  if (!requirement) return true;

  const { anyOf = [], allOf = [] } = requirement;

  return hasAnyPermission(permissions, anyOf) && hasAllPermissions(permissions, allOf);
};
