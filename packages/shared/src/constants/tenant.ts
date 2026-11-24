export const TENANT_STATUSES = {
  ACTIVE: "active",
  INACTIVE: "inactive",
} as const;

export type TenantStatus = (typeof TENANT_STATUSES)[keyof typeof TENANT_STATUSES];

/** Ordered from lowest to highest; admins are alerted when a tenant moves up a level. */
export const TENANT_USER_CAPACITY_ALERT_LEVELS = {
  WITHIN_LIMIT: "within_limit",
  APPROACHING_LIMIT: "approaching_limit",
  LIMIT_REACHED: "limit_reached",
  CAPACITY_FULL: "capacity_full",
  OVER_CAPACITY: "over_capacity",
} as const;

export type TenantUserCapacityAlertLevel =
  (typeof TENANT_USER_CAPACITY_ALERT_LEVELS)[keyof typeof TENANT_USER_CAPACITY_ALERT_LEVELS];

/** Share of the plan's maximum users at which admins are warned that the limit is close. */
export const TENANT_USER_CAPACITY_APPROACHING_PERCENTAGE = 80;
