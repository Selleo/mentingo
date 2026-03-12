import type { UUIDType } from "src/common";
import type { PermissionKey } from "src/permission/permission.constants";
import type { AssignedRole } from "src/permission/permission.types";

export type CurrentUser = {
  userId: UUIDType;
  email: string;
  role: string;
  roles?: AssignedRole[];
  permissions?: PermissionKey[];
  tenantId: UUIDType;
  isSupportMode?: boolean;
  supportSessionId?: UUIDType;
  supportExpiresAt?: string;
  originalUserId?: UUIDType;
  originalTenantId?: UUIDType;
  returnUrl?: string;
  iat?: number;
  exp?: number;
};

export type SupportModeCurrentUser = CurrentUser & {
  isSupportMode: true;
  supportSessionId: UUIDType;
  originalUserId: UUIDType;
  originalTenantId: UUIDType;
};
