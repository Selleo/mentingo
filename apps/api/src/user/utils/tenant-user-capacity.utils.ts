import {
  calculateTenantAllowedUsersCount,
  TENANT_USER_CAPACITY_ALERT_LEVELS,
  TENANT_USER_CAPACITY_APPROACHING_PERCENTAGE,
  type TenantUserCapacityAlertLevel,
} from "@repo/shared";
import { match } from "ts-pattern";

import type {
  TenantUserCapacity,
  TenantUserLimitSettings,
} from "src/user/types/tenant-user-limit.types";

const TENANT_USER_CAPACITY_ALERT_LEVEL_ORDER: readonly TenantUserCapacityAlertLevel[] = [
  TENANT_USER_CAPACITY_ALERT_LEVELS.WITHIN_LIMIT,
  TENANT_USER_CAPACITY_ALERT_LEVELS.APPROACHING_LIMIT,
  TENANT_USER_CAPACITY_ALERT_LEVELS.LIMIT_REACHED,
  TENANT_USER_CAPACITY_ALERT_LEVELS.CAPACITY_FULL,
  TENANT_USER_CAPACITY_ALERT_LEVELS.OVER_CAPACITY,
];

export const getTenantUserCapacityAlertLevel = ({
  activeUsersCount,
  maxUsers,
  allowedUsersCount,
}: TenantUserCapacity): TenantUserCapacityAlertLevel =>
  match(activeUsersCount)
    .when(
      (usersCount) => usersCount > allowedUsersCount,
      () => TENANT_USER_CAPACITY_ALERT_LEVELS.OVER_CAPACITY,
    )
    .when(
      (usersCount) => usersCount >= allowedUsersCount,
      () => TENANT_USER_CAPACITY_ALERT_LEVELS.CAPACITY_FULL,
    )
    .when(
      (usersCount) => usersCount >= maxUsers,
      () => TENANT_USER_CAPACITY_ALERT_LEVELS.LIMIT_REACHED,
    )
    .when(
      (usersCount) => usersCount * 100 >= maxUsers * TENANT_USER_CAPACITY_APPROACHING_PERCENTAGE,
      () => TENANT_USER_CAPACITY_ALERT_LEVELS.APPROACHING_LIMIT,
    )
    .otherwise(() => TENANT_USER_CAPACITY_ALERT_LEVELS.WITHIN_LIMIT);

export const isTenantUserCapacityAlertLevelHigher = (
  level: TenantUserCapacityAlertLevel,
  comparedLevel: TenantUserCapacityAlertLevel,
) =>
  TENANT_USER_CAPACITY_ALERT_LEVEL_ORDER.indexOf(level) >
  TENANT_USER_CAPACITY_ALERT_LEVEL_ORDER.indexOf(comparedLevel);

const calculateAllowedUsersCountOrUnlimited = ({
  maxUsers,
  maxUsersOverflowPercentage,
}: TenantUserLimitSettings) =>
  maxUsers === null
    ? Number.POSITIVE_INFINITY
    : calculateTenantAllowedUsersCount(maxUsers, maxUsersOverflowPercentage);

export const isTenantUserLimitLowered = (
  previousUserLimit: TenantUserLimitSettings,
  currentUserLimit: TenantUserLimitSettings,
) =>
  calculateAllowedUsersCountOrUnlimited(currentUserLimit) <
  calculateAllowedUsersCountOrUnlimited(previousUserLimit);
