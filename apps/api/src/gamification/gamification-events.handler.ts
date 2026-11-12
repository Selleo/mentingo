import { Injectable } from "@nestjs/common";
import { get } from "lodash";

import {
  LessonCompletedEvent,
  QuizCompletedEvent,
  UserCourseFinishedEvent,
  UserLoginEvent,
} from "src/events";
import { OutboxEventsHandler } from "src/outbox/outbox.decorators";
import { dbAls } from "src/storage/db/db-als.store";

import { GamificationQueueService } from "./gamification-queue.service";
import { GAMIFICATION_EVENT_SOURCES } from "./gamification.constants";

import type { OutboxDeliveryContext, OutboxEventsHandlerOf } from "src/outbox/outbox.types";

type GamificationSourceEvent =
  | UserLoginEvent
  | LessonCompletedEvent
  | UserCourseFinishedEvent
  | QuizCompletedEvent;

/** Queues a re-evaluation of the learner whenever a committed outbox event can earn rewards. */
@Injectable()
@OutboxEventsHandler(
  UserLoginEvent,
  LessonCompletedEvent,
  UserCourseFinishedEvent,
  QuizCompletedEvent,
)
export class GamificationEventsHandler implements OutboxEventsHandlerOf<GamificationSourceEvent> {
  constructor(private readonly gamificationQueueService: GamificationQueueService) {}

  async handleOutboxEvent(event: GamificationSourceEvent, { eventId }: OutboxDeliveryContext) {
    const source = Object.values(GAMIFICATION_EVENT_SOURCES).find(
      ({ outboxEventType }) => outboxEventType === event.constructor.name,
    );

    const tenantId = dbAls.getStore()?.tenantId;
    const userId = source && get(event, source.userIdPath);

    if (!source || !tenantId || typeof userId !== "string") return;
    if (get(event, source.supportModePath) === true) return;

    await this.gamificationQueueService.enqueueEvaluateUser({
      tenantId,
      userId,
      sourceEventId: eventId,
    });
  }
}
