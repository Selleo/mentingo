import { Injectable } from "@nestjs/common";
import { EventsHandler, type IEventHandler } from "@nestjs/cqrs";

import {
  CreateLearningPathEvent,
  UpdateLearningPathEvent,
  DeleteLearningPathEvent,
  EnrollLearningPathEvent,
  StartLearningPathEvent,
  CompleteLearningPathEvent,
} from "src/events";

import { ActivityLogsService } from "../activity-logs.service";
import { ACTIVITY_LOG_ACTION_TYPES, ACTIVITY_LOG_RESOURCE_TYPES } from "../types";
import { buildActivityLogMetadata } from "../utils/build-activity-log-metadata";

type LearningPathEventType =
  | CreateLearningPathEvent
  | UpdateLearningPathEvent
  | DeleteLearningPathEvent
  | EnrollLearningPathEvent
  | StartLearningPathEvent
  | CompleteLearningPathEvent;

const LearningPathActivityEvents = [
  CreateLearningPathEvent,
  UpdateLearningPathEvent,
  DeleteLearningPathEvent,
  EnrollLearningPathEvent,
  StartLearningPathEvent,
  CompleteLearningPathEvent,
] as const;

@Injectable()
@EventsHandler(...LearningPathActivityEvents)
export class LearningPathActivityHandler implements IEventHandler<LearningPathEventType> {
  constructor(private readonly activityLogsService: ActivityLogsService) {}

  async handle(event: LearningPathEventType) {
    if (event instanceof CreateLearningPathEvent) return await this.handleCreateLearningPath(event);

    if (event instanceof UpdateLearningPathEvent) return await this.handleUpdateLearningPath(event);

    if (event instanceof DeleteLearningPathEvent) return await this.handleDeleteLearningPath(event);

    if (event instanceof EnrollLearningPathEvent) return await this.handleEnrollLearningPath(event);

    if (event instanceof StartLearningPathEvent) return await this.handleStartLearningPath(event);

    if (event instanceof CompleteLearningPathEvent)
      return await this.handleCompleteLearningPath(event);
  }

  private async handleCreateLearningPath(event: CreateLearningPathEvent) {
    const metadata = buildActivityLogMetadata({
      previous: {},
      updated: event.learningPathCreationData.createdLearningPath,
      schema: "create",
    });

    await this.activityLogsService.recordActivity({
      actor: event.learningPathCreationData.actor,
      tenantId: event.learningPathCreationData.actor.tenantId,
      operation: ACTIVITY_LOG_ACTION_TYPES.CREATE,
      resourceType: ACTIVITY_LOG_RESOURCE_TYPES.LEARNING_PATH,
      resourceId: event.learningPathCreationData.learningPathId,
      after: metadata.after,
      context: metadata.context ?? null,
    });
  }

  private async handleUpdateLearningPath(event: UpdateLearningPathEvent) {
    const { learningPathUpdateData } = event;

    const metadata = buildActivityLogMetadata({
      previous: learningPathUpdateData.previousLearningPathData,
      updated: learningPathUpdateData.updatedLearningPathData,
    });

    await this.activityLogsService.recordActivity({
      actor: learningPathUpdateData.actor,
      tenantId: learningPathUpdateData.actor.tenantId,
      operation: ACTIVITY_LOG_ACTION_TYPES.UPDATE,
      resourceType: ACTIVITY_LOG_RESOURCE_TYPES.LEARNING_PATH,
      resourceId: learningPathUpdateData.learningPathId,
      changedFields: metadata.changedFields,
      before: metadata.before,
      after: metadata.after,
      context: metadata.context ?? null,
    });
  }

  private async handleDeleteLearningPath(event: DeleteLearningPathEvent) {
    await this.activityLogsService.recordActivity({
      actor: event.learningPathDeletionData.actor,
      tenantId: event.learningPathDeletionData.actor.tenantId,
      operation: ACTIVITY_LOG_ACTION_TYPES.DELETE,
      resourceType: ACTIVITY_LOG_RESOURCE_TYPES.LEARNING_PATH,
      resourceId: event.learningPathDeletionData.learningPathId,
    });
  }

  private async handleEnrollLearningPath(event: EnrollLearningPathEvent) {
    const { actor, learningPathId, userIds, groupIds } = event.enrollmentData;

    const context: Record<string, string> = {
      enrolledUserIds: JSON.stringify(userIds),
      enrolledCount: String(userIds.length),
    };

    if (groupIds?.length) {
      context.groupIds = JSON.stringify(groupIds);
    }

    await this.activityLogsService.recordActivity({
      actor,
      tenantId: actor.tenantId,
      operation: ACTIVITY_LOG_ACTION_TYPES.ENROLL_LEARNING_PATH,
      resourceType: ACTIVITY_LOG_RESOURCE_TYPES.LEARNING_PATH,
      resourceId: learningPathId,
      context,
    });
  }

  private async handleStartLearningPath(event: StartLearningPathEvent) {
    await this.activityLogsService.recordActivity({
      actor: event.startData.actor,
      tenantId: event.startData.actor.tenantId,
      operation: ACTIVITY_LOG_ACTION_TYPES.START_LEARNING_PATH,
      resourceType: ACTIVITY_LOG_RESOURCE_TYPES.LEARNING_PATH,
      resourceId: event.startData.learningPathId,
      context: { learningPathId: event.startData.learningPathId },
    });
  }

  private async handleCompleteLearningPath(event: CompleteLearningPathEvent) {
    await this.activityLogsService.recordActivity({
      actor: event.completeData.actor,
      tenantId: event.completeData.actor.tenantId,
      operation: ACTIVITY_LOG_ACTION_TYPES.COMPLETE_LEARNING_PATH,
      resourceType: ACTIVITY_LOG_RESOURCE_TYPES.LEARNING_PATH,
      resourceId: event.completeData.learningPathId,
      context: { learningPathId: event.completeData.learningPathId },
    });
  }
}
