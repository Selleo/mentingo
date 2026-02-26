import type { UUIDType } from "src/common";
import type { UserRole } from "src/user/schemas/userRoles";

export type ActorUserType = {
  userId: UUIDType;
  email: string;
  role: UserRole;
  tenantId: UUIDType;
  isSupportMode?: boolean;
  supportSessionId?: UUIDType;
  originalUserId?: UUIDType;
  originalTenantId?: UUIDType;
  iat?: number;
  exp?: number;
};
