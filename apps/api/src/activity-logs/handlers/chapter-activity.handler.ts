import { Injectable } from "@nestjs/common";
import { EventsHandler, type IEventHandler } from "@nestjs/cqrs";

import {
  CreateChapterEvent,
  DeleteChapterEvent,
  UpdateChapterEvent,
  UserChapterFinishedEvent,
} from "src/events";

import { ActivityLogsService } from "../activity-logs.service";
import { ACTIVITY_LOG_ACTION_TYPES, ACTIVITY_LOG_RESOURCE_TYPES } from "../types";
import { buildActivityLogMetadata } from "../utils/build-activity-log-metadata";

type ChapterEventType =
  | UserChapterFinishedEvent
  | CreateChapterEvent
  | UpdateChapterEvent
  | DeleteChapterEvent;

const ChapterActivityEvents = [
  UserChapterFinishedEvent,
  CreateChapterEvent,
  UpdateChapterEvent,
  DeleteChapterEvent,
] as const;

@Injectable()
@EventsHandler(...ChapterActivityEvents)
export class ChapterActivityHandler implements IEventHandler<ChapterEventType> {
  constructor(private readonly activityLogsService: ActivityLogsService) {}

  async handle(event: ChapterEventType) {
    if (event instanceof UserChapterFinishedEvent)
      return await this.handleUserChapterFinished(event);

    if (event instanceof CreateChapterEvent) return await this.handleCreateChapter(event);

    if (event instanceof UpdateChapterEvent) return await this.handleUpdateChapter(event);

    if (event instanceof DeleteChapterEvent) return await this.handleDeleteChapter(event);
  }

  private async handleUserChapterFinished(event: UserChapterFinishedEvent) {
    await this.activityLogsService.recordActivity({
      actorId: event.chapterFinishedData.userId,
      operation: ACTIVITY_LOG_ACTION_TYPES.COMPLETE_CHAPTER,
      resourceType: ACTIVITY_LOG_RESOURCE_TYPES.CHAPTER,
      resourceId: event.chapterFinishedData.chapterId,
    });
  }

  private async handleCreateChapter(event: CreateChapterEvent) {
    const { chapterCreationData } = event;

    const metadata = buildActivityLogMetadata({
      previous: {},
      updated: chapterCreationData.createdChapter,
      schema: "create",
    });

    await this.activityLogsService.recordActivity({
      actorId: chapterCreationData.createdById,
      operation: ACTIVITY_LOG_ACTION_TYPES.CREATE,
      resourceType: ACTIVITY_LOG_RESOURCE_TYPES.CHAPTER,
      resourceId: chapterCreationData.chapterId,
      after: metadata.after,
      context: metadata.context ?? null,
    });
  }

  private async handleUpdateChapter(event: UpdateChapterEvent) {
    const { chapterUpdateData } = event;

    const metadata = buildActivityLogMetadata({
      previous: chapterUpdateData.previousChapterData,
      updated: chapterUpdateData.updatedChapterData,
    });

    await this.activityLogsService.recordActivity({
      actorId: chapterUpdateData.updatedById,
      operation: ACTIVITY_LOG_ACTION_TYPES.UPDATE,
      resourceType: ACTIVITY_LOG_RESOURCE_TYPES.CHAPTER,
      resourceId: chapterUpdateData.chapterId,
      changedFields: metadata.changedFields,
      before: metadata.before,
      after: metadata.after,
      context: metadata.context ?? null,
    });
  }

  private async handleDeleteChapter(event: DeleteChapterEvent) {
    const { deleteChapterData } = event;

    await this.activityLogsService.recordActivity({
      actorId: deleteChapterData.deletedById,
      operation: ACTIVITY_LOG_ACTION_TYPES.DELETE,
      resourceType: ACTIVITY_LOG_RESOURCE_TYPES.CHAPTER,
      resourceId: deleteChapterData.chapterId,
      context: { chapterName: deleteChapterData.chapterName },
    });
  }
}
