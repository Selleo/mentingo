import type { UUIDType } from "src/common";
import type { AssignedRole } from "src/permission/permission.types";

export type ActorUserType = {
  userId: UUIDType;
  email: string;
  role: string;
  roles?: AssignedRole[];
  roleName?: string;
  tenantId: UUIDType;
  isSupportMode?: boolean;
  supportSessionId?: UUIDType;
  originalUserId?: UUIDType;
  originalTenantId?: UUIDType;
  iat?: number;
  exp?: number;
};
