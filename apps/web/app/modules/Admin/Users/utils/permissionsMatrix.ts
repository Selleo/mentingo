import type { PermissionKey } from "@repo/shared";

export type PermissionMatrixRole = {
  slug: string;
  label: string;
  permissions: PermissionKey[];
};

export type PermissionMatrixRow = {
  permission: PermissionKey;
  grants: Record<string, boolean>;
};

type BuildPermissionMatrixParams = {
  roles: PermissionMatrixRole[];
  permissionsOrder: PermissionKey[];
};

export const buildPermissionMatrix = ({
  roles,
  permissionsOrder,
}: BuildPermissionMatrixParams): PermissionMatrixRow[] => {
  return permissionsOrder.map((permission) => ({
    permission,
    grants: roles.reduce<Record<string, boolean>>((acc, role) => {
      acc[role.slug] = role.permissions.includes(permission);
      return acc;
    }, {}),
  }));
};

type BuildPermissionsUnionParams = {
  roleSlugs: string[];
  permissionsByRoleSlug: Record<string, PermissionKey[]>;
  permissionsOrder: PermissionKey[];
};

export const buildPermissionsUnionForRoleSlugs = ({
  roleSlugs,
  permissionsByRoleSlug,
  permissionsOrder,
}: BuildPermissionsUnionParams): PermissionKey[] => {
  const grantedPermissions = new Set<PermissionKey>();

  roleSlugs.forEach((roleSlug) => {
    (permissionsByRoleSlug[roleSlug] ?? []).forEach((permission) => {
      grantedPermissions.add(permission);
    });
  });

  return permissionsOrder.filter((permission) => grantedPermissions.has(permission));
};
