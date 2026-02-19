import type { TenantStatus } from "@repo/shared";
import type { Static } from "@sinclair/typebox";
import type { InferSelectModel } from "drizzle-orm";
import type { tenants } from "src/storage/schema";
import type {
  createTenantSchema,
  listTenantsQuerySchema,
  tenantResponseSchema,
  tenantsListSchema,
  updateTenantSchema,
} from "src/super-admin/schemas/tenant.schema";

export type Tenant = InferSelectModel<typeof tenants>;

export type CreateTenantBody = Static<typeof createTenantSchema>;
export type UpdateTenantBody = Static<typeof updateTenantSchema>;
export type ListTenantsQuery = Static<typeof listTenantsQuerySchema>;
export type TenantResponse = Static<typeof tenantResponseSchema>;
export type TenantsListResponse = Static<typeof tenantsListSchema>;

export type FindAllTenantsParams = {
  page: number;
  perPage: number;
  search?: string;
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
