import type { PermissionKey, SystemRoleSlug } from "./permission.constants";
import type { UUIDType } from "src/common";

export type AssignedRole = {
  id: UUIDType;
  slug: string;
  name: string;
};

export type HydratedPermissionContext = {
  roles: AssignedRole[];
  permissions: PermissionKey[];
  role: SystemRoleSlug;
};
