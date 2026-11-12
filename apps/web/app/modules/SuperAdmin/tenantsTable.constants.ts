export const TENANTS_TABLE_FILTER_PARAMS = {
  SEARCH: "search",
  STATUS: "status",
} as const;

/** An absent status filter means active organizations only. */
export const TENANT_STATUS_FILTERS = {
  ACTIVE: "active",
  INACTIVE: "inactive",
  ALL: "all",
} as const;

export type TenantStatusFilter = (typeof TENANT_STATUS_FILTERS)[keyof typeof TENANT_STATUS_FILTERS];

export const TENANTS_TABLE_SORT_FIELDS = {
  lastActivity: "lastActivity",
  activityCountLast14Days: "activityCountLast14Days",
} as const;

export const TENANTS_TABLE_DEFAULT_PAGE_SIZE = 10;

export const TENANTS_PATH = "/super-admin/tenants";
