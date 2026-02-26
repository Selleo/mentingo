import type { UUIDType } from "src/common";
import type { UserRole } from "src/user/schemas/userRoles";

export type CurrentUser = {
  userId: UUIDType;
  email: string;
  role: UserRole;
  tenantId: UUIDType;
  isSupportMode?: boolean;
  supportSessionId?: UUIDType;
  supportExpiresAt?: string;
  originalUserId?: UUIDType;
  originalTenantId?: UUIDType;
  originalTenantName?: string;
  targetTenantName?: string;
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
