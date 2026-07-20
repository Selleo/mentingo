import { Injectable } from "@nestjs/common";
import { EventsHandler, type IEventHandler } from "@nestjs/cqrs";

import {
  CreateScormEvent,
  UpdateScormEvent,
  DeleteScormEvent,
  PlayScormEvent,
  CompleteScormEvent,
} from "src/events";

import { ActivityLogsService } from "../activity-logs.service";
import { ACTIVITY_LOG_ACTION_TYPES, ACTIVITY_LOG_RESOURCE_TYPES } from "../types";
import { buildActivityLogMetadata } from "../utils/build-activity-log-metadata";

type ScormEventType =
  | CreateScormEvent
  | UpdateScormEvent
  | DeleteScormEvent
  | PlayScormEvent
  | CompleteScormEvent;

const ScormActivityEvents = [
  CreateScormEvent,
  UpdateScormEvent,
  DeleteScormEvent,
  PlayScormEvent,
  CompleteScormEvent,
] as const;

@Injectable()
@EventsHandler(...ScormActivityEvents)
export class ScormActivityHandler implements IEventHandler<ScormEventType> {
  constructor(private readonly activityLogsService: ActivityLogsService) {}

  async handle(event: ScormEventType) {
    if (event instanceof CreateScormEvent) return await this.handleCreateScorm(event);

    if (event instanceof UpdateScormEvent) return await this.handleUpdateScorm(event);

    if (event instanceof DeleteScormEvent) return await this.handleDeleteScorm(event);

    if (event instanceof PlayScormEvent) return await this.handlePlayScorm(event);

    if (event instanceof CompleteScormEvent) return await this.handleCompleteScorm(event);
  }

  private async handleCreateScorm(event: CreateScormEvent) {
    const metadata = buildActivityLogMetadata({
      previous: {},
      updated: event.scormCreationData.createdScorm,
      schema: "create",
    });

    await this.activityLogsService.recordActivity({
      actor: event.scormCreationData.actor,
      tenantId: event.scormCreationData.actor.tenantId,
      operation: ACTIVITY_LOG_ACTION_TYPES.CREATE,
      resourceType: ACTIVITY_LOG_RESOURCE_TYPES.SCORM,
      resourceId: event.scormCreationData.scormId,
      after: metadata.after,
      context: metadata.context ?? null,
    });
  }

  private async handleUpdateScorm(event: UpdateScormEvent) {
    const { scormUpdateData } = event;

    const metadata = buildActivityLogMetadata({
      previous: scormUpdateData.previousScormData,
      updated: scormUpdateData.updatedScormData,
    });

    await this.activityLogsService.recordActivity({
      actor: scormUpdateData.actor,
      tenantId: scormUpdateData.actor.tenantId,
      operation: ACTIVITY_LOG_ACTION_TYPES.UPDATE,
      resourceType: ACTIVITY_LOG_RESOURCE_TYPES.SCORM,
      resourceId: scormUpdateData.scormId,
      changedFields: metadata.changedFields,
      before: metadata.before,
      after: metadata.after,
      context: metadata.context ?? null,
    });
  }

  private async handleDeleteScorm(event: DeleteScormEvent) {
    const { actor, scormIds } = event.scormDeletionData;

    await this.activityLogsService.recordActivity({
      actor,
      tenantId: actor.tenantId,
      operation: ACTIVITY_LOG_ACTION_TYPES.DELETE,
      resourceType: ACTIVITY_LOG_RESOURCE_TYPES.SCORM,
      resourceId: scormIds.length === 1 ? scormIds[0].scormId : null,
      context: {
        deletedScormIds: JSON.stringify(scormIds.map((scorm) => scorm.scormId)),
        deletedCount: String(scormIds.length),
      },
    });
  }

  private async handlePlayScorm(event: PlayScormEvent) {
    await this.activityLogsService.recordActivity({
      actor: event.playData.actor,
      tenantId: event.playData.actor.tenantId,
      operation: ACTIVITY_LOG_ACTION_TYPES.PLAY_SCORM,
      resourceType: ACTIVITY_LOG_RESOURCE_TYPES.SCORM,
      resourceId: event.playData.scormId,
      context: {
        playedByUserId: event.playData.userId,
      },
    });
  }

  private async handleCompleteScorm(event: CompleteScormEvent) {
    await this.activityLogsService.recordActivity({
      actor: event.completeData.actor,
      tenantId: event.completeData.actor.tenantId,
      operation: ACTIVITY_LOG_ACTION_TYPES.COMPLETE_SCORM,
      resourceType: ACTIVITY_LOG_RESOURCE_TYPES.SCORM,
      resourceId: event.completeData.scormId,
      context: {
        completedByUserId: event.completeData.userId,
      },
    });
  }
}
