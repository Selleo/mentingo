import { Injectable } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";

import { processInBatches } from "src/common/utils/processInBatches";
import { TenantDbRunnerService } from "src/storage/db/tenant-db-runner.service";

import { MicrosoftCalendarRepository } from "../repositories/microsoft-calendar.repository";
import { MicrosoftCalendarSyncQueueService } from "../services/microsoft-calendar-sync-queue.service";
import { MICROSOFT_CALENDAR_SYNC_REASONS } from "../types/microsoft-calendar.types";

const MICROSOFT_CALENDAR_SYNC_BATCH_SIZE = 25;

@Injectable()
export class MicrosoftCalendarCron {
  constructor(
    private readonly tenantRunner: TenantDbRunnerService,
    private readonly repository: MicrosoftCalendarRepository,
    private readonly syncQueue: MicrosoftCalendarSyncQueueService,
  ) {}

  @Cron(CronExpression.EVERY_6_HOURS)
  async reconcile() {
    await this.tenantRunner.runForEachTenant(async (tenantId) => {
      const connections = await this.repository.listConnectionsForReconciliation();
      await processInBatches(
        connections,
        (connection) =>
          this.syncQueue.enqueue({
            tenantId,
            connectionId: connection.id,
            fullSync: false,
            reason: MICROSOFT_CALENDAR_SYNC_REASONS.RECONCILIATION,
          }),
        { batchSize: MICROSOFT_CALENDAR_SYNC_BATCH_SIZE },
      );
      await processInBatches(
        connections.filter((connection) => connection.outboundSyncEnabled),
        (connection) =>
          this.syncQueue.enqueueOutbound({
            tenantId,
            connectionId: connection.id,
            reason: MICROSOFT_CALENDAR_SYNC_REASONS.RECONCILIATION,
          }),
        { batchSize: MICROSOFT_CALENDAR_SYNC_BATCH_SIZE },
      );
    });
  }

  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async renewSubscriptions() {
    const renewBefore = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();

    await this.tenantRunner.runForEachTenant(async (tenantId) => {
      const connections =
        await this.repository.listConnectionsNeedingSubscriptionRenewal(renewBefore);

      await processInBatches(
        connections,
        (connection) =>
          this.syncQueue.enqueue({
            tenantId,
            connectionId: connection.id,
            fullSync: false,
            reason: MICROSOFT_CALENDAR_SYNC_REASONS.RECONCILIATION,
          }),
        { batchSize: MICROSOFT_CALENDAR_SYNC_BATCH_SIZE },
      );
    });
  }
}
