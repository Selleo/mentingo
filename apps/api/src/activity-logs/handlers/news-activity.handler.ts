import { Injectable } from "@nestjs/common";
import { EventsHandler, type IEventHandler } from "@nestjs/cqrs";

import { CreateNewsEvent, DeleteNewsEvent, UpdateNewsEvent } from "src/events";

import { ActivityLogsService } from "../activity-logs.service";
import { ACTIVITY_LOG_ACTION_TYPES, ACTIVITY_LOG_RESOURCE_TYPES } from "../types";
import { buildActivityLogMetadata } from "../utils/build-activity-log-metadata";

type NewsEventType = CreateNewsEvent | UpdateNewsEvent | DeleteNewsEvent;

const NewsActivityEvents = [CreateNewsEvent, UpdateNewsEvent, DeleteNewsEvent] as const;

@Injectable()
@EventsHandler(...NewsActivityEvents)
export class NewsActivityHandler implements IEventHandler<NewsEventType> {
  constructor(private readonly activityLogsService: ActivityLogsService) {}

  async handle(event: NewsEventType) {
    if (event instanceof CreateNewsEvent) return await this.handleCreateNews(event);
    if (event instanceof UpdateNewsEvent) return await this.handleUpdateNews(event);
    if (event instanceof DeleteNewsEvent) return await this.handleDeleteNews(event);
  }

  private async handleCreateNews(event: CreateNewsEvent) {
    const { newsCreationData } = event;

    const metadata = buildActivityLogMetadata({
      previous: {},
      updated: newsCreationData.createdNews,
      schema: "create",
      context: this.buildLanguageContext(newsCreationData.language, newsCreationData.createdNews),
    });

    await this.activityLogsService.recordActivity({
      actor: newsCreationData.actor,
      operation: ACTIVITY_LOG_ACTION_TYPES.CREATE,
      resourceType: ACTIVITY_LOG_RESOURCE_TYPES.NEWS,
      resourceId: newsCreationData.newsId,
      after: metadata.after,
      context: metadata.context ?? null,
    });
  }

  private async handleUpdateNews(event: UpdateNewsEvent) {
    const { newsUpdateData } = event;

    const metadata = buildActivityLogMetadata({
      previous: newsUpdateData.previousNewsData,
      updated: newsUpdateData.updatedNewsData,
      context: this.buildLanguageContext(
        newsUpdateData.language,
        newsUpdateData.updatedNewsData,
        newsUpdateData.action,
      ),
    });

    await this.activityLogsService.recordActivity({
      actor: newsUpdateData.actor,
      operation: ACTIVITY_LOG_ACTION_TYPES.UPDATE,
      resourceType: ACTIVITY_LOG_RESOURCE_TYPES.NEWS,
      resourceId: newsUpdateData.newsId,
      changedFields: metadata.changedFields,
      before: metadata.before,
      after: metadata.after,
      context: metadata.context ?? null,
    });
  }

  private async handleDeleteNews(event: DeleteNewsEvent) {
    const { newsDeleteData } = event;

    await this.activityLogsService.recordActivity({
      actor: newsDeleteData.actor,
      operation: ACTIVITY_LOG_ACTION_TYPES.DELETE,
      resourceType: ACTIVITY_LOG_RESOURCE_TYPES.NEWS,
      resourceId: newsDeleteData.newsId,
      context: this.buildLanguageContext(newsDeleteData.language ?? newsDeleteData.baseLanguage, {
        availableLocales: newsDeleteData.availableLocales,
        baseLanguage: newsDeleteData.baseLanguage,
        title: newsDeleteData.title,
      }),
    });
  }

  private buildLanguageContext(
    language?: string,
    snapshotOrMeta?: { availableLocales?: string[]; baseLanguage?: string; title?: string | null },
    action?: string,
  ) {
    const context: Record<string, string> = {};

    if (language) context.language = language;
    if (action) context.action = action;

    const baseLanguage =
      snapshotOrMeta && "baseLanguage" in snapshotOrMeta ? snapshotOrMeta.baseLanguage : undefined;
    const availableLocales =
      snapshotOrMeta && "availableLocales" in snapshotOrMeta
        ? snapshotOrMeta.availableLocales
        : undefined;
    const title = snapshotOrMeta && "title" in snapshotOrMeta ? snapshotOrMeta.title : undefined;

    if (baseLanguage) context.baseLanguage = baseLanguage;
    if (availableLocales?.length) context.availableLocales = availableLocales.join(",");
    if (title) context.title = title;

    return Object.keys(context).length ? context : null;
  }
}
