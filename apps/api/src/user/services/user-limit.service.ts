import { ConflictException, Injectable } from "@nestjs/common";
import { calculateTenantAllowedUsersCount, TENANT_USER_CAPACITY_ALERT_LEVELS } from "@repo/shared";

import { TenantUserCapacityAlertRaisedEvent } from "src/events/tenant/tenant-user-capacity-alert-raised.event";
import { OutboxPublisher } from "src/outbox/outbox.publisher";
import { UserLimitRepository } from "src/user/repositories/user-limit.repository";
import {
  getTenantUserCapacityAlertLevel,
  isTenantUserCapacityAlertLevelHigher,
  isTenantUserLimitLowered,
} from "src/user/utils/tenant-user-capacity.utils";

import type { UUIDType, DatabasePg } from "src/common";
import type {
  TenantUserCapacity,
  TenantUserLimit,
  TenantUserLimitSettings,
} from "src/user/types/tenant-user-limit.types";

@Injectable()
export class UserLimitService {
  constructor(
    private readonly userLimitRepository: UserLimitRepository,
    private readonly outboxPublisher: OutboxPublisher,
  ) {}

  /**
   * Call inside the transaction that has just added or unarchived users, so a breach rolls it back.
   * Archived and deleted users do not count towards the limit. Alerts admins when the tenant
   * moves closer to the limit.
   */
  async enforceTenantUserLimit(tenantId: UUIDType, transaction: DatabasePg) {
    const tenantUserLimit = await this.userLimitRepository.lockTenantUserLimit(
      tenantId,
      transaction,
    );

    if (tenantUserLimit?.maxUsers == null) return;

    const tenantUserCapacity = await this.measureTenantUserCapacity(
      tenantId,
      tenantUserLimit.maxUsers,
      tenantUserLimit.maxUsersOverflowPercentage,
      transaction,
    );

    if (tenantUserCapacity.activeUsersCount > tenantUserCapacity.allowedUsersCount) {
      throw new ConflictException("user.error.userLimitReached");
    }

    await this.syncUserCapacityAlertLevel(
      tenantId,
      tenantUserLimit,
      tenantUserCapacity,
      transaction,
    );
  }

  /**
   * Re-evaluates the alert level after users were archived or deleted, so a level the tenant
   * dropped below alerts again the next time it is reached.
   */
  async syncTenantUserCapacityAlert(tenantId: UUIDType, transaction: DatabasePg) {
    await this.evaluateTenantUserCapacityAlert(tenantId, transaction, () => false);
  }

  /**
   * Re-evaluates the alert level after a super admin changed the tenant's limit. A lowered limit
   * repeats the current alert, because its numbers changed even when the level did not.
   */
  async refreshTenantUserCapacityAlert(
    tenantId: UUIDType,
    previousUserLimit: TenantUserLimitSettings,
    transaction: DatabasePg,
  ) {
    await this.evaluateTenantUserCapacityAlert(tenantId, transaction, (currentUserLimit) =>
      isTenantUserLimitLowered(previousUserLimit, currentUserLimit),
    );
  }

  private async evaluateTenantUserCapacityAlert(
    tenantId: UUIDType,
    transaction: DatabasePg,
    shouldRepeatCurrentAlert: (currentUserLimit: TenantUserLimit) => boolean,
  ) {
    const tenantUserLimit = await this.userLimitRepository.lockTenantUserLimit(
      tenantId,
      transaction,
    );

    if (!tenantUserLimit) return;

    if (tenantUserLimit.maxUsers === null) {
      await this.userLimitRepository.updateUserCapacityAlertLevel(
        tenantId,
        TENANT_USER_CAPACITY_ALERT_LEVELS.WITHIN_LIMIT,
        transaction,
      );
      return;
    }

    const tenantUserCapacity = await this.measureTenantUserCapacity(
      tenantId,
      tenantUserLimit.maxUsers,
      tenantUserLimit.maxUsersOverflowPercentage,
      transaction,
    );

    await this.syncUserCapacityAlertLevel(
      tenantId,
      tenantUserLimit,
      tenantUserCapacity,
      transaction,
      { repeatCurrentAlert: shouldRepeatCurrentAlert(tenantUserLimit) },
    );
  }

  private async measureTenantUserCapacity(
    tenantId: UUIDType,
    maxUsers: number,
    maxUsersOverflowPercentage: number,
    transaction: DatabasePg,
  ): Promise<TenantUserCapacity> {
    const activeUsersCount = await this.userLimitRepository.countActiveUsers(tenantId, transaction);

    return {
      activeUsersCount,
      maxUsers,
      allowedUsersCount: calculateTenantAllowedUsersCount(maxUsers, maxUsersOverflowPercentage),
    };
  }

  /**
   * Stores the current level so each level alerts once; a drop re-arms the lower levels.
   */
  private async syncUserCapacityAlertLevel(
    tenantId: UUIDType,
    { userCapacityAlertLevel: previousAlertLevel }: TenantUserLimit,
    tenantUserCapacity: TenantUserCapacity,
    transaction: DatabasePg,
    { repeatCurrentAlert }: { repeatCurrentAlert: boolean } = { repeatCurrentAlert: false },
  ) {
    const alertLevel = getTenantUserCapacityAlertLevel(tenantUserCapacity);

    if (alertLevel !== previousAlertLevel) {
      await this.userLimitRepository.updateUserCapacityAlertLevel(
        tenantId,
        alertLevel,
        transaction,
      );
    }

    const isAlertRaised = isTenantUserCapacityAlertLevelHigher(alertLevel, previousAlertLevel);
    const isCurrentAlertRepeated =
      repeatCurrentAlert && alertLevel !== TENANT_USER_CAPACITY_ALERT_LEVELS.WITHIN_LIMIT;

    if (!isAlertRaised && !isCurrentAlertRepeated) return;

    await this.outboxPublisher.publish(
      new TenantUserCapacityAlertRaisedEvent({ tenantId, alertLevel, ...tenantUserCapacity }),
      transaction,
    );
  }
}
