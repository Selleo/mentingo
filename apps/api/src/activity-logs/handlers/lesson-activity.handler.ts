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
import { buildActivityLogMetadata } from "../utils/build-activity-log-metadata";

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
      actor: event.lessonCompletionData.actor,
      operation: ACTIVITY_LOG_ACTION_TYPES.COMPLETE_LESSON,
      resourceType: ACTIVITY_LOG_RESOURCE_TYPES.LESSON,
      resourceId: event.lessonCompletionData.lessonId,
    });
  }

  private async handleCreateLesson(event: CreateLessonEvent) {
    const { lessonCreationData } = event;

    const context: Record<string, string> = {
      lessonType: lessonCreationData.createdLesson.type,
    };

    const metadata = buildActivityLogMetadata({
      previous: {},
      updated: lessonCreationData.createdLesson,
      schema: "create",
      context,
    });

    await this.activityLogsService.recordActivity({
      actor: lessonCreationData.actor,
      operation: ACTIVITY_LOG_ACTION_TYPES.CREATE,
      resourceType: ACTIVITY_LOG_RESOURCE_TYPES.LESSON,
      resourceId: lessonCreationData.lessonId,
      after: metadata.after,
      context: metadata.context ?? null,
    });
  }

  private async handleUpdateLesson(event: UpdateLessonEvent) {
    const { lessonUpdateData } = event;

    const lessonType =
      lessonUpdateData.updatedLessonData?.type ?? lessonUpdateData.previousLessonData?.type ?? "";

    const context: Record<string, string> = {
      lessonType,
    };

    const quizSummary =
      lessonUpdateData.updatedLessonData?.quizSummary ??
      lessonUpdateData.previousLessonData?.quizSummary;

    if (quizSummary?.length) {
      context.quizSummary = quizSummary.join(" | ");
    }

    const metadata = buildActivityLogMetadata({
      previous: lessonUpdateData.previousLessonData,
      updated: lessonUpdateData.updatedLessonData,
      context,
    });

    await this.activityLogsService.recordActivity({
      actor: lessonUpdateData.actor,
      operation: ACTIVITY_LOG_ACTION_TYPES.UPDATE,
      resourceType: ACTIVITY_LOG_RESOURCE_TYPES.LESSON,
      resourceId: lessonUpdateData.lessonId,
      changedFields: metadata.changedFields,
      before: metadata.before,
      after: metadata.after,
      context: metadata.context ?? null,
    });
  }

  private async handleDeleteLesson(event: DeleteLessonEvent) {
    const { deleteLessonData } = event;

    await this.activityLogsService.recordActivity({
      actor: deleteLessonData.actor,
      operation: ACTIVITY_LOG_ACTION_TYPES.DELETE,
      resourceType: ACTIVITY_LOG_RESOURCE_TYPES.LESSON,
      resourceId: deleteLessonData.lessonId,
      context: { lessonName: deleteLessonData.lessonName },
    });
  }
}
