import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { EventBus } from "@nestjs/cqrs";
import { load as loadHtml } from "cheerio";
import { and, count, eq, getTableColumns, gt, lt, ne, sql } from "drizzle-orm";
import { isEmpty, isEqual } from "lodash";
import { match } from "ts-pattern";

import { DatabasePg } from "src/common";
import { buildJsonbField, deleteJsonbField } from "src/common/helpers/sqlHelpers";
import { CreateNewsEvent, DeleteNewsEvent, UpdateNewsEvent } from "src/events";
import {
  ENTITY_TYPES,
  RESOURCE_RELATIONSHIP_TYPES,
  RESOURCE_CATEGORIES,
} from "src/file/file.constants";
import { FileService } from "src/file/file.service";
import { LocalizationService } from "src/localization/localization.service";
import { news, users } from "src/storage/schema";
import { USER_ROLES } from "src/user/schemas/userRoles";

import { baseNewsTitle } from "./constants";

import type { CreateNews } from "./schemas/createNews.schema";
import type { NewsResource, NewsResources } from "./schemas/selectNews.schema";
import type { UpdateNews } from "./schemas/updateNews.schema";
import type { SupportedLanguages } from "@repo/shared";
import type { InferSelectModel } from "drizzle-orm";
import type { NewsActivityLogSnapshot } from "src/activity-logs/types";
import type { UUIDType } from "src/common";
import type { CurrentUser } from "src/common/types/current-user.type";

// News uses a custom pagination: first page shows up to 7 items, following pages up to 9.
const FIRST_PAGE_SIZE = 7;
const SUBSEQUENT_PAGE_SIZE = 9;

type StoredNewsResource = Awaited<ReturnType<FileService["getResourcesForEntity"]>>[number];
type ResourceMetadata = StoredNewsResource["metadata"] & { originalFilename?: unknown };

@Injectable()
export class NewsService {
  constructor(
    @Inject("DB") private readonly db: DatabasePg,
    private readonly localizationService: LocalizationService,
    private readonly fileService: FileService,
    private readonly eventBus: EventBus,
  ) {}

  async createNews(createNewsBody: CreateNews, currentUser: CurrentUser) {
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

    this.eventBus.publish(
      new CreateNewsEvent({
        newsId: createdNews.id,
        actor: currentUser,
        createdNews: createdNewsSnapshot,
        language,
      }),
    );

    return createdNews;
  }

  async updateNews(
    newsId: UUIDType,
    updateNewsBody: UpdateNews,
    currentUser?: CurrentUser,
    coverFile?: Express.Multer.File,
  ) {
    const { language, ...updateNewsData } = updateNewsBody;

    const existingNews = await this.validateNewsExists(newsId, language);

    const previousSnapshot = await this.buildNewsActivitySnapshot(newsId, language);

    const finalUpdateData = this.buildUpdateData(existingNews, updateNewsData, language);

    if (coverFile) {
      await this.uploadCoverImageToNews(
        newsId,
        coverFile,
        language,
        coverFile.originalname,
        "",
        currentUser,
      );
    }

    const [updatedNews] = await this.db
      .update(news)
      .set({ ...(finalUpdateData ?? null) })
      .where(eq(news.id, newsId))
      .returning({
        id: news.id,
        title: this.localizationService.getFieldByLanguage(news.title, language),
      });

    if (!updatedNews) throw new BadRequestException("adminNewsView.toast.updateError");

    const updatedSnapshot = await this.buildNewsActivitySnapshot(newsId, language);

    if (currentUser && !this.areNewsSnapshotsEqual(previousSnapshot, updatedSnapshot)) {
      this.eventBus.publish(
        new UpdateNewsEvent({
          newsId,
          actor: currentUser,
          previousNewsData: previousSnapshot,
          updatedNewsData: updatedSnapshot,
          language,
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

  async getNewsList(requestedLanguage: SupportedLanguages, page = 1, currentUser?: CurrentUser) {
    const pagination = this.getPaginationForNews(page);

    const conditions = this.getVisibleNewsConditions(requestedLanguage, currentUser);

    const newsList = await this.db
      .select({
        ...getTableColumns(news),
        title: this.localizationService.getFieldByLanguage(news.title, requestedLanguage),
        content: this.localizationService.getFieldByLanguage(news.content, requestedLanguage),
        summary: this.localizationService.getFieldByLanguage(news.summary, requestedLanguage),
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

    const newsListWithCoverImage = await this.mapNewsWithCoverImage(newsList, requestedLanguage);

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

  async getDraftNewsList(requestedLanguage: SupportedLanguages, page = 1) {
    const pagination = this.getPaginationForNews(page);

    const newsList = await this.db
      .select({
        ...getTableColumns(news),
        title: this.localizationService.getFieldByLanguage(news.title, requestedLanguage),
        content: this.localizationService.getFieldByLanguage(news.content, requestedLanguage),
        summary: this.localizationService.getFieldByLanguage(news.summary, requestedLanguage),
        availableLocales: sql<SupportedLanguages[]>`${news.availableLocales}`,
        baseLanguage: sql<SupportedLanguages>`${news.baseLanguage}`,
        authorName: sql<string>`CONCAT(${users.firstName}, ' ', ${users.lastName})`,
      })
      .from(news)
      .leftJoin(users, eq(users.id, news.authorId))
      .where(and(ne(news.archived, true), sql`${news.publishedAt} IS NULL`))
      .orderBy(sql`${news.createdAt} DESC`)
      .limit(pagination.perPage)
      .offset(pagination.offset);

    const newsListWithCoverImage = await this.mapNewsWithCoverImage(newsList, requestedLanguage);

    const [{ totalItems }] = await this.db
      .select({ totalItems: count() })
      .from(news)
      .where(and(ne(news.archived, true), sql`${news.publishedAt} IS NULL`));

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
    );

    return cover ? this.mapResourceToNewsResource(cover) : undefined;
  }

  async deleteNewsLanguage(
    newsId: UUIDType,
    language: SupportedLanguages,
    currentUser?: CurrentUser,
  ) {
    const existingNews = await this.validateNewsExists(newsId, language);

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

    const updatedSnapshot = await this.buildNewsActivitySnapshot(newsId, language);

    if (currentUser && !this.areNewsSnapshotsEqual(previousSnapshot, updatedSnapshot)) {
      this.eventBus.publish(
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

  async deleteNews(newsId: UUIDType, currentUser?: CurrentUser) {
    const existingNews = await this.validateNewsExists(newsId, undefined, false);

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

    if (currentUser) {
      this.eventBus.publish(
        new DeleteNewsEvent({
          newsId,
          actor: currentUser,
          baseLanguage: existingNews.baseLanguage,
          availableLocales: existingNews.availableLocales,
          title: this.extractTitleByLanguage(existingNews.title, existingNews.baseLanguage),
        }),
      );
    }

    return deletedNews;
  }

  async getNews(
    newsId: UUIDType,
    requestedLanguage: SupportedLanguages,
    currentUser?: CurrentUser,
  ) {
    const isAdminLike =
      currentUser?.role === USER_ROLES.ADMIN || currentUser?.role === USER_ROLES.CONTENT_CREATOR;

    const accessConditions = this.getNewsAccessConditions(requestedLanguage, currentUser, {
      requirePublished: !isAdminLike,
    });

    const [existingNews] = await this.db
      .select({
        ...getTableColumns(news),
        authorName: sql<string>`CONCAT(${users.firstName}, ' ', ${users.lastName})`,
        title: this.localizationService.getFieldByLanguage(news.title, requestedLanguage),
        content: this.localizationService.getFieldByLanguage(news.content, requestedLanguage),
        summary: this.localizationService.getFieldByLanguage(news.summary, requestedLanguage),
        baseLanguage: sql<SupportedLanguages>`${news.baseLanguage}`,
        availableLocales: sql<SupportedLanguages[]>`${news.availableLocales}`,
      })
      .from(news)
      .leftJoin(users, eq(users.id, news.authorId))
      .where(and(eq(news.id, newsId), ...accessConditions));

    if (!existingNews) throw new NotFoundException("adminNewsView.toast.notFoundError");

    if (existingNews.publishedAt === null && !isAdminLike)
      throw new NotFoundException("adminNewsView.toast.notFoundError");

    const resources = await this.getNewsResources(newsId, requestedLanguage);

    const contentWithResources = this.injectResourcesIntoContent(
      existingNews.content,
      resources.flatList,
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

  private async getAdjacentNews(
    currentNewsId: UUIDType,
    referenceDate: string | null,
    language: SupportedLanguages,
    currentUser?: CurrentUser,
  ) {
    if (!referenceDate) {
      return { nextNews: null, previousNews: null };
    }

    const adjacentNewsConditions = this.getNewsAccessConditions(language, currentUser, {
      excludedId: currentNewsId,
      requirePublished: false,
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
    currentUser?: CurrentUser,
  ) {
    const { language } = createNewsBody;

    const existingNews = await this.validateNewsExists(newsId, language, false);

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

    const updatedSnapshot = await this.buildNewsActivitySnapshot(newsId, language);

    if (currentUser && !this.areNewsSnapshotsEqual(previousSnapshot, updatedSnapshot)) {
      this.eventBus.publish(
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
    currentUser?: CurrentUser,
  ) {
    const fileTitle = {
      [language]: title,
    };

    const fileDescription = {
      [language]: description,
    };

    const filePath = this.getMonthlyFolderPath();

    const fileData = await this.fileService.uploadResource(
      file,
      filePath,
      RESOURCE_CATEGORIES.NEWS,
      newsId,
      ENTITY_TYPES.NEWS,
      RESOURCE_RELATIONSHIP_TYPES.ATTACHMENT,
      fileTitle,
      fileDescription,
      currentUser,
      { folderIncludesResource: true },
    );

    return { resourceId: fileData.resourceId };
  }

  async uploadCoverImageToNews(
    newsId: UUIDType,
    file: Express.Multer.File,
    language: SupportedLanguages,
    title: string,
    description: string,
    currentUser?: CurrentUser,
  ) {
    if (!file || !file.mimetype.startsWith("image/"))
      throw new BadRequestException("adminNewsView.toast.invalidCoverType");

    await this.validateNewsExists(newsId, language, false);

    const existingCover = await this.fileService.getResourcesForEntity(
      newsId,
      ENTITY_TYPES.NEWS,
      RESOURCE_RELATIONSHIP_TYPES.COVER,
      language,
    );

    if (existingCover.length) {
      const coverIds = existingCover.map((cover) => cover.id);
      await this.fileService.archiveResources(coverIds);
    }

    const filePath = this.getMonthlyFolderPath("covers");

    const fileData = await this.fileService.uploadResource(
      file,
      filePath,
      RESOURCE_CATEGORIES.NEWS,
      newsId,
      ENTITY_TYPES.NEWS,
      RESOURCE_RELATIONSHIP_TYPES.COVER,
      { [language]: title },
      { [language]: description },
      currentUser,
      { folderIncludesResource: true },
    );

    return fileData;
  }

  private async getNewsResources(newsId: UUIDType, language: SupportedLanguages) {
    const resources = await this.fileService.getResourcesForEntity(
      newsId,
      ENTITY_TYPES.NEWS,
      RESOURCE_RELATIONSHIP_TYPES.ATTACHMENT,
      language,
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

    const [cover] = await this.fileService.getResourcesForEntity(
      newsId,
      ENTITY_TYPES.NEWS,
      RESOURCE_RELATIONSHIP_TYPES.COVER,
      language,
    );

    if (cover) groupedResources.coverImage = this.mapResourceToNewsResource(cover);

    return { grouped: groupedResources, flatList };
  }

  async generateNewsPreview(
    newsId: UUIDType,
    language: SupportedLanguages,
    content: string,
  ): Promise<string> {
    await this.validateNewsExists(newsId, language);

    const resources = await this.getNewsResources(newsId, language);

    return this.injectResourcesIntoContent(content, resources.flatList) ?? content;
  }

  private injectResourcesIntoContent(content: string | null, resources: NewsResource[]) {
    if (!content) return content;
    if (!resources.length) return content;

    const $ = loadHtml(content);
    const resourceMap = new Map(resources.map((resource) => [resource.id, resource]));

    $("a").each((_, element) => {
      const anchor = $(element);
      const href = anchor.text() ?? "";
      const hrefResourceId = this.extractResourceIdFromHref(href);

      const matchingResource = hrefResourceId ? resourceMap.get(hrefResourceId) : undefined;

      if (!matchingResource) return;

      const parent = anchor.parent();

      match(matchingResource.contentType ?? "")
        .when(
          (type) => type.startsWith("image/"),
          () => {
            const imgTag = this.buildImageTag(matchingResource);
            if (parent.is("p")) {
              anchor.remove();
              parent.after(imgTag);
            } else {
              anchor.replaceWith(imgTag);
            }
          },
        )
        .when(
          (type) => type.startsWith("video/"),
          () => {
            const iframe = this.buildVideoTag(matchingResource);
            if (parent.is("p")) {
              anchor.remove();
              parent.after(iframe);
            } else {
              anchor.replaceWith(iframe);
            }
          },
        )
        .otherwise(() => {
          anchor.attr("href", matchingResource.fileUrl);
          anchor.attr("download", matchingResource.fileName ?? "");
          anchor.attr("target", "_blank");
          anchor.attr("rel", "noopener noreferrer");
          anchor.text(matchingResource.title ?? matchingResource.fileName ?? "Download File");
        });
    });

    const bodyChildren = $("body").children();
    return $.html(bodyChildren.length ? bodyChildren : $.root().children());
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

  private buildUpdateData(
    existingNews: InferSelectModel<typeof news>,
    updateNewsData: Partial<Omit<UpdateNews, "language">>,
    language: SupportedLanguages,
  ): Record<string, unknown> {
    const localizableFields = ["title", "content", "summary"] as const;
    const directFields: Array<keyof Omit<UpdateNews, "language">> = ["status", "isPublic"];

    const updateData: Record<string, unknown> = {
      ...this.localizationService.updateLocalizableFields(
        localizableFields,
        existingNews,
        updateNewsData,
        language,
      ),
    };

    directFields.map((field) => {
      if (field in updateNewsData && updateNewsData[field] !== undefined)
        updateData[field] = updateNewsData[field];

      if (field === "status" && !isEmpty(updateData[field])) {
        if (updateData[field] === "published") updateData["publishedAt"] = new Date().toISOString();
        if (updateData[field] === "draft") updateData["publishedAt"] = null;
      }

      if (updateNewsData[field] === "true" || updateNewsData[field] === "false") {
        updateData[field] = updateNewsData[field] === "true" ? true : false;
      }
    });

    return updateData;
  }

  private getVisibleNewsConditions(
    language: SupportedLanguages,
    currentUser?: CurrentUser,
    excludedId?: UUIDType,
  ) {
    return this.getNewsAccessConditions(language, currentUser, {
      excludedId,
      requirePublished: true,
    });
  }

  private getNewsAccessConditions(
    language: SupportedLanguages,
    currentUser?: CurrentUser,
    options?: { excludedId?: UUIDType; requirePublished?: boolean },
  ) {
    const isAdminLike =
      currentUser?.role === USER_ROLES.ADMIN || currentUser?.role === USER_ROLES.CONTENT_CREATOR;

    const conditions = [ne(news.archived, true)];

    if (options?.requirePublished) {
      conditions.push(sql`${news.publishedAt} IS NOT NULL`);
    }

    if (!isAdminLike) {
      conditions.push(sql`${language} = ANY(${news.availableLocales})`);
      if (!currentUser) conditions.push(eq(news.isPublic, true));
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

  private buildVideoTag(resource: NewsResource) {
    return `<iframe controls src="${resource.fileUrl}" title="${resource.title ?? ""}"></iframe>`;
  }

  private extractResourceIdFromHref(href: string): UUIDType | undefined {
    if (!href) return undefined;

    const uuidMatch = href.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);

    return uuidMatch ? (uuidMatch[0] as UUIDType) : undefined;
  }

  private extractOriginalFilename(metadata: StoredNewsResource["metadata"]) {
    if (!metadata || typeof metadata !== "object") return undefined;

    const { originalFilename } = metadata as ResourceMetadata;

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
        publishedAt: sql<string | null>`${news.publishedAt}`,
        baseLanguage: sql<string>`${news.baseLanguage}`,
      })
      .from(news)
      .where(eq(news.id, newsId));

    if (!snapshot) throw new NotFoundException("adminNewsView.toast.notFoundError");

    return {
      ...snapshot,
      availableLocales: Array.isArray(snapshot.availableLocales)
        ? snapshot.availableLocales
        : [snapshot.availableLocales],
    };
  }

  private async mapNewsWithCoverImage<T extends { id: UUIDType }>(
    newsList: T[],
    requestedLanguage: SupportedLanguages,
  ): Promise<Array<T & { resources: NewsResources }>> {
    return Promise.all(
      newsList.map(async (newsItem) => {
        const coverImage = await this.getNewsCoverImage(newsItem.id, requestedLanguage);

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

  private extractTitleByLanguage(titleField: unknown, language: SupportedLanguages) {
    if (!titleField || typeof titleField !== "object") return undefined;

    const titleMap = titleField as Record<string, unknown>;
    const title = titleMap[language];

    return typeof title === "string" ? title : undefined;
  }
}
