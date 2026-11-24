import { Injectable } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { CALENDAR_PROVIDERS } from "@repo/shared";

import { processInBatches } from "src/common/utils/processInBatches";
import { TenantDbRunnerService } from "src/storage/db/tenant-db-runner.service";

import { SUBSCRIPTION_RENEWAL_WINDOW_MS } from "../calendar.constants";
import { CalendarConnectionRepository } from "../repositories/calendar-connection.repository";
import { GoogleCalendarSyncQueueService } from "../services/google-calendar-sync-queue.service";
import { GOOGLE_CALENDAR_SYNC_REASONS } from "../types/google-calendar.types";

const GOOGLE_CALENDAR_SYNC_BATCH_SIZE = 25;

@Injectable()
export class GoogleCalendarCron {
  constructor(
    private readonly tenantDbRunnerService: TenantDbRunnerService,
    private readonly calendarConnectionRepository: CalendarConnectionRepository,
    private readonly googleCalendarSyncQueueService: GoogleCalendarSyncQueueService,
  ) {}

  @Cron(CronExpression.EVERY_6_HOURS)
  async reconcileGoogleCalendarConnections() {
    await this.tenantDbRunnerService.runForEachTenant(async (tenantId) => {
      const connections = await this.calendarConnectionRepository.listConnectionsForReconciliation(
        CALENDAR_PROVIDERS.GOOGLE,
      );

      await processInBatches(
        connections,
        (connection) =>
          this.googleCalendarSyncQueueService.enqueueInboundSync({
            tenantId,
            connectionId: connection.id,
            fullSync: false,
            reason: GOOGLE_CALENDAR_SYNC_REASONS.RECONCILIATION,
          }),
        { batchSize: GOOGLE_CALENDAR_SYNC_BATCH_SIZE },
      );

      await processInBatches(
        connections.filter((connection) => connection.outboundSyncEnabled),
        (connection) =>
          this.googleCalendarSyncQueueService.enqueueOutboundSync({
            tenantId,
            connectionId: connection.id,
            reason: GOOGLE_CALENDAR_SYNC_REASONS.RECONCILIATION,
          }),
        { batchSize: GOOGLE_CALENDAR_SYNC_BATCH_SIZE },
      );
    });
  }

  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async renewGoogleCalendarPushChannels() {
    const renewBefore = new Date(Date.now() + SUBSCRIPTION_RENEWAL_WINDOW_MS).toISOString();

    await this.tenantDbRunnerService.runForEachTenant(async (tenantId) => {
      const connections =
        await this.calendarConnectionRepository.listConnectionsNeedingSubscriptionRenewal(
          CALENDAR_PROVIDERS.GOOGLE,
          renewBefore,
        );

      await processInBatches(
        connections,
        (connection) =>
          this.googleCalendarSyncQueueService.enqueueInboundSync({
            tenantId,
            connectionId: connection.id,
            fullSync: false,
            reason: GOOGLE_CALENDAR_SYNC_REASONS.RECONCILIATION,
          }),
        { batchSize: GOOGLE_CALENDAR_SYNC_BATCH_SIZE },
      );
    });
  }
}
