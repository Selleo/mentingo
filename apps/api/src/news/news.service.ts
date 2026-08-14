import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import {
  ENTITY_TYPES,
  NEWS_STATUS,
  PERMISSIONS,
  RESOURCE_VISIBILITY,
  isSupportedLanguage,
  type EditableResourceVisibility,
  type SupportedLanguages,
} from "@repo/shared";
import { and, count, eq, getTableColumns, gt, lt, ne, or, sql } from "drizzle-orm";
import { isEmpty, isEqual } from "lodash";
import { match } from "ts-pattern";

import { DatabasePg } from "src/common";
import { buildJsonbField, deleteJsonbField } from "src/common/helpers/sqlHelpers";
import { hasAnyPermission, hasPermission } from "src/common/permissions/permission.utils";
import { annotateVideoAutoplayAndBlockIndexesInContent } from "src/common/utils/annotateVideoAutoplayAndBlockIndexesInContent";
import { injectResourcesIntoContent } from "src/common/utils/injectResourcesIntoContent";
import { CreateNewsEvent, DeleteNewsEvent, UpdateNewsEvent } from "src/events";
import { RESOURCE_RELATIONSHIP_TYPES, RESOURCE_CATEGORIES } from "src/file/file.constants";
import { FileService } from "src/file/file.service";
import { IMAGE_QUALITY } from "src/file/image-variants/image-variant.constants";
import { FILE_DELIVERY_TYPE } from "src/file/types/file-delivery.type";
import { streamFileToResponse } from "src/file/utils/streamFileToResponse";
import { SEARCH_ENTITY_TYPES } from "src/global-search/global-search.constants";
import { SearchIndexService } from "src/global-search/search-index.service";
import { LocalizationService } from "src/localization/localization.service";
import { OutboxPublisher } from "src/outbox/outbox.publisher";
import { ResourceLibraryService } from "src/resource-library/resource-library.service";
import { SettingsService } from "src/settings/settings.service";
import { DB } from "src/storage/db/db.providers";
import { news, resourceEntity, resources, users } from "src/storage/schema";
import { getLocalizedText } from "src/utils/jsonb";

import { baseNewsTitle } from "./constants";

import type { StoredNewsResource } from "./news.types";
import type { CreateNews } from "./schemas/createNews.schema";
import type { NewsResource, NewsResources } from "./schemas/selectNews.schema";
import type { UpdateNews, UpdateNewsTranslation } from "./schemas/updateNews.schema";
import type { InferSelectModel } from "drizzle-orm";
import type { Request, Response } from "express";
import type { NewsActivityLogSnapshot } from "src/activity-logs/types";
import type { UUIDType } from "src/common";
import type { CurrentUserType } from "src/common/types/current-user.type";
import type { FilePreviewFormat, FilePreviewOptions } from "src/file/types/file-preview.type";
import type { ResourceMetadata } from "src/file/types/resource-metadata.type";

// News uses a custom pagination: first page shows up to 7 items, following pages up to 9.
const FIRST_PAGE_SIZE = 7;
const SUBSEQUENT_PAGE_SIZE = 9;

@Injectable()
export class NewsService {
  constructor(
    @Inject(DB) private readonly db: DatabasePg,
    private readonly localizationService: LocalizationService,
    private readonly fileService: FileService,
    private readonly outboxPublisher: OutboxPublisher,
    private readonly settingsService: SettingsService,
    private readonly resourceLibraryService: ResourceLibraryService,
    private readonly searchIndexService: SearchIndexService,
  ) {}

  async createNews(createNewsBody: CreateNews, currentUser: CurrentUserType) {
    const { language } = createNewsBody;

    const [createdNews] = await this.db
      .insert(news)
      .values({
        title: buildJsonbField(language, baseNewsTitle[language]),
        baseLanguage: language,
        availableLocales: [language],
        authorId: currentUser.userId,
      })
      .returning({
        id: news.id,
        title: this.localizationService.getFieldByLanguage(news.title, language),
      });

    if (!createdNews) throw new BadRequestException("adminNewsView.toast.createError");

    const createdNewsSnapshot = await this.buildNewsActivitySnapshot(createdNews.id, language);

    await this.outboxPublisher.publish(
      new CreateNewsEvent({
        newsId: createdNews.id,
        actor: currentUser,
        createdNews: createdNewsSnapshot,
        language,
      }),
    );

    await this.searchIndexService.refreshNews(createdNews.id);

    return createdNews;
  }

  async updateNews(
    newsId: UUIDType,
    updateNewsBody: UpdateNews,
    currentUser?: CurrentUserType,
    uploadedFiles: Express.Multer.File[] = [],
  ) {
    const { translations, ...updateNewsData } = updateNewsBody;
    const existingNews = await this.validateManageableNews(newsId, currentUser, undefined, false);
    const responseLanguage = existingNews.baseLanguage;
    const previousSnapshot = await this.buildNewsActivitySnapshot(newsId, responseLanguage);
    const coverFiles = this.mapCoverFiles(uploadedFiles);

    this.validateBatchUpdate(existingNews, translations, coverFiles, updateNewsData.status);

    const finalUpdateData = this.buildBatchUpdateData(existingNews, translations, updateNewsData);
    const hasNewsDataToUpdate = !isEmpty(finalUpdateData);

    if (!hasNewsDataToUpdate && !Object.keys(coverFiles).length) {
      throw new BadRequestException("adminNewsView.toast.updateError");
    }

    if (hasNewsDataToUpdate) {
      await this.db.update(news).set(finalUpdateData).where(eq(news.id, newsId));
    }

    const coverUploads = Object.keys(coverFiles)
      .filter(isSupportedLanguage)
      .flatMap((language) => {
        const coverFile = coverFiles[language];

        return coverFile
          ? [
              this.uploadCoverImageToNews(
                newsId,
                coverFile,
                language,
                coverFile.originalname,
                "",
                currentUser,
              ),
            ]
          : [];
      });

    await Promise.all(coverUploads);

    const [updatedNews] = await this.db
      .select({
        id: news.id,
        title: this.localizationService.getFieldByLanguage(news.title, responseLanguage),
      })
      .from(news)
      .where(eq(news.id, newsId));

    if (!updatedNews) throw new BadRequestException("adminNewsView.toast.updateError");

    if (translations.some((translation) => translation.content !== undefined)) {
      await this.resourceLibraryService.syncNewsAssetRelations(newsId);
    }

    await this.searchIndexService.refreshNews(newsId);

    const updatedSnapshot = await this.buildNewsActivitySnapshot(newsId, responseLanguage);

    if (currentUser && !this.areNewsSnapshotsEqual(previousSnapshot, updatedSnapshot)) {
      await this.outboxPublisher.publish(
        new UpdateNewsEvent({
          newsId,
          actor: currentUser,
          previousNewsData: previousSnapshot,
          updatedNewsData: updatedSnapshot,
          language: responseLanguage,
          action: "update",
        }),
      );
    }

    return updatedNews;
  }

  private getPaginationForNews(page?: number) {
    const currentPage = Math.max(1, page ?? 1);

    if (currentPage === 1) {
      return { page: currentPage, perPage: FIRST_PAGE_SIZE, offset: 0 };
    }

    const perPage = SUBSEQUENT_PAGE_SIZE;
    const offset = FIRST_PAGE_SIZE + (currentPage - 2) * perPage;

    return { page: currentPage, perPage, offset };
  }

  async getNewsList(
    requestedLanguage: SupportedLanguages,
    page = 1,
    currentUser?: CurrentUserType,
  ) {
    await this.checkContentReadAccess(currentUser, PERMISSIONS.NEWS_READ_PUBLIC);

    const pagination = this.getPaginationForNews(page);

    const conditions = this.getVisibleNewsConditions(requestedLanguage, currentUser);
    const canUseFallback = this.canManageNews(currentUser);

    const newsList = await this.db
      .select({
        ...getTableColumns(news),
        title: canUseFallback
          ? this.localizationService.getLocalizedSqlField(news.title, requestedLanguage, news)
          : this.localizationService.getFieldByLanguage(news.title, requestedLanguage),
        content: canUseFallback
          ? this.localizationService.getLocalizedSqlField(news.content, requestedLanguage, news)
          : this.localizationService.getFieldByLanguage(news.content, requestedLanguage),
        summary: canUseFallback
          ? this.localizationService.getLocalizedSqlField(news.summary, requestedLanguage, news)
          : this.localizationService.getFieldByLanguage(news.summary, requestedLanguage),
        authorName: sql<string>`CONCAT(${users.firstName}, ' ', ${users.lastName})`,
        availableLocales: sql<SupportedLanguages[]>`${news.availableLocales}`,
        baseLanguage: sql<SupportedLanguages>`${news.baseLanguage}`,
      })
      .from(news)
      .leftJoin(users, eq(users.id, news.authorId))
      .where(and(...conditions))
      .orderBy(sql`${news.publishedAt} DESC`)
      .limit(pagination.perPage)
      .offset(pagination.offset);

    const newsListWithCoverImage = await this.mapNewsWithCoverImage(
      newsList,
      requestedLanguage,
      canUseFallback,
    );

    const [{ totalItems }] = await this.db
      .select({ totalItems: count() })
      .from(news)
      .where(and(...conditions));

    return {
      data: newsListWithCoverImage,
      pagination: {
        totalItems,
        page: pagination.page,
        perPage: pagination.perPage,
      },
    };
  }

  async getDraftNewsList(
    requestedLanguage: SupportedLanguages,
    page = 1,
    currentUser?: CurrentUserType,
  ) {
    await this.checkAccess(currentUser?.userId);

    const pagination = this.getPaginationForNews(page);

    const newsList = await this.db
      .select({
        ...getTableColumns(news),
        title: this.canManageNews(currentUser)
          ? this.localizationService.getLocalizedSqlField(news.title, requestedLanguage, news)
          : this.localizationService.getFieldByLanguage(news.title, requestedLanguage),
        content: this.canManageNews(currentUser)
          ? this.localizationService.getLocalizedSqlField(news.content, requestedLanguage, news)
          : this.localizationService.getFieldByLanguage(news.content, requestedLanguage),
        summary: this.canManageNews(currentUser)
          ? this.localizationService.getLocalizedSqlField(news.summary, requestedLanguage, news)
          : this.localizationService.getFieldByLanguage(news.summary, requestedLanguage),
        availableLocales: sql<SupportedLanguages[]>`${news.availableLocales}`,
        baseLanguage: sql<SupportedLanguages>`${news.baseLanguage}`,
        authorName: sql<string>`CONCAT(${users.firstName}, ' ', ${users.lastName})`,
      })
      .from(news)
      .leftJoin(users, eq(users.id, news.authorId))
      .where(and(...this.getDraftNewsConditions(currentUser)))
      .orderBy(sql`${news.createdAt} DESC`)
      .limit(pagination.perPage)
      .offset(pagination.offset);

    const newsListWithCoverImage = await this.mapNewsWithCoverImage(
      newsList,
      requestedLanguage,
      true,
    );

    const [{ totalItems }] = await this.db
      .select({ totalItems: count() })
      .from(news)
      .where(and(...this.getDraftNewsConditions(currentUser)));

    return {
      data: newsListWithCoverImage,
      pagination: {
        totalItems,
        page: pagination.page,
        perPage: pagination.perPage,
      },
    };
  }

  private async getNewsCoverImage(newsId: UUIDType, language: SupportedLanguages) {
    const [cover] = await this.fileService.getResourcesForEntity(
      newsId,
      ENTITY_TYPES.NEWS,
      RESOURCE_RELATIONSHIP_TYPES.COVER,
      language,
      { quality: IMAGE_QUALITY.SM, requireLanguage: true },
    );

    return cover ? this.mapResourceToNewsResource(cover) : undefined;
  }

  async deleteNewsLanguage(
    newsId: UUIDType,
    language: SupportedLanguages,
    currentUser?: CurrentUserType,
  ) {
    const existingNews = await this.validateManageableNews(newsId, currentUser, language);

    const previousSnapshot = await this.buildNewsActivitySnapshot(newsId, language);

    if (existingNews.availableLocales.length <= 1)
      throw new BadRequestException("adminNewsView.toast.minimumLanguageError");

    if (existingNews.baseLanguage === language)
      throw new BadRequestException("adminNewsView.toast.cannotRemoveBaseLanguage");

    const updatedLocales = existingNews.availableLocales.filter((locale) => locale !== language);

    const [updatedNews] = await this.db
      .update(news)
      .set({
        availableLocales: updatedLocales,
        title: deleteJsonbField(news.title, language),
        content: deleteJsonbField(news.content, language),
        summary: deleteJsonbField(news.summary, language),
      })
      .where(eq(news.id, newsId))
      .returning({
        id: news.id,
        availableLocales: news.availableLocales,
      });

    if (!updatedNews) throw new BadRequestException("adminNewsView.toast.removeLanguageError");

    await this.searchIndexService.refreshNews(newsId);

    const updatedSnapshot = await this.buildNewsActivitySnapshot(newsId, language);

    if (currentUser && !this.areNewsSnapshotsEqual(previousSnapshot, updatedSnapshot)) {
      await this.outboxPublisher.publish(
        new UpdateNewsEvent({
          newsId,
          actor: currentUser,
          previousNewsData: previousSnapshot,
          updatedNewsData: updatedSnapshot,
          language,
          action: "remove_language",
        }),
      );
    }

    return updatedNews;
  }

  async deleteNews(newsId: UUIDType, currentUser?: CurrentUserType) {
    const existingNews = await this.validateManageableNews(newsId, currentUser, undefined, false);

    if (existingNews.archived) return { id: existingNews.id };

    const [deletedNews] = await this.db
      .update(news)
      .set({
        archived: true,
        isPublic: false,
      })
      .where(eq(news.id, newsId))
      .returning({ id: news.id });

    if (!deletedNews) throw new BadRequestException("adminNewsView.toast.deleteError");

    await this.searchIndexService.deleteEntityDocuments({
      entityType: SEARCH_ENTITY_TYPES.NEWS,
      entityId: newsId,
    });

    if (currentUser) {
      await this.outboxPublisher.publish(
        new DeleteNewsEvent({
          newsId,
          actor: currentUser,
          baseLanguage: existingNews.baseLanguage,
          availableLocales: existingNews.availableLocales,
          title:
            getLocalizedText(existingNews.title, existingNews.baseLanguage, false) ?? undefined,
        }),
      );
    }

    return deletedNews;
  }

  async getNews(
    newsId: UUIDType,
    requestedLanguage: SupportedLanguages,
    currentUser?: CurrentUserType,
  ) {
    await this.checkContentReadAccess(currentUser, PERMISSIONS.NEWS_READ_PUBLIC);

    const isAdminLike = this.canManageNews(currentUser);

    const accessConditions = this.getNewsAccessConditions(requestedLanguage, currentUser, {
      requirePublished: !isAdminLike,
      allowOwnDrafts: isAdminLike,
    });
    const [existingNews] = await this.db
      .select({
        ...getTableColumns(news),
        authorName: sql<string>`CONCAT(${users.firstName}, ' ', ${users.lastName})`,
        title: isAdminLike
          ? this.localizationService.getLocalizedSqlField(news.title, requestedLanguage, news)
          : this.localizationService.getFieldByLanguage(news.title, requestedLanguage),
        content: isAdminLike
          ? this.localizationService.getLocalizedSqlField(news.content, requestedLanguage, news)
          : this.localizationService.getFieldByLanguage(news.content, requestedLanguage),
        summary: isAdminLike
          ? this.localizationService.getLocalizedSqlField(news.summary, requestedLanguage, news)
          : this.localizationService.getFieldByLanguage(news.summary, requestedLanguage),
        baseLanguage: sql<SupportedLanguages>`${news.baseLanguage}`,
        availableLocales: sql<SupportedLanguages[]>`${news.availableLocales}`,
      })
      .from(news)
      .leftJoin(users, eq(users.id, news.authorId))
      .where(and(eq(news.id, newsId), ...accessConditions));

    if (!existingNews) throw new NotFoundException("adminNewsView.toast.notFoundError");

    if (existingNews.publishedAt === null && !isAdminLike)
      throw new NotFoundException("adminNewsView.toast.notFoundError");

    const resources = await this.getNewsResources(
      newsId,
      requestedLanguage,
      isAdminLike ? existingNews.baseLanguage : undefined,
    );

    const { html: contentWithResources } = injectResourcesIntoContent(
      existingNews.content,
      resources.flatList,
      {
        resourceIdRegex: /news-resource\/([0-9a-fA-F-]{36})/,
        trackNodeTypes: ["video"],
        buildImageTag: (resource) => this.buildImageTag(resource),
      },
    );

    return {
      ...existingNews,
      content: contentWithResources ?? "",
      plainContent: existingNews.content ?? "",
      resources: resources.grouped,
      ...(await this.getAdjacentNews(
        existingNews.id,
        existingNews.publishedAt,
        requestedLanguage,
        currentUser,
      )),
    };
  }

  async getNewsResource(
    req: Request,
    res: Response,
    resourceId: UUIDType,
    currentUser?: CurrentUserType,
    preview?: FilePreviewFormat,
  ) {
    await this.checkContentReadAccess(currentUser, PERMISSIONS.NEWS_READ_PUBLIC);

    const [resource] = await this.db
      .select({
        ...getTableColumns(resources),
        entityId: resourceEntity.entityId,
        entityType: resourceEntity.entityType,
      })
      .from(resources)
      .leftJoin(
        resourceEntity,
        and(
          eq(resourceEntity.resourceId, resources.id),
          eq(resourceEntity.entityType, ENTITY_TYPES.NEWS),
        ),
      )
      .where(and(eq(resources.id, resourceId), ne(resources.archived, true)));

    if (!resource) {
      throw new NotFoundException("newsView.resourceNotFound");
    }

    const canManageAllNews = hasPermission(currentUser?.permissions, PERMISSIONS.NEWS_MANAGE);

    if (!resource.entityId || resource.entityType !== ENTITY_TYPES.NEWS) {
      if (canManageAllNews) {
        return this.streamNewsResource(req, res, resource.reference, {
          contentType: resource.contentType,
          preview,
        });
      }

      throw new NotFoundException("newsView.resourceNotFound");
    }

    const [existingNews] = await this.db
      .select({
        ...getTableColumns(news),
        authorId: news.authorId,
      })
      .from(news)
      .where(and(eq(news.id, resource.entityId), ne(news.archived, true)));

    if (!existingNews) throw new NotFoundException("News not found");

    const isAuthor =
      this.canManageOwnNews(currentUser) && existingNews.authorId === currentUser?.userId;
    const isPublic = Boolean(existingNews.isPublic && existingNews.publishedAt !== null);

    if (!canManageAllNews && !isAuthor && !isPublic) {
      throw new NotFoundException("newsView.resourceNotFound");
    }

    return this.streamNewsResource(req, res, resource.reference, {
      contentType: resource.contentType,
      preview,
    });
  }

  private async streamNewsResource(
    req: Request,
    res: Response,
    reference: string,
    options?: FilePreviewOptions,
  ) {
    const file = await this.fileService.getFileDeliveryWithPreview(reference, {
      ...options,
      range: req.headers.range,
    });

    if (file.type === FILE_DELIVERY_TYPE.REDIRECT) {
      return res.redirect(file.url);
    }

    if (!file || !file.stream) throw new Error("Error fetching file stream");

    streamFileToResponse(res, file);
  }

  private async getAdjacentNews(
    currentNewsId: UUIDType,
    referenceDate: string | null,
    language: SupportedLanguages,
    currentUser?: CurrentUserType,
  ) {
    if (!referenceDate) {
      return { nextNews: null, previousNews: null };
    }

    const adjacentNewsConditions = this.getNewsAccessConditions(language, currentUser, {
      excludedId: currentNewsId,
      requirePublished: true,
    });

    const sortColumn = news.publishedAt;

    const [nextNews] = await this.db
      .select({ id: news.id })
      .from(news)
      .where(and(...adjacentNewsConditions, gt(sortColumn, referenceDate)))
      .orderBy(sql`${sortColumn} ASC`)
      .limit(1);

    const [previousNews] = await this.db
      .select({ id: news.id })
      .from(news)
      .where(and(...adjacentNewsConditions, lt(sortColumn, referenceDate)))
      .orderBy(sql`${sortColumn} DESC`)
      .limit(1);

    return {
      nextNews: nextNews?.id ?? null,
      previousNews: previousNews?.id ?? null,
    };
  }

  async createNewsLanguage(
    newsId: UUIDType,
    createNewsBody: CreateNews,
    currentUser?: CurrentUserType,
  ) {
    const { language } = createNewsBody;

    const existingNews = await this.validateManageableNews(newsId, currentUser, language, false);

    const previousSnapshot = await this.buildNewsActivitySnapshot(newsId, language);

    if (existingNews.availableLocales.includes(language))
      throw new BadRequestException("adminNewsView.toast.languageAlreadyExists");

    const [createdLanguage] = await this.db
      .update(news)
      .set({
        availableLocales: [...existingNews.availableLocales, language],
      })
      .where(eq(news.id, newsId))
      .returning({
        id: news.id,
        title: this.localizationService.getFieldByLanguage(news.title, language),
      });

    if (!createdLanguage) throw new BadRequestException("adminNewsView.toast.createLanguageError");

    await this.searchIndexService.refreshNews(newsId);

    const updatedSnapshot = await this.buildNewsActivitySnapshot(newsId, language);

    if (currentUser && !this.areNewsSnapshotsEqual(previousSnapshot, updatedSnapshot)) {
      await this.outboxPublisher.publish(
        new UpdateNewsEvent({
          newsId,
          actor: currentUser,
          previousNewsData: previousSnapshot,
          updatedNewsData: updatedSnapshot,
          language,
          action: "add_language",
        }),
      );
    }

    return createdLanguage;
  }

  async uploadFileToNews(
    newsId: UUIDType,
    file: Express.Multer.File,
    language: SupportedLanguages,
    title: string,
    description: string,
    visibility: EditableResourceVisibility = RESOURCE_VISIBILITY.PUBLIC,
    currentUser?: CurrentUserType,
  ) {
    await this.validateManageableNews(newsId, currentUser, language);

    const fileTitle = {
      [language]: title,
    };

    const fileDescription = {
      [language]: description,
    };

    const filePath = this.getMonthlyFolderPath();

    const fileData = await this.fileService.uploadResource({
      file,
      folder: filePath,
      resource: RESOURCE_CATEGORIES.NEWS,
      title: fileTitle,
      description: fileDescription,
      currentUser,
      options: { folderIncludesResource: true, visibility },
    });

    return { resourceId: fileData.resourceId };
  }

  async uploadCoverImageToNews(
    newsId: UUIDType,
    file: Express.Multer.File,
    language: SupportedLanguages,
    title: string,
    description: string,
    currentUser?: CurrentUserType,
  ) {
    await this.checkAccess(currentUser?.userId);

    await this.validateManageableNews(newsId, currentUser, language, false);

    const existingCover = await this.fileService.getResourcesForEntity(
      newsId,
      ENTITY_TYPES.NEWS,
      RESOURCE_RELATIONSHIP_TYPES.COVER,
      language,
      { requireLanguage: true },
    );

    if (existingCover.length) {
      const coverIds = existingCover.map((cover) => cover.id);
      await this.fileService.archiveResources(coverIds);
    }

    const filePath = this.getMonthlyFolderPath("covers");

    const fileData = await this.fileService.uploadResource({
      file,
      folder: filePath,
      resource: RESOURCE_CATEGORIES.NEWS,
      entityId: newsId,
      entityType: ENTITY_TYPES.NEWS,
      relationshipType: RESOURCE_RELATIONSHIP_TYPES.COVER,
      title: { [language]: title },
      description: { [language]: description },
      currentUser,
      options: { folderIncludesResource: true },
    });

    return fileData;
  }

  private async getNewsResources(
    newsId: UUIDType,
    language: SupportedLanguages,
    coverFallbackLanguage?: SupportedLanguages,
  ) {
    const resources = await this.fileService.getResourcesForEntity(
      newsId,
      ENTITY_TYPES.NEWS,
      RESOURCE_RELATIONSHIP_TYPES.ATTACHMENT,
      language,
      { quality: IMAGE_QUALITY.MD },
    );

    const groupedResources: NewsResources = {
      images: [],
      videos: [],
      attachments: [],
      coverImage: undefined,
    };

    const flatList: NewsResource[] = [];

    resources.forEach((resource) => {
      const baseResource = this.mapResourceToNewsResource(resource);

      flatList.push(baseResource);

      match(resource.contentType ?? "")
        .when(
          (type) => type.startsWith("image/"),
          () => groupedResources.images.push(baseResource),
        )
        .when(
          (type) => type.startsWith("video/"),
          () => groupedResources.videos.push(baseResource),
        )
        .otherwise(() => groupedResources.attachments.push(baseResource));
    });

    let [cover] = await this.fileService.getResourcesForEntity(
      newsId,
      ENTITY_TYPES.NEWS,
      RESOURCE_RELATIONSHIP_TYPES.COVER,
      language,
      { quality: IMAGE_QUALITY.LG, requireLanguage: true },
    );

    if (!cover && coverFallbackLanguage && coverFallbackLanguage !== language) {
      [cover] = await this.fileService.getResourcesForEntity(
        newsId,
        ENTITY_TYPES.NEWS,
        RESOURCE_RELATIONSHIP_TYPES.COVER,
        coverFallbackLanguage,
        { quality: IMAGE_QUALITY.LG, requireLanguage: true },
      );
    }

    if (cover) groupedResources.coverImage = this.mapResourceToNewsResource(cover);

    return { grouped: groupedResources, flatList };
  }

  async generateNewsPreview(
    newsId: UUIDType,
    language: SupportedLanguages,
    content: string,
    currentUser: CurrentUserType,
  ): Promise<string> {
    await this.checkAccess(currentUser?.userId);
    await this.validateManageableNews(newsId, currentUser, language);

    const resources = await this.getNewsResources(newsId, language);

    const { html: parsedContent } = injectResourcesIntoContent(content, resources.flatList, {
      resourceIdRegex: /news-resource\/([0-9a-fA-F-]{36})/,
      trackNodeTypes: ["video"],
      buildImageTag: (resource) => this.buildImageTag(resource),
    });

    return parsedContent ?? content;
  }

  private async validateNewsExists(
    newsId: UUIDType,
    language?: SupportedLanguages,
    shouldIncludeLanguage = true,
  ) {
    const [existingNews] = await this.db
      .select({
        ...getTableColumns(news),
        baseLanguage: sql<SupportedLanguages>`${news.baseLanguage}`,
        availableLocales: sql<SupportedLanguages[]>`${news.availableLocales}`,
      })
      .from(news)
      .where(eq(news.id, newsId));

    if (!existingNews) throw new NotFoundException("adminNewsView.toast.notFoundError");

    if (!shouldIncludeLanguage || !language) return existingNews;

    if (!existingNews.availableLocales.includes(language))
      throw new BadRequestException("adminNewsView.toast.invalidLanguageError");

    return existingNews;
  }

  private getVisibleNewsConditions(
    language: SupportedLanguages,
    currentUser?: CurrentUserType,
    excludedId?: UUIDType,
  ) {
    return this.getNewsAccessConditions(language, currentUser, {
      excludedId,
      requirePublished: true,
    });
  }

  private getNewsAccessConditions(
    language: SupportedLanguages,
    currentUser?: CurrentUserType,
    options?: { allowOwnDrafts?: boolean; excludedId?: UUIDType; requirePublished?: boolean },
  ) {
    const isAdminLike = this.canManageNews(currentUser);
    const canManageAllNews = hasPermission(currentUser?.permissions, PERMISSIONS.NEWS_MANAGE);

    const conditions = [ne(news.archived, true)];

    if (options?.requirePublished) {
      conditions.push(sql`${news.publishedAt} IS NOT NULL`);
    }

    if (!isAdminLike) {
      conditions.push(sql`${language} = ANY(${news.availableLocales})`);
      if (!currentUser) conditions.push(eq(news.isPublic, true));
    }

    if (options?.allowOwnDrafts && isAdminLike && !canManageAllNews) {
      const publishedOrOwnedByCurrentUser = or(
        sql`${news.publishedAt} IS NOT NULL`,
        eq(news.authorId, currentUser!.userId),
      );

      if (publishedOrOwnedByCurrentUser) {
        conditions.push(publishedOrOwnedByCurrentUser);
      }
    }

    if (options?.excludedId) conditions.push(ne(news.id, options.excludedId));

    return conditions;
  }

  private mapResourceToNewsResource(resource: StoredNewsResource): NewsResource {
    return {
      id: resource.id,
      fileUrl: resource.fileUrl,
      contentType: resource.contentType,
      title: typeof resource.title === "string" ? resource.title : undefined,
      description: typeof resource.description === "string" ? resource.description : undefined,
      fileName: this.extractOriginalFilename(resource.metadata),
    };
  }

  private buildImageTag(resource: NewsResource) {
    return `<img src="${resource.fileUrl}" alt="${resource.title ?? ""}" />`;
  }

  private extractOriginalFilename(metadata: StoredNewsResource["metadata"]) {
    if (!metadata || typeof metadata !== "object") return undefined;

    const { originalFilename } = metadata as StoredNewsResource["metadata"] & ResourceMetadata;

    return typeof originalFilename === "string" ? originalFilename : undefined;
  }

  private getMonthlyFolderPath(suffix?: string) {
    const now = new Date();

    const segments = [
      RESOURCE_CATEGORIES.NEWS,
      now.getFullYear(),
      now.getMonth() + 1,
      suffix,
    ].filter(Boolean);

    return segments.join("/");
  }

  private async buildNewsActivitySnapshot(
    newsId: UUIDType,
    language?: SupportedLanguages,
  ): Promise<NewsActivityLogSnapshot> {
    const [baseData] = await this.db
      .select({
        baseLanguage: sql<SupportedLanguages>`${news.baseLanguage}`,
        availableLocales: sql<SupportedLanguages[]>`${news.availableLocales}`,
      })
      .from(news)
      .where(eq(news.id, newsId));

    if (!baseData) throw new NotFoundException("adminNewsView.toast.notFoundError");

    const resolvedLanguage = this.resolveSnapshotLanguage(
      language,
      baseData.baseLanguage,
      baseData.availableLocales,
    );

    const [snapshot] = await this.db
      .select({
        ...getTableColumns(news),
        title: this.localizationService.getFieldByLanguage(news.title, resolvedLanguage),
        summary: this.localizationService.getFieldByLanguage(news.summary, resolvedLanguage),
        titleTranslations: news.title,
        summaryTranslations: news.summary,
        contentTranslations: news.content,
        publishedAt: sql<string | null>`${news.publishedAt}`,
        baseLanguage: sql<string>`${news.baseLanguage}`,
      })
      .from(news)
      .where(eq(news.id, newsId));

    if (!snapshot) throw new NotFoundException("adminNewsView.toast.notFoundError");

    const {
      titleTranslations,
      summaryTranslations,
      contentTranslations,
      content: _content,
      ...snapshotData
    } = snapshot;
    const availableLocales = Array.isArray(snapshot.availableLocales)
      ? snapshot.availableLocales
      : [snapshot.availableLocales];

    return {
      ...snapshotData,
      availableLocales,
      translations: Object.fromEntries(
        availableLocales.map((locale) => [
          locale,
          {
            title: getLocalizedText(titleTranslations, locale, false) ?? undefined,
            summary: getLocalizedText(summaryTranslations, locale, false) ?? undefined,
            content: getLocalizedText(contentTranslations, locale, false) ?? undefined,
          },
        ]),
      ),
    };
  }

  private async mapNewsWithCoverImage<T extends { id: UUIDType; baseLanguage: SupportedLanguages }>(
    newsList: T[],
    requestedLanguage: SupportedLanguages,
    useBaseLanguageFallback = false,
  ): Promise<Array<T & { resources: NewsResources }>> {
    return Promise.all(
      newsList.map(async (newsItem) => {
        let coverImage = await this.getNewsCoverImage(newsItem.id, requestedLanguage);

        if (!coverImage && useBaseLanguageFallback && newsItem.baseLanguage !== requestedLanguage) {
          coverImage = await this.getNewsCoverImage(newsItem.id, newsItem.baseLanguage);
        }

        return {
          ...newsItem,
          resources: {
            images: [],
            videos: [],
            attachments: [],
            coverImage,
          },
        };
      }),
    );
  }

  private resolveSnapshotLanguage(
    requestedLanguage: SupportedLanguages | undefined,
    baseLanguage: SupportedLanguages,
    availableLocales: SupportedLanguages[] | null,
  ) {
    if (requestedLanguage && Array.isArray(availableLocales)) {
      if (availableLocales.includes(requestedLanguage)) return requestedLanguage;
    }

    return baseLanguage;
  }

  private areNewsSnapshotsEqual(
    previousSnapshot: NewsActivityLogSnapshot | null,
    updatedSnapshot: NewsActivityLogSnapshot | null,
  ) {
    return isEqual(previousSnapshot, updatedSnapshot);
  }

  private async checkAccess(currentUserId?: UUIDType) {
    const { newsEnabled, unregisteredUserNewsAccessibility } =
      await this.settingsService.getGlobalSettings();

    const hasAccess = Boolean(newsEnabled && (currentUserId || unregisteredUserNewsAccessibility));

    if (!hasAccess) {
      throw new BadRequestException({ message: "common.toast.noAccess" });
    }
  }

  private async checkContentReadAccess(
    currentUser: CurrentUserType | undefined,
    readPermission: typeof PERMISSIONS.NEWS_READ_PUBLIC,
  ) {
    const { unregisteredUserNewsAccessibility } = await this.settingsService.getGlobalSettings();
    const canManage = this.canManageNews(currentUser);
    const canReadPublic = hasPermission(currentUser?.permissions, readPermission);
    const hasAccess =
      canManage || canReadPublic || (!currentUser && unregisteredUserNewsAccessibility);

    if (!hasAccess) {
      throw new BadRequestException({ message: "common.toast.noAccess" });
    }
  }

  private canManageNews(currentUser?: CurrentUserType) {
    return hasAnyPermission(currentUser?.permissions, [
      PERMISSIONS.NEWS_MANAGE,
      PERMISSIONS.NEWS_MANAGE_OWN,
    ]);
  }

  private canManageOwnNews(currentUser?: CurrentUserType) {
    return Boolean(
      currentUser?.userId && hasPermission(currentUser.permissions, PERMISSIONS.NEWS_MANAGE_OWN),
    );
  }

  private getDraftNewsConditions(currentUser?: CurrentUserType) {
    const conditions = [ne(news.archived, true), sql`${news.publishedAt} IS NULL`];

    if (!hasPermission(currentUser?.permissions, PERMISSIONS.NEWS_MANAGE)) {
      conditions.push(eq(news.authorId, currentUser!.userId));
    }

    return conditions;
  }

  private async validateManageableNews(
    newsId: UUIDType,
    currentUser: CurrentUserType | undefined,
    language?: SupportedLanguages,
    shouldIncludeLanguage = true,
  ) {
    const existingNews = await this.validateNewsExists(newsId, language, shouldIncludeLanguage);
    const canManageAllNews = hasPermission(currentUser?.permissions, PERMISSIONS.NEWS_MANAGE);
    const canManageOwnNews = this.canManageOwnNews(currentUser);

    if (
      existingNews.archived ||
      (!canManageAllNews && (!canManageOwnNews || existingNews.authorId !== currentUser?.userId))
    ) {
      throw new NotFoundException("adminNewsView.toast.notFoundError");
    }

    return existingNews;
  }

  private mapCoverFiles(files: Express.Multer.File[]) {
    return files.reduce<Partial<Record<SupportedLanguages, Express.Multer.File>>>(
      (covers, file) => {
        if (!file.fieldname.startsWith("cover.")) return covers;
        const language = file.fieldname.slice("cover.".length);
        if (!isSupportedLanguage(language))
          throw new BadRequestException("adminNewsView.toast.invalidLanguageError");
        covers[language] = file;
        return covers;
      },
      {},
    );
  }

  private validateBatchUpdate(
    existingNews: InferSelectModel<typeof news>,
    translations: UpdateNewsTranslation[],
    coverFiles: Partial<Record<SupportedLanguages, Express.Multer.File>>,
    requestedStatus?: UpdateNews["status"],
  ) {
    const languages = new Set(translations.map((translation) => translation.language));

    if (languages.size !== translations.length)
      throw new BadRequestException("adminNewsView.toast.updateError");

    const coverLanguages = Object.keys(coverFiles).filter(isSupportedLanguage);

    for (const language of [...languages, ...coverLanguages]) {
      if (!existingNews.availableLocales.includes(language) && !languages.has(language)) {
        throw new BadRequestException("adminNewsView.toast.invalidLanguageError");
      }
    }

    const isPublished =
      requestedStatus === NEWS_STATUS.PUBLISHED ||
      (requestedStatus === undefined && existingNews.status === NEWS_STATUS.PUBLISHED);

    if (!isPublished) return;

    const titles =
      existingNews.title && typeof existingNews.title === "object"
        ? { ...(existingNews.title as Record<string, unknown>) }
        : {};

    translations.forEach((translation) => {
      if (translation.title !== undefined) titles[translation.language] = translation.title;
    });

    const finalLocales = [...new Set([...existingNews.availableLocales, ...languages])];

    const hasMissingTitle = finalLocales.some((language) => {
      const title = titles[language];
      return typeof title !== "string" || !title.trim();
    });

    if (hasMissingTitle) throw new BadRequestException("newsView.validation.titleRequired");
  }

  private buildBatchUpdateData(
    existingNews: InferSelectModel<typeof news>,
    translations: UpdateNewsTranslation[],
    sharedData: Omit<UpdateNews, "translations">,
  ) {
    const updateData: Record<string, unknown> = {};
    const localizableFields = ["title", "summary", "content"] as const;

    const localizableNewsFields = {
      title: news.title,
      summary: news.summary,
      content: news.content,
    };

    const normalizedTranslations = translations.map((translation) => {
      if (translation.content === undefined) return translation;

      return {
        ...translation,
        content: annotateVideoAutoplayAndBlockIndexesInContent(translation.content) ?? "",
      };
    });

    normalizedTranslations.forEach((translation) => {
      Object.assign(
        updateData,
        this.localizationService.updateLocalizableFields(
          localizableFields,
          { ...localizableNewsFields, ...updateData },
          translation,
          translation.language,
          true,
        ),
      );
    });

    const newLocales = translations
      .map((translation) => translation.language)
      .filter((language) => !existingNews.availableLocales.includes(language));

    if (newLocales.length) {
      updateData.availableLocales = [...existingNews.availableLocales, ...newLocales];
    }

    if (sharedData.status) {
      updateData.status = sharedData.status;
      updateData.publishedAt =
        sharedData.status === NEWS_STATUS.PUBLISHED ? new Date().toISOString() : null;
    }

    if (sharedData.isPublic !== undefined) {
      updateData.isPublic = sharedData.isPublic === true || sharedData.isPublic === "true";
    }

    return updateData;
  }
}
