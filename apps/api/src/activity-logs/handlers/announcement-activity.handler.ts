import { Injectable } from "@nestjs/common";
import { EventsHandler, type IEventHandler } from "@nestjs/cqrs";

import { CreateAnnouncementEvent, ViewAnnouncementEvent } from "src/events";

import { ActivityLogsService } from "../activity-logs.service";
import { ACTIVITY_LOG_ACTION_TYPES, ACTIVITY_LOG_RESOURCE_TYPES } from "../types";
import { buildActivityLogMetadata } from "../utils/build-activity-log-metadata";

type AnnouncementEventType = CreateAnnouncementEvent | ViewAnnouncementEvent;

const AnnouncementActivityEvents = [CreateAnnouncementEvent, ViewAnnouncementEvent] as const;

@Injectable()
@EventsHandler(...AnnouncementActivityEvents)
export class AnnouncementActivityHandler implements IEventHandler<AnnouncementEventType> {
  constructor(private readonly activityLogsService: ActivityLogsService) {}

  async handle(event: AnnouncementEventType) {
    if (event instanceof CreateAnnouncementEvent) return await this.handleCreate(event);

    if (event instanceof ViewAnnouncementEvent) return await this.handleView(event);
  }

  private async handleCreate(event: CreateAnnouncementEvent) {
    const { announcementData } = event;

    const context: Record<string, string> = {
      audience: announcementData.announcement.isEveryone ? "everyone" : "group",
    };

    const metadata = buildActivityLogMetadata({
      previous: {},
      updated: announcementData.announcement,
      schema: "create",
      context,
    });

    await this.activityLogsService.recordActivity({
      actorId: announcementData.createdById,
      operation: ACTIVITY_LOG_ACTION_TYPES.CREATE,
      resourceType: ACTIVITY_LOG_RESOURCE_TYPES.ANNOUNCEMENT,
      resourceId: announcementData.announcementId,
      after: metadata.after,
      context: metadata.context ?? null,
    });
  }

  private async handleView(event: ViewAnnouncementEvent) {
    const { announcementReadData } = event;

    await this.activityLogsService.recordActivity({
      actorId: announcementReadData.readById,
      operation: ACTIVITY_LOG_ACTION_TYPES.VIEW_ANNOUNCEMENT,
      resourceType: ACTIVITY_LOG_RESOURCE_TYPES.ANNOUNCEMENT,
      resourceId: announcementReadData.announcementId,
      context: announcementReadData.context ?? null,
    });
  }
}
