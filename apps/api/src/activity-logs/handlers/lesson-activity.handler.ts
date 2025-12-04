import { Injectable } from "@nestjs/common";
import { EventsHandler, type IEventHandler } from "@nestjs/cqrs";

import {
  CreateLessonEvent,
  DeleteLessonEvent,
  LessonCompletedEvent,
  UpdateLessonEvent,
} from "src/events";

import { ActivityLogsService } from "../activity-logs.service";
import { ACTIVITY_LOG_ACTION_TYPES, ACTIVITY_LOG_RESOURCE_TYPES } from "../types";

type LessonEventType =
  | LessonCompletedEvent
  | CreateLessonEvent
  | UpdateLessonEvent
  | DeleteLessonEvent;

const LessonActivityEvents = [
  LessonCompletedEvent,
  CreateLessonEvent,
  UpdateLessonEvent,
  DeleteLessonEvent,
] as const;

@Injectable()
@EventsHandler(...LessonActivityEvents)
export class LessonActivityHandler implements IEventHandler<LessonEventType> {
  constructor(private readonly activityLogsService: ActivityLogsService) {}

  async handle(event: LessonEventType) {
    if (event instanceof LessonCompletedEvent) return await this.handleLessonCompleted(event);

    if (event instanceof CreateLessonEvent) return await this.handleCreateLesson(event);

    if (event instanceof UpdateLessonEvent) return await this.handleUpdateLesson(event);

    if (event instanceof DeleteLessonEvent) return await this.handleDeleteLesson(event);
  }

  private async handleLessonCompleted(event: LessonCompletedEvent) {
    await this.activityLogsService.recordActivity({
      actorId: event.userId,
      operation: ACTIVITY_LOG_ACTION_TYPES.COMPLETE_LESSON,
      resourceType: ACTIVITY_LOG_RESOURCE_TYPES.LESSON,
      resourceId: event.lessonId,
    });
  }

  private async handleCreateLesson(event: CreateLessonEvent) {
    const { lessonCreationData } = event;

    await this.activityLogsService.recordActivity({
      actorId: lessonCreationData.createdById,
      operation: ACTIVITY_LOG_ACTION_TYPES.CREATE,
      resourceType: ACTIVITY_LOG_RESOURCE_TYPES.LESSON,
      resourceId: lessonCreationData.lessonId,
    });
  }

  private async handleUpdateLesson(event: UpdateLessonEvent) {
    const { lessonUpdateData } = event;

    await this.activityLogsService.recordActivity({
      actorId: lessonUpdateData.updatedById,
      operation: ACTIVITY_LOG_ACTION_TYPES.UPDATE,
      resourceType: ACTIVITY_LOG_RESOURCE_TYPES.LESSON,
      resourceId: lessonUpdateData.lessonId,
      changedFields: lessonUpdateData.metadata.changedFields,
      before: lessonUpdateData.metadata.before,
      after: lessonUpdateData.metadata.after,
      context: lessonUpdateData.metadata.context ?? null,
    });
  }

  private async handleDeleteLesson(event: DeleteLessonEvent) {
    const { deleteLessonData } = event;

    await this.activityLogsService.recordActivity({
      actorId: deleteLessonData.deletedById,
      operation: ACTIVITY_LOG_ACTION_TYPES.DELETE,
      resourceType: ACTIVITY_LOG_RESOURCE_TYPES.LESSON,
      resourceId: deleteLessonData.lessonId,
      context: { lessonName: deleteLessonData.lessonName },
    });
  }
}
