import { Injectable } from "@nestjs/common";
import { EventsHandler, type IEventHandler } from "@nestjs/cqrs";

import { CreateArticleLanguageEvent } from "src/events/articles/create-article-language.event";
import { CreateArticleEvent } from "src/events/articles/create-articles.event";
import { CreateSectionLanguageEvent } from "src/events/articles/create-section-language.event";
import { CreateArticleSectionEvent } from "src/events/articles/create-section.event";
import { DeleteArticleLanguageEvent } from "src/events/articles/delete-article-language.event";
import { DeleteArticleEvent } from "src/events/articles/delete-articles.event";
import { DeleteArticleSectionEvent } from "src/events/articles/delete-section.event";
import { UpdateArticleEvent } from "src/events/articles/update-articles.event";
import { UpdateArticleSectionEvent } from "src/events/articles/update-section.event";

import { ActivityLogsService } from "../activity-logs.service";
import { ACTIVITY_LOG_ACTION_TYPES, ACTIVITY_LOG_RESOURCE_TYPES } from "../types";
import { buildActivityLogMetadata } from "../utils/build-activity-log-metadata";

type ArticleEventType =
  | CreateArticleEvent
  | UpdateArticleEvent
  | DeleteArticleEvent
  | CreateArticleSectionEvent
  | UpdateArticleSectionEvent
  | DeleteArticleSectionEvent
  | CreateArticleLanguageEvent
  | DeleteArticleLanguageEvent
  | CreateSectionLanguageEvent;

const ArticleActivityEvents = [
  CreateArticleEvent,
  UpdateArticleEvent,
  DeleteArticleEvent,
  CreateArticleSectionEvent,
  UpdateArticleSectionEvent,
  DeleteArticleSectionEvent,
  CreateArticleLanguageEvent,
  DeleteArticleLanguageEvent,
  CreateSectionLanguageEvent,
] as const;

@Injectable()
@EventsHandler(...ArticleActivityEvents)
export class ArticlesActivityHandler implements IEventHandler<ArticleEventType> {
  constructor(private readonly activityLogsService: ActivityLogsService) {}

  async handle(event: ArticleEventType) {
    if (event instanceof CreateArticleEvent) return await this.handleCreateArticle(event);
    if (event instanceof DeleteArticleLanguageEvent)
      return await this.handleDeleteArticleLanguage(event);
    if (event instanceof CreateArticleLanguageEvent)
      return await this.handleCreateArticleLanguage(event);
    if (event instanceof UpdateArticleEvent) return await this.handleUpdateArticle(event);
    if (event instanceof DeleteArticleEvent) return await this.handleDeleteArticle(event);
    if (event instanceof CreateSectionLanguageEvent)
      return await this.handleCreateSectionLanguageEvent(event);
    if (event instanceof CreateArticleSectionEvent)
      return await this.handleCreateArticleSection(event);
    if (event instanceof UpdateArticleSectionEvent)
      return await this.handleUpdateArticleSection(event);
    if (event instanceof DeleteArticleSectionEvent)
      return await this.handleDeleteArticleSection(event);
  }

  private async handleCreateArticle(event: CreateArticleEvent) {
    const { articleCreationData } = event;

    const metadata = buildActivityLogMetadata({
      previous: {},
      updated: articleCreationData.createdArticle,
      schema: "create",
      context: this.buildLanguageContext(
        articleCreationData.language,
        articleCreationData.createdArticle,
      ),
    });

    await this.activityLogsService.recordActivity({
      actor: articleCreationData.actor,
      operation: ACTIVITY_LOG_ACTION_TYPES.CREATE,
      resourceType: ACTIVITY_LOG_RESOURCE_TYPES.ARTICLE,
      resourceId: articleCreationData.articleId,
      after: metadata.after,
      context: metadata.context ?? null,
    });
  }

  private async handleUpdateArticle(event: UpdateArticleEvent) {
    const { articleUpdateData } = event;

    const metadata = buildActivityLogMetadata({
      previous: articleUpdateData.previousArticleData,
      updated: articleUpdateData.updatedArticleData,
      context: this.buildLanguageContext(
        articleUpdateData.language,
        articleUpdateData.updatedArticleData,
        articleUpdateData.action,
      ),
    });

    await this.activityLogsService.recordActivity({
      actor: articleUpdateData.actor,
      operation: ACTIVITY_LOG_ACTION_TYPES.UPDATE,
      resourceType: ACTIVITY_LOG_RESOURCE_TYPES.ARTICLE,
      resourceId: articleUpdateData.articleId,
      changedFields: metadata.changedFields,
      before: metadata.before,
      after: metadata.after,
      context: metadata.context ?? null,
    });
  }

  private async handleDeleteArticle(event: DeleteArticleEvent) {
    const { articleDeleteData } = event;

    await this.activityLogsService.recordActivity({
      actor: articleDeleteData.actor,
      operation: ACTIVITY_LOG_ACTION_TYPES.DELETE,
      resourceType: ACTIVITY_LOG_RESOURCE_TYPES.ARTICLE,
      resourceId: articleDeleteData.articleId,
      context: this.buildLanguageContext(
        articleDeleteData.language ?? articleDeleteData.baseLanguage,
        {
          availableLocales: articleDeleteData.availableLocales,
          baseLanguage: articleDeleteData.baseLanguage,
          title: articleDeleteData.title,
        },
      ),
    });
  }

  private async handleCreateArticleSection(event: CreateArticleSectionEvent) {
    const { articleSectionCreationData } = event;

    const metadata = buildActivityLogMetadata({
      previous: {},
      updated: articleSectionCreationData.createdArticleSection,
      schema: "create",
      context: this.buildLanguageContext(
        articleSectionCreationData.language,
        articleSectionCreationData.createdArticleSection,
      ),
    });

    await this.activityLogsService.recordActivity({
      actor: articleSectionCreationData.actor,
      operation: ACTIVITY_LOG_ACTION_TYPES.CREATE,
      resourceType: ACTIVITY_LOG_RESOURCE_TYPES.ARTICLE_SECTION,
      resourceId: articleSectionCreationData.articleSectionId,
      after: metadata.after,
      context: metadata.context ?? null,
    });
  }

  private async handleUpdateArticleSection(event: UpdateArticleSectionEvent) {
    const { articleSectionUpdateData } = event;

    const metadata = buildActivityLogMetadata({
      previous: articleSectionUpdateData.previousArticleSectionData,
      updated: articleSectionUpdateData.updatedArticleSectionData,
      context: this.buildLanguageContext(
        articleSectionUpdateData.language,
        articleSectionUpdateData.updatedArticleSectionData,
        articleSectionUpdateData.action,
      ),
    });

    await this.activityLogsService.recordActivity({
      actor: articleSectionUpdateData.actor,
      operation: ACTIVITY_LOG_ACTION_TYPES.UPDATE,
      resourceType: ACTIVITY_LOG_RESOURCE_TYPES.ARTICLE_SECTION,
      resourceId: articleSectionUpdateData.articleSectionId,
      changedFields: metadata.changedFields,
      before: metadata.before,
      after: metadata.after,
      context: metadata.context ?? null,
    });
  }

  private async handleCreateSectionLanguageEvent(event: CreateSectionLanguageEvent) {
    const { articleSectionUpdateData } = event;

    const metadata = buildActivityLogMetadata({
      previous: null,
      updated: articleSectionUpdateData.updatedArticleSectionData,
      schema: "create",
      context: this.buildLanguageContext(
        articleSectionUpdateData.language,
        articleSectionUpdateData.updatedArticleSectionData,
        articleSectionUpdateData.action,
      ),
    });

    await this.activityLogsService.recordActivity({
      actor: articleSectionUpdateData.actor,
      operation: ACTIVITY_LOG_ACTION_TYPES.CREATE,
      resourceType: ACTIVITY_LOG_RESOURCE_TYPES.ARTICLE_SECTION,
      resourceId: articleSectionUpdateData.articleSectionId,
      before: null,
      after: metadata.after,
      context: metadata.context ?? null,
    });
  }

  private async handleDeleteArticleSection(event: DeleteArticleSectionEvent) {
    const { articleSectionDeleteData } = event;

    await this.activityLogsService.recordActivity({
      actor: articleSectionDeleteData.actor,
      operation: ACTIVITY_LOG_ACTION_TYPES.DELETE,
      resourceType: ACTIVITY_LOG_RESOURCE_TYPES.ARTICLE_SECTION,
      resourceId: articleSectionDeleteData.articleSectionId,
      context: this.buildLanguageContext(
        articleSectionDeleteData.language ?? articleSectionDeleteData.baseLanguage,
        {
          availableLocales: articleSectionDeleteData.availableLocales,
          baseLanguage: articleSectionDeleteData.baseLanguage,
          title: articleSectionDeleteData.title,
        },
      ),
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

  private async handleCreateArticleLanguage(event: CreateArticleLanguageEvent) {
    const { articleUpdateData } = event;

    const metadata = buildActivityLogMetadata({
      previous: articleUpdateData.previousArticleData,
      updated: articleUpdateData.updatedArticleData,
      context: this.buildLanguageContext(
        articleUpdateData.language,
        articleUpdateData.updatedArticleData,
        articleUpdateData.action,
      ),
    });

    await this.activityLogsService.recordActivity({
      actor: articleUpdateData.actor,
      operation: ACTIVITY_LOG_ACTION_TYPES.CREATE,
      resourceType: ACTIVITY_LOG_RESOURCE_TYPES.ARTICLE,
      resourceId: articleUpdateData.articleId,
      changedFields: metadata.changedFields,
      after: metadata.after,
      context: metadata.context ?? null,
    });
  }

  private async handleDeleteArticleLanguage(event: DeleteArticleLanguageEvent) {
    const { articleUpdateData } = event;

    const metadata = buildActivityLogMetadata({
      previous: articleUpdateData.previousArticleData,
      updated: null,
      context: this.buildLanguageContext(
        articleUpdateData.language,
        undefined,
        articleUpdateData.action,
      ),
    });

    await this.activityLogsService.recordActivity({
      actor: articleUpdateData.actor,
      operation: ACTIVITY_LOG_ACTION_TYPES.DELETE,
      resourceType: ACTIVITY_LOG_RESOURCE_TYPES.ARTICLE,
      resourceId: articleUpdateData.articleId,
      changedFields: metadata.changedFields,
      before: null,
      context: metadata.context ?? null,
    });
  }
}
