import { CALENDAR_PROVIDERS } from "@repo/shared";

import { processInBatches } from "src/common/utils/processInBatches";
import {
  CreateLiveTrainingEvent,
  DeleteLiveTrainingEvent,
  GroupCourseDueDatesRemovedEvent,
  GroupCourseDueDatesSyncedEvent,
  UpdateLiveTrainingEvent,
} from "src/events";
import { OutboxEventsHandler } from "src/outbox/outbox.decorators";

import { CalendarConnectionRepository } from "../repositories/calendar-connection.repository";
import { GoogleCalendarSyncQueueService } from "../services/google-calendar-sync-queue.service";
import { GOOGLE_CALENDAR_SYNC_REASONS } from "../types/google-calendar.types";

import type { OutboxEventsHandlerOf } from "src/outbox/outbox.types";

type CalendarOutboundEvent =
  | CreateLiveTrainingEvent
  | UpdateLiveTrainingEvent
  | DeleteLiveTrainingEvent
  | GroupCourseDueDatesRemovedEvent
  | GroupCourseDueDatesSyncedEvent;

const OUTBOUND_QUEUE_BATCH_SIZE = 25;

@OutboxEventsHandler(
  CreateLiveTrainingEvent,
  UpdateLiveTrainingEvent,
  DeleteLiveTrainingEvent,
  GroupCourseDueDatesRemovedEvent,
  GroupCourseDueDatesSyncedEvent,
)
export class GoogleCalendarOutboundHandler implements OutboxEventsHandlerOf<CalendarOutboundEvent> {
  constructor(
    private readonly calendarConnectionRepository: CalendarConnectionRepository,
    private readonly googleCalendarSyncQueueService: GoogleCalendarSyncQueueService,
  ) {}

  async handleOutboxEvent(_event: CalendarOutboundEvent) {
    const connections = await this.calendarConnectionRepository.listOutboundConnections(
      CALENDAR_PROVIDERS.GOOGLE,
    );

    await processInBatches(
      connections,
      (connection) =>
        this.googleCalendarSyncQueueService.enqueueOutboundSync({
          tenantId: connection.tenantId,
          connectionId: connection.id,
          reason: GOOGLE_CALENDAR_SYNC_REASONS.RECONCILIATION,
        }),
      { batchSize: OUTBOUND_QUEUE_BATCH_SIZE },
    );
  }
}
