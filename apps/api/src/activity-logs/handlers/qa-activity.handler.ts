import { Injectable } from "@nestjs/common";
import { EventsHandler, type IEventHandler } from "@nestjs/cqrs";

import { ActivityLogsService } from "src/activity-logs/activity-logs.service";
import { ACTIVITY_LOG_ACTION_TYPES, ACTIVITY_LOG_RESOURCE_TYPES } from "src/activity-logs/types";
import { buildActivityLogMetadata } from "src/activity-logs/utils/build-activity-log-metadata";
import { CreateQAEvent } from "src/events/qa/create-qa.event";
import { DeleteQAEvent } from "src/events/qa/delete-qa.event";
import { UpdateQAEvent } from "src/events/qa/update-qa.event";

type QAEventType = CreateQAEvent | UpdateQAEvent | DeleteQAEvent;

const QAActivityEvents = [CreateQAEvent, UpdateQAEvent, DeleteQAEvent] as const;

@Injectable()
@EventsHandler(...QAActivityEvents)
export class QAActivityHandler implements IEventHandler<QAEventType> {
  constructor(private readonly activityLogsService: ActivityLogsService) {}

  async handle(event: QAEventType) {
    if (event instanceof CreateQAEvent) {
      await this.handleCreateEvent(event);
    }

    if (event instanceof UpdateQAEvent) {
      await this.handleUpdateEvent(event);
    }

    if (event instanceof DeleteQAEvent) {
      await this.handleDeleteEvent(event);
    }
  }

  async handleCreateEvent(event: CreateQAEvent) {
    const { createQAData } = event;

    const metadata = buildActivityLogMetadata({
      previous: {},
      updated: createQAData.createdQA,
      schema: "create",
    });

    await this.activityLogsService.recordActivity({
      actor: createQAData.actor,
      operation: ACTIVITY_LOG_ACTION_TYPES.CREATE,
      resourceType: ACTIVITY_LOG_RESOURCE_TYPES.QA,
      resourceId: createQAData.qaId,
      ...metadata,
    });
  }

  async handleUpdateEvent(event: UpdateQAEvent) {
    const { updateQAData } = event;

    const metadata = buildActivityLogMetadata({
      previous: updateQAData.previousQAData,
      updated: updateQAData.updatedQAData,
      schema: "update",
    });

    await this.activityLogsService.recordActivity({
      actor: updateQAData.actor,
      operation: ACTIVITY_LOG_ACTION_TYPES.UPDATE,
      resourceType: ACTIVITY_LOG_RESOURCE_TYPES.QA,
      resourceId: updateQAData.qaId,
      ...metadata,
    });
  }

  async handleDeleteEvent(event: DeleteQAEvent) {
    const { deleteQAData } = event;

    await this.activityLogsService.recordActivity({
      actor: deleteQAData.actor,
      operation: ACTIVITY_LOG_ACTION_TYPES.DELETE,
      resourceType: ACTIVITY_LOG_RESOURCE_TYPES.QA,
      resourceId: deleteQAData.qaId,
      context: { qaTitle: deleteQAData.qaName },
    });
  }
}
