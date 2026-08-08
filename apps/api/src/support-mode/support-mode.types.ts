import type {
  SupportUserScope,
  SupportSessionStatus as SharedSupportSessionStatus,
  TenantStatus,
} from "@repo/shared";
import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import type { supportSessions } from "src/storage/schema";

export type { SupportUserScope };

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

export type SupportUserRole = {
  id: string;
  slug: string;
  name: string;
  isSystem: boolean;
};

export type SupportUser = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  label: string;
  profilePictureUrl: string | null;
  roles: SupportUserRole[];
};

export type SupportUserRecord = Omit<SupportUser, "profilePictureUrl"> & {
  avatarReference: string | null;
};

export type ListSupportUsersQuery = {
  page?: number;
  perPage?: number;
  search?: string;
  scope?: SupportUserScope;
  roleSlug?: string;
};

export type FindSupportUsersParams = {
  tenantId: string;
  page: number;
  perPage: number;
  search?: string;
  scope: SupportUserScope;
  roleSlug?: string;
};

export type CreateSupportSessionRecord = InferInsertModel<typeof supportSessions>;

export type SupportSessionStatus = SharedSupportSessionStatus;
