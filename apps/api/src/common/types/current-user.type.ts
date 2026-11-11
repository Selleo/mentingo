import type { AuthTokenPurpose, PermissionKey } from "@repo/shared";
import type { UUIDType } from "src/common";

export type CurrentUserType = {
  tokenVersion?: number;
  sessionId?: string;
  sessionVersion?: string;
  tokenPurpose?: AuthTokenPurpose;
  mfaVerified?: boolean;
  jti?: string;
  rememberMe?: boolean;
  userId: UUIDType;
  email: string;
  roleSlugs: string[];
  permissions: PermissionKey[];
  tenantId: UUIDType;
  isSupportMode?: boolean;
  supportSessionId?: UUIDType;
  supportExpiresAt?: string;
  originalUserId?: UUIDType;
  originalUserEmail?: string;
  originalTenantId?: UUIDType;
  targetUserId?: UUIDType;
  returnUrl?: string;
  iat?: number;
  exp?: number;
};

export type SupportModeCurrentUser = CurrentUserType & {
  isSupportMode: true;
  supportSessionId: UUIDType;
  originalUserId: UUIDType;
  originalUserEmail?: string;
  originalTenantId: UUIDType;
  targetUserId: UUIDType;
};
