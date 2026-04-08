import type { PermissionKey } from "@repo/shared";
import type { UUIDType } from "src/common";

export type CurrentUserType = {
  userId: UUIDType;
  email: string;
  roleSlugs: string[];
  permissions: PermissionKey[];
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

export type SupportModeCurrentUser = CurrentUserType & {
  isSupportMode: true;
  supportSessionId: UUIDType;
  originalUserId: UUIDType;
  originalTenantId: UUIDType;
};
