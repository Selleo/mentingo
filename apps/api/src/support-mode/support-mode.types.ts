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
  returnUrl: string;
};

export type SupportTenant = {
  id: string;
  name: string;
  host: string;
  status: TenantStatus;
};

export type CreateSupportSessionRecord = InferInsertModel<typeof supportSessions>;

export type SupportSessionStatus = SharedSupportSessionStatus;
