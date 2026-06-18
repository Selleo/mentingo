import { Injectable } from "@nestjs/common";
import { EventsHandler, type IEventHandler } from "@nestjs/cqrs";

import {
  CreateLiveTrainingEvent,
  DeleteLiveTrainingEvent,
  EndLiveTrainingSessionEvent,
  FailLiveTrainingSessionEvent,
  StartLiveTrainingSessionEvent,
  UpdateLiveTrainingEvent,
  UpdateLiveTrainingMaterialsEvent,
} from "src/events";
import { LiveTrainingService } from "src/live-training/live-training.service";

import { ActivityLogsService } from "../activity-logs.service";
import { ACTIVITY_LOG_ACTION_TYPES, ACTIVITY_LOG_RESOURCE_TYPES } from "../types";
import { buildActivityLogMetadata } from "../utils/build-activity-log-metadata";

import type { ActorUserType } from "src/common/types/actor-user.type";

type LiveTrainingEventType =
  | CreateLiveTrainingEvent
  | UpdateLiveTrainingEvent
  | DeleteLiveTrainingEvent
  | StartLiveTrainingSessionEvent
  | EndLiveTrainingSessionEvent
  | FailLiveTrainingSessionEvent
  | UpdateLiveTrainingMaterialsEvent;

const LiveTrainingActivityEvents = [
  CreateLiveTrainingEvent,
  UpdateLiveTrainingEvent,
  DeleteLiveTrainingEvent,
  StartLiveTrainingSessionEvent,
  EndLiveTrainingSessionEvent,
  FailLiveTrainingSessionEvent,
  UpdateLiveTrainingMaterialsEvent,
] as const;

@Injectable()
@EventsHandler(...LiveTrainingActivityEvents)
export class LiveTrainingActivityHandler implements IEventHandler<LiveTrainingEventType> {
  constructor(
    private readonly activityLogsService: ActivityLogsService,
    private readonly liveTrainingService: LiveTrainingService,
  ) {}

  async handle(event: LiveTrainingEventType) {
    if (event instanceof CreateLiveTrainingEvent) return await this.handleCreate(event);

    if (event instanceof UpdateLiveTrainingEvent) return await this.handleUpdate(event);

    if (event instanceof DeleteLiveTrainingEvent) return await this.handleDelete(event);

    if (event instanceof UpdateLiveTrainingMaterialsEvent) {
      return await this.handleMaterialsUpdate(event);
    }

    if (event instanceof StartLiveTrainingSessionEvent) return await this.handleSessionStart(event);

    if (event instanceof EndLiveTrainingSessionEvent) return await this.handleSessionEnd(event);

    if (event instanceof FailLiveTrainingSessionEvent) return await this.handleSessionFail(event);
  }

  private async handleCreate(event: CreateLiveTrainingEvent) {
    const createdLiveTraining = await this.liveTrainingService.buildLiveTrainingActivitySnapshot(
      event.liveTrainingCreationData.liveTrainingId,
      event.liveTrainingCreationData.language,
      undefined,
      { includeDeleted: true },
    );
    const metadata = buildActivityLogMetadata({
      previous: {},
      updated: createdLiveTraining,
      schema: "create",
      context: {
        deliveryType: createdLiveTraining.deliveryType,
        status: createdLiveTraining.status,
      },
    });

    await this.activityLogsService.recordActivity({
      actor: event.liveTrainingCreationData.actor,
      operation: ACTIVITY_LOG_ACTION_TYPES.CREATE,
      resourceType: ACTIVITY_LOG_RESOURCE_TYPES.LIVE_TRAINING,
      resourceId: event.liveTrainingCreationData.liveTrainingId,
      after: metadata.after,
      context: metadata.context ?? null,
    });
  }

  private async handleUpdate(event: UpdateLiveTrainingEvent) {
    const { liveTrainingUpdateData } = event;
    const metadata = buildActivityLogMetadata({
      previous: liveTrainingUpdateData.previousLiveTrainingData,
      updated: liveTrainingUpdateData.updatedLiveTrainingData,
      context: liveTrainingUpdateData.context ?? null,
    });

    await this.activityLogsService.recordActivity({
      actor: liveTrainingUpdateData.actor,
      operation: ACTIVITY_LOG_ACTION_TYPES.UPDATE,
      resourceType: ACTIVITY_LOG_RESOURCE_TYPES.LIVE_TRAINING,
      resourceId: liveTrainingUpdateData.liveTrainingId,
      changedFields: metadata.changedFields,
      before: metadata.before,
      after: metadata.after,
      context: metadata.context ?? null,
    });
  }

  private async handleDelete(event: DeleteLiveTrainingEvent) {
    const deletedLiveTraining = await this.liveTrainingService.buildLiveTrainingActivitySnapshot(
      event.liveTrainingDeleteData.liveTrainingId,
      event.liveTrainingDeleteData.language,
      undefined,
      { includeDeleted: true },
    );

    await this.activityLogsService.recordActivity({
      actor: event.liveTrainingDeleteData.actor,
      operation: ACTIVITY_LOG_ACTION_TYPES.DELETE,
      resourceType: ACTIVITY_LOG_RESOURCE_TYPES.LIVE_TRAINING,
      resourceId: event.liveTrainingDeleteData.liveTrainingId,
      context: {
        title: deletedLiveTraining.title ?? "",
      },
    });
  }

  private async handleMaterialsUpdate(event: UpdateLiveTrainingMaterialsEvent) {
    const { liveTrainingMaterialsUpdateData } = event;
    const metadata = buildActivityLogMetadata({
      previous: liveTrainingMaterialsUpdateData.previousLiveTrainingData,
      updated: liveTrainingMaterialsUpdateData.updatedLiveTrainingData,
      context: liveTrainingMaterialsUpdateData.context,
    });

    await this.activityLogsService.recordActivity({
      actor: liveTrainingMaterialsUpdateData.actor,
      operation: ACTIVITY_LOG_ACTION_TYPES.UPDATE,
      resourceType: ACTIVITY_LOG_RESOURCE_TYPES.LIVE_TRAINING,
      resourceId: liveTrainingMaterialsUpdateData.liveTrainingId,
      changedFields: metadata.changedFields,
      before: metadata.before,
      after: metadata.after,
      context: metadata.context ?? null,
    });
  }

  private async handleSessionStart(event: StartLiveTrainingSessionEvent) {
    await this.handleSessionUpdate(event.liveTrainingSessionStartData);
  }

  private async handleSessionEnd(event: EndLiveTrainingSessionEvent) {
    await this.handleSessionUpdate(event.liveTrainingSessionEndData);
  }

  private async handleSessionFail(event: FailLiveTrainingSessionEvent) {
    await this.handleSessionUpdate(event.liveTrainingSessionFailData);
  }

  private async handleSessionUpdate(input: {
    liveTrainingId: string;
    sessionId: string;
    actor: ActorUserType;
    liveTraining: Record<string, unknown> | null;
    context: Record<string, string>;
  }) {
    await this.activityLogsService.recordActivity({
      actor: input.actor,
      operation: ACTIVITY_LOG_ACTION_TYPES.UPDATE,
      resourceType: ACTIVITY_LOG_RESOURCE_TYPES.LIVE_TRAINING,
      resourceId: input.liveTrainingId,
      context: {
        ...input.context,
        sessionId: input.sessionId,
      },
    });
  }
}
