export const TENANT_STATUSES = {
  ACTIVE: "active",
  INACTIVE: "inactive",
} as const;

export type TenantStatus = (typeof TENANT_STATUSES)[keyof typeof TENANT_STATUSES];
