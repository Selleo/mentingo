import { Injectable, type OnModuleInit } from "@nestjs/common";
import { get } from "lodash";

import { OutboxDirectHandlerService } from "src/outbox/outbox-direct-handler.service";
import { isOutboxProcessingEnabled } from "src/outbox/outbox.constants";
import { dbAls } from "src/storage/db/db-als.store";

import { GamificationQueueService } from "./gamification-queue.service";
import { GAMIFICATION_EVENT_SOURCES } from "./gamification.constants";

import type { GamificationEventSource } from "./gamification.types";

/** Queues a re-evaluation of the learner whenever a committed outbox event can earn rewards. */
@Injectable()
export class GamificationEventsHandler implements OnModuleInit {
  constructor(
    private readonly outboxDirectHandlerService: OutboxDirectHandlerService,
    private readonly gamificationQueueService: GamificationQueueService,
  ) {}

  onModuleInit(): void {
    for (const source of Object.values(GAMIFICATION_EVENT_SOURCES)) {
      this.outboxDirectHandlerService.registerReaction(source.outboxEventType, (payload, eventId) =>
        this.handle(source, payload, eventId),
      );
    }
  }

  private async handle(
    source: GamificationEventSource,
    payload: Record<string, unknown>,
    eventId: string,
  ) {
    // Without the dispatcher, reactions run before (or without) the event row being stored, so measuring would miss it.
    if (!isOutboxProcessingEnabled()) return;

    const tenantId = dbAls.getStore()?.tenantId;
    const userId = get(payload, source.userIdPath);

    if (!tenantId || typeof userId !== "string") return;
    if (get(payload, source.supportModePath) === true) return;

    await this.gamificationQueueService.enqueueEvaluateUser({
      tenantId,
      userId,
      sourceEventId: eventId,
    });
  }
}
