import type {
  SupportSessionStatus as SharedSupportSessionStatus,
  TenantStatus,
} from "@repo/shared";
import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import type { supportSessions } from "src/storage/schema";

export type SupportSession = InferSelectModel<typeof supportSessions>;

export type CreateSupportSessionResult = {
  redirectUrl: string;
  expiresAt: string;
};

export type SupportTokenClaims = {
  isSupportMode: true;
  supportSessionId: string;
  supportExpiresAt: string;
  originalUserId: string;
  originalTenantId: string;
  targetUserId: string;
  returnUrl: string;
};

export type SupportTenant = {
  id: string;
  name: string;
  host: string;
  status: TenantStatus;
};

export type SupportAdminUser = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  label: string;
  profilePictureUrl: string | null;
};

export type SupportAdminUserRecord = Omit<SupportAdminUser, "profilePictureUrl"> & {
  avatarReference: string | null;
};

export type ListSupportAdminUsersQuery = {
  page?: number;
  perPage?: number;
  search?: string;
};

export type FindSupportAdminUsersParams = {
  tenantId: string;
  page: number;
  perPage: number;
  search?: string;
};

export type CreateSupportSessionRecord = InferInsertModel<typeof supportSessions>;

export type SupportSessionStatus = SharedSupportSessionStatus;
