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
import { MicrosoftCalendarSyncQueueService } from "../services/microsoft-calendar-sync-queue.service";
import { MICROSOFT_CALENDAR_SYNC_REASONS } from "../types/microsoft-calendar.types";

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
export class MicrosoftCalendarOutboundHandler
  implements OutboxEventsHandlerOf<CalendarOutboundEvent>
{
  constructor(
    private readonly calendarConnectionRepository: CalendarConnectionRepository,
    private readonly microsoftCalendarSyncQueueService: MicrosoftCalendarSyncQueueService,
  ) {}

  async handleOutboxEvent(_event: CalendarOutboundEvent) {
    const connections = await this.calendarConnectionRepository.listOutboundConnections(
      CALENDAR_PROVIDERS.MICROSOFT,
    );

    await processInBatches(
      connections,
      (connection) =>
        this.microsoftCalendarSyncQueueService.enqueueOutbound({
          tenantId: connection.tenantId,
          connectionId: connection.id,
          reason: MICROSOFT_CALENDAR_SYNC_REASONS.RECONCILIATION,
        }),
      { batchSize: OUTBOUND_QUEUE_BATCH_SIZE },
    );
  }
}
