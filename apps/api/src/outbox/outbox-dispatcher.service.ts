import { Injectable, Logger } from "@nestjs/common";
import { EventBus } from "@nestjs/cqrs";

import { TenantDbRunnerService } from "src/storage/db/tenant-db-runner.service";

import { OutboxDirectHandlerService } from "./outbox-direct-handler.service";
import { materializeLegacyEvent } from "./outbox.event-registry";
import { OutboxRepository } from "./outbox.repository";

import type { OutboxEnvelope } from "./outbox.types";

@Injectable()
export class OutboxDispatcherService {
  private readonly logger = new Logger(OutboxDispatcherService.name);
  private isRunning = false;

  constructor(
    private readonly tenantDbRunnerService: TenantDbRunnerService,
    private readonly outboxRepository: OutboxRepository,
    private readonly eventBus: EventBus,
    private readonly outboxDirectHandlerService: OutboxDirectHandlerService,
  ) {}

  async dispatchPendingEvents(): Promise<void> {
    if (this.isRunning) return;

    this.isRunning = true;

    try {
      await this.tenantDbRunnerService.runForEachTenant(async (tenantId) => {
        await this.outboxRepository.recoverNotificationIntake();
        let event = await this.outboxRepository.claimNext();

        while (event) {
          await this.processSingleEvent(event, tenantId);
          event = await this.outboxRepository.claimNext();
        }
      });
    } finally {
      this.isRunning = false;
    }
  }

  private async processSingleEvent(event: OutboxEnvelope, tenantId: string): Promise<void> {
    if (event.tenantId && tenantId && event.tenantId !== tenantId) {
      const message = `Tenant mismatch while processing outbox event ${event.id}: claimed under tenant=${tenantId}, event.tenantId=${event.tenantId}`;
      this.logger.error(message);
      await this.outboxRepository.markFailed(event.id, message, event.attemptCount + 1);
      return;
    }

    try {
      const handled = await this.outboxDirectHandlerService.dispatch(
        event.eventType,
        event.payload,
        event.id,
      );
      if (handled) {
        await this.outboxRepository.markPublished(event.id, true);
        return;
      }
      const materializedEvent = materializeLegacyEvent(
        event.eventType,
        event.payload as Record<string, unknown>,
      );

      await this.eventBus.publish(materializedEvent);
      await this.outboxRepository.markPublished(event.id);
    } catch (error) {
      if (
        event.eventType === "NotificationEvent" ||
        event.eventType === "AutomationEmailDeliveryRequestedEvent"
      ) {
        const message = "Notification outbox intake failed";
        this.logger.error(`[tenant=${tenantId}] ${message}: event=${event.id}`);
        await this.outboxRepository.markFailed(event.id, message, event.attemptCount + 1);
        return;
      }
      this.logger.error(
        `[tenant=${tenantId}] Failed processing outbox event ${event.id} (${event.eventType}): ${error}`,
      );

      await this.outboxRepository.markFailed(event.id, error, event.attemptCount + 1);
    }
  }
}
