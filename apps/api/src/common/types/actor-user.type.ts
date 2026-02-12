import type { UUIDType } from "src/common";
import type { UserRole } from "src/user/schemas/userRoles";

export type ActorUserType = {
  userId: UUIDType;
  email: string;
  role: UserRole;
  tenantId: UUIDType;
  iat?: number;
  exp?: number;
};
