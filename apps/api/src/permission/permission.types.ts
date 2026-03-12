import type { PermissionKey } from "./permission.constants";
import type { UUIDType } from "src/common";
import type { UserRole } from "src/user/schemas/userRoles";

export type AssignedRole = {
  id: UUIDType;
  slug: string;
  name: string;
};

export type HydratedPermissionContext = {
  roles: AssignedRole[];
  permissions: PermissionKey[];
  role: UserRole;
};
