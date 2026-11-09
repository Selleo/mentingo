import { Injectable, Logger } from "@nestjs/common";
import { Value } from "@sinclair/typebox/value";
import { match, P } from "ts-pattern";

import {
  AutomationEmailDeliveryRequestedEvent,
  NotificationEvent,
} from "src/automation-execution/events/notification-event";
import { TenantDbRunnerService } from "src/storage/db/tenant-db-runner.service";

import { OutboxEventHandlerRegistry } from "./outbox-event-handler-registry";
import { OUTBOX_HANDLER_DELIVERY_OUTCOMES, OUTBOX_MAX_ATTEMPTS } from "./outbox.constants";
import { OutboxRepository } from "./outbox.repository";
import { OUTBOX_STATUSES } from "./outbox.types";
import { toOutboxErrorMessage } from "./utils/outbox-error.utils";
import { rehydrateOutboxEvent } from "./utils/outbox-event-rehydration.utils";
import { wrapLegacyFlatPayload } from "./utils/outbox-legacy-payload.utils";

import type {
  OutboxClaim,
  OutboxEnvelope,
  OutboxEventSubscription,
  OutboxHandlerDeliveryOutcome,
  OutboxRegisteredHandler,
} from "./outbox.types";

@Injectable()
export class OutboxDispatcherService {
  private readonly logger = new Logger(OutboxDispatcherService.name);
  private runningPass: Promise<void> | null = null;
  private followUpPass: Promise<void> | null = null;

  constructor(
    private readonly tenantDbRunnerService: TenantDbRunnerService,
    private readonly outboxRepository: OutboxRepository,
    private readonly outboxEventHandlerRegistry: OutboxEventHandlerRegistry,
  ) {}

  /**
   * Delivers every due event once the call returns. A call made while a pass is running waits for
   * it and then runs one more pass, which concurrent callers share, so events committed during the
   * running pass are never left for the next wake-up.
   */
  async dispatchPendingEvents(): Promise<void> {
    if (!this.runningPass) return this.startPass();

    this.followUpPass ??= this.runningPass
      .catch(() => undefined)
      .then(() => {
        this.followUpPass = null;
        return this.startPass();
      });

    return this.followUpPass;
  }

  private startPass(): Promise<void> {
    this.runningPass = this.deliverDueEventsOfEveryTenant().finally(() => {
      this.runningPass = null;
    });

    return this.runningPass;
  }

  private async deliverDueEventsOfEveryTenant(): Promise<void> {
    await this.tenantDbRunnerService.runForEachTenant(async (tenantId) => {
      await this.outboxRepository.releaseStalledClaims(tenantId);
      let event = await this.outboxRepository.claimNextDueEvent(tenantId);

      while (event) {
        await this.deliverClaimedEvent(event, tenantId);
        event = await this.outboxRepository.claimNextDueEvent(tenantId);
      }
    });
  }

  private async deliverClaimedEvent(claimedEvent: OutboxEnvelope, tenantId: string): Promise<void> {
    if (claimedEvent.tenantId && tenantId && claimedEvent.tenantId !== tenantId) {
      const message = `Tenant mismatch while processing outbox event ${claimedEvent.id}: claimed under tenant=${tenantId}, event.tenantId=${claimedEvent.tenantId}`;
      this.logger.error(message);
      await this.recordFailedAttempt(claimedEvent, message);
      return;
    }

    const event = await this.upgradeLegacyFlatPayload(claimedEvent);
    const subscription = this.outboxEventHandlerRegistry.findEventSubscription(event.eventType);

    if (!subscription) {
      await this.outboxRepository.markPublished(event);
      return;
    }

    const { payloadSchema, clearPayloadAfterDelivery = false } =
      this.outboxEventHandlerRegistry.getEventOptions(subscription.eventClass);

    if (payloadSchema && !Value.Check(payloadSchema, event.payload)) {
      await this.markInvalidPayloadDead(event);
      return;
    }

    try {
      const outcome = await this.deliverToPendingHandlers(event, subscription);

      if (outcome === OUTBOX_HANDLER_DELIVERY_OUTCOMES.CLAIM_LOST) {
        this.logger.warn(`Outbox event ${event.id} was claimed by another dispatcher`);
        return;
      }

      await this.markDelivered(event, clearPayloadAfterDelivery);
    } catch (error) {
      await this.recordFailedAttempt(event, this.describeDeliveryFailure(event, tenantId, error));
    }
  }

  /** Stores a flat payload written by an older API instance in its current shape before using it. */
  private async upgradeLegacyFlatPayload(event: OutboxEnvelope): Promise<OutboxEnvelope> {
    const payload = wrapLegacyFlatPayload(event.eventType, event.payload);

    if (!payload) return event;

    await this.outboxRepository.replaceStoredPayload(event, payload);

    return { ...event, payload };
  }

  /**
   * Awaits every handler of the event. Fails after trying them all if any of them failed, and stops
   * at once when another dispatcher took the event over.
   */
  private async deliverToPendingHandlers(
    event: OutboxEnvelope,
    { eventClass, handlers }: OutboxEventSubscription,
  ): Promise<OutboxHandlerDeliveryOutcome> {
    const outboxEvent = rehydrateOutboxEvent(eventClass, event.payload);
    const handlerFailures: string[] = [];

    for (const handler of handlers) {
      try {
        const outcome = await this.tenantDbRunnerService.transactionWithHandle(() =>
          this.deliverToHandlerUnderClaim(event, outboxEvent, handler),
        );

        if (outcome === OUTBOX_HANDLER_DELIVERY_OUTCOMES.CLAIM_LOST) return outcome;
      } catch (error) {
        handlerFailures.push(`${handler.name}: ${error instanceof Error ? error.message : error}`);
      }
    }

    if (handlerFailures.length > 0) throw new Error(handlerFailures.join("; "));

    return OUTBOX_HANDLER_DELIVERY_OUTCOMES.DELIVERED;
  }

  /**
   * Runs one handler inside a transaction that locks the event under this dispatcher's claim and
   * records the handler's success: its database writes commit only together with that record, a
   * handler that already succeeded is skipped, and nothing runs once the claim is lost.
   */
  private async deliverToHandlerUnderClaim(
    event: OutboxEnvelope,
    outboxEvent: object,
    handler: OutboxRegisteredHandler,
  ): Promise<OutboxHandlerDeliveryOutcome> {
    const lockedEvent = await this.outboxRepository.lockClaimedEvent(event);

    if (!lockedEvent) return OUTBOX_HANDLER_DELIVERY_OUTCOMES.CLAIM_LOST;
    if (lockedEvent.succeededHandlers.includes(handler.name))
      return OUTBOX_HANDLER_DELIVERY_OUTCOMES.DELIVERED;

    await handler.handleOutboxEvent(outboxEvent, { eventId: event.id });
    await this.outboxRepository.recordSucceededHandler(event, handler.name);

    return OUTBOX_HANDLER_DELIVERY_OUTCOMES.DELIVERED;
  }

  private async markDelivered(
    claim: OutboxClaim,
    clearPayloadAfterDelivery: boolean,
  ): Promise<void> {
    await match(clearPayloadAfterDelivery)
      .with(true, () => this.outboxRepository.markPublishedWithoutPayload(claim))
      .with(false, () => this.outboxRepository.markPublished(claim))
      .exhaustive();
  }

  /** Notification intake failures are stored with a generic message instead of their error. */
  private describeDeliveryFailure(event: OutboxEnvelope, tenantId: string, error: unknown) {
    return match(event.eventType)
      .with(P.union(NotificationEvent.name, AutomationEmailDeliveryRequestedEvent.name), () => {
        const message = "Notification outbox intake failed";
        this.logger.error(`[tenant=${tenantId}] ${message}: event=${event.id}`);
        return message;
      })
      .otherwise(() => {
        this.logger.error(
          `[tenant=${tenantId}] Failed processing outbox event ${event.id} (${event.eventType}): ${error}`,
        );
        return error;
      });
  }

  /** Retrying cannot repair a malformed payload, so it goes dead without reaching any handler. */
  private async markInvalidPayloadDead(event: OutboxEnvelope): Promise<void> {
    const lastError = `Invalid ${event.eventType} payload`;

    this.logger.error(`${lastError}: event=${event.id}`);
    await this.outboxRepository.recordFailedAttempt(event, {
      status: OUTBOX_STATUSES.DEAD,
      attemptCount: event.attemptCount + 1,
      lastError,
    });
  }

  /** The attempt that reaches the limit marks the event dead, so it is never claimed again. */
  private async recordFailedAttempt(event: OutboxEnvelope, error: unknown): Promise<void> {
    const attemptCount = event.attemptCount + 1;

    await this.outboxRepository.recordFailedAttempt(event, {
      status: match(attemptCount >= OUTBOX_MAX_ATTEMPTS)
        .with(true, () => OUTBOX_STATUSES.DEAD)
        .with(false, () => OUTBOX_STATUSES.FAILED)
        .exhaustive(),
      attemptCount,
      lastError: toOutboxErrorMessage(error),
    });
  }
}
