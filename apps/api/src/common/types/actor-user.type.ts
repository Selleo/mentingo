import type { PermissionKey } from "@repo/shared";
import type { UUIDType } from "src/common";

export type ActorUserType = {
  userId: UUIDType;
  email: string;
  roleSlugs: string[];
  permissions: PermissionKey[];
  tenantId: UUIDType;
  isSupportMode?: boolean;
  supportSessionId?: UUIDType;
  originalUserId?: UUIDType;
  originalTenantId?: UUIDType;
  iat?: number;
  exp?: number;
};
