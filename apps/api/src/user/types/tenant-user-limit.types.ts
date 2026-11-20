import type { TENANT_USER_CAPACITY_ALERT_LEVELS, TenantUserCapacityAlertLevel } from "@repo/shared";
import type { UUIDType } from "src/common";

export type TenantUserLimitSettings = {
  maxUsers: number | null;
  maxUsersOverflowPercentage: number;
};

export type TenantUserLimit = TenantUserLimitSettings & {
  userCapacityAlertLevel: TenantUserCapacityAlertLevel;
};

export type TenantUserCapacity = {
  activeUsersCount: number;
  maxUsers: number;
  allowedUsersCount: number;
};

export type TenantUserCapacityAlertRecipient = {
  id: UUIDType;
  email: string;
};

export type NotifiedTenantUserCapacityAlertLevel = Exclude<
  TenantUserCapacityAlertLevel,
  typeof TENANT_USER_CAPACITY_ALERT_LEVELS.WITHIN_LIMIT
>;

export type TenantUserCapacityAlertTexts = {
  title: string;
  message: string;
};
