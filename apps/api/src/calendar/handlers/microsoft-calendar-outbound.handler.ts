import { EventsHandler, type IEventHandler } from "@nestjs/cqrs";

import { processInBatches } from "src/common/utils/processInBatches";
import {
  CreateLiveTrainingEvent,
  DeleteLiveTrainingEvent,
  GroupCourseDueDatesRemovedEvent,
  GroupCourseDueDatesSyncedEvent,
  UpdateLiveTrainingEvent,
} from "src/events";

import { MicrosoftCalendarRepository } from "../repositories/microsoft-calendar.repository";
import { MicrosoftCalendarSyncQueueService } from "../services/microsoft-calendar-sync-queue.service";
import { MICROSOFT_CALENDAR_SYNC_REASONS } from "../types/microsoft-calendar.types";

type CalendarOutboundEvent =
  | CreateLiveTrainingEvent
  | UpdateLiveTrainingEvent
  | DeleteLiveTrainingEvent
  | GroupCourseDueDatesRemovedEvent
  | GroupCourseDueDatesSyncedEvent;

const OUTBOUND_QUEUE_BATCH_SIZE = 25;

@EventsHandler(
  CreateLiveTrainingEvent,
  UpdateLiveTrainingEvent,
  DeleteLiveTrainingEvent,
  GroupCourseDueDatesRemovedEvent,
  GroupCourseDueDatesSyncedEvent,
)
export class MicrosoftCalendarOutboundHandler implements IEventHandler<CalendarOutboundEvent> {
  constructor(
    private readonly microsoftCalendarRepository: MicrosoftCalendarRepository,
    private readonly microsoftCalendarSyncQueueService: MicrosoftCalendarSyncQueueService,
  ) {}

  async handle(_event: CalendarOutboundEvent) {
    const connections = await this.microsoftCalendarRepository.listOutboundConnections();

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
