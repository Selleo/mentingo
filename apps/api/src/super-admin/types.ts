import type { TenantStatus } from "@repo/shared";
import type { Static } from "@sinclair/typebox";
import type { InferSelectModel } from "drizzle-orm";
import type { tenants } from "src/storage/schema";
import type {
  createSupportSessionResponseSchema,
  createSupportSessionSchema,
  createTenantSchema,
  listTenantsQuerySchema,
  supportAdminUsersSchema,
  tenantsListItemSchema,
  tenantResponseSchema,
  tenantsListSchema,
  updateTenantSchema,
} from "src/super-admin/schemas/tenant.schema";
import type { ListSupportAdminUsersQuery } from "src/support-mode/support-mode.types";

export type Tenant = InferSelectModel<typeof tenants>;

export type CreateTenantBody = Static<typeof createTenantSchema>;
export type UpdateTenantBody = Static<typeof updateTenantSchema>;
export type CreateSupportSessionBody = Static<typeof createSupportSessionSchema>;
export type CreateSupportSessionResponse = Static<typeof createSupportSessionResponseSchema>;
export type ListTenantsQuery = Static<typeof listTenantsQuerySchema>;
export type { ListSupportAdminUsersQuery };
export type TenantResponse = Static<typeof tenantResponseSchema>;
export type TenantsListItemResponse = Static<typeof tenantsListItemSchema>;
export type TenantsListResponse = Static<typeof tenantsListSchema>;
export type SupportAdminUsersResponse = Static<typeof supportAdminUsersSchema>;

export type FindAllTenantsParams = {
  page: number;
  perPage: number;
  search?: string;
  currentTenantId: string;
};

export type CountAllTenantsParams = {
  search?: string;
};

export type CreateTenantRecord = {
  name: string;
  host: string;
  status: TenantStatus;
};

export type UpdateTenantRecord = {
  name?: string;
  host?: string;
  status?: TenantStatus;
};
