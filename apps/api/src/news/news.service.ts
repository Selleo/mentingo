import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { load as loadHtml } from "cheerio";
import { and, count, eq, getTableColumns, ne, sql } from "drizzle-orm";
import { match } from "ts-pattern";

import { DatabasePg } from "src/common";
import { buildJsonbField, deleteJsonbField } from "src/common/helpers/sqlHelpers";
import { DEFAULT_PAGE_SIZE } from "src/common/pagination";
import {
  ENTITY_TYPES,
  RESOURCE_RELATIONSHIP_TYPES,
  RESOURCE_CATEGORIES,
} from "src/file/file.constants";
import { FileService } from "src/file/file.service";
import { LocalizationService } from "src/localization/localization.service";
import { news, users } from "src/storage/schema";

import { baseNewsTitle } from "./constants";

import type { CreateNews } from "./schemas/createNews.schema";
import type { NewsResource, NewsResources } from "./schemas/selectNews.schema";
import type { UpdateNews } from "./schemas/updateNews.schema";
import type { SupportedLanguages } from "@repo/shared";
import type { InferSelectModel } from "drizzle-orm";
import type { UUIDType } from "src/common";
import type { CurrentUser } from "src/common/types/current-user.type";

@Injectable()
export class NewsService {
  constructor(
    @Inject("DB") private readonly db: DatabasePg,
    private readonly localizationService: LocalizationService,
    private readonly fileService: FileService,
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

    const sanitizedUpdateData = this.sanitizeUpdatePayload(updateNewsData);

    const finalUpdateData = this.buildUpdateData(existingNews, sanitizedUpdateData, language);

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
      .set({ ...finalUpdateData, updatedBy: currentUser?.userId ?? null })
      .where(eq(news.id, newsId))
      .returning({
        id: news.id,
        title: this.localizationService.getFieldByLanguage(news.title, language),
      });

    if (!updatedNews) throw new BadRequestException("adminNewsView.toast.updateError");

    return updatedNews;
  }

  async getNewsList(requestedLanguage: SupportedLanguages, page = 1, perPage = DEFAULT_PAGE_SIZE) {
    const conditions = [
      ne(news.archived, true),
      eq(news.isPublic, true),
      sql`${requestedLanguage} = ANY(${news.availableLocales})`,
    ];

    const newsList = await this.db
      .select({
        ...getTableColumns(news),
        title: this.localizationService.getFieldByLanguage(news.title, requestedLanguage),
        content: this.localizationService.getFieldByLanguage(news.content, requestedLanguage),
        summary: this.localizationService.getFieldByLanguage(news.summary, requestedLanguage),
        authorName: sql<string>`CONCAT(${users.firstName}, ' ', ${users.lastName})`,
      })
      .from(news)
      .leftJoin(users, eq(users.id, news.authorId))
      .where(and(...conditions))
      .orderBy(sql`${news.publishedAt} DESC`)
      .limit(perPage)
      .offset((page - 1) * perPage);

    const [{ totalItems }] = await this.db
      .select({ totalItems: count() })
      .from(news)
      .where(and(...conditions));

    return {
      data: newsList,
      pagination: {
        totalItems,
        page,
        perPage,
      },
    };
  }

  async deleteNewsLanguage(newsId: UUIDType, language: SupportedLanguages) {
    const existingNews = await this.validateNewsExists(newsId, language);

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
        updatedBy: currentUser?.userId ?? null,
      })
      .where(eq(news.id, newsId))
      .returning({ id: news.id });

    if (!deletedNews) throw new BadRequestException("adminNewsView.toast.deleteError");

    return deletedNews;
  }

  async getNews(newsId: UUIDType, requestedLanguage: SupportedLanguages) {
    const [existingNews] = await this.db
      .select({
        ...getTableColumns(news),
        authorName: users.firstName,
        title: this.localizationService.getFieldByLanguage(news.title, requestedLanguage),
        content: this.localizationService.getFieldByLanguage(news.content, requestedLanguage),
        summary: this.localizationService.getFieldByLanguage(news.summary, requestedLanguage),
        baseLanguage: sql<SupportedLanguages>`${news.baseLanguage}`,
      })
      .from(news)
      .leftJoin(users, eq(users.id, news.authorId))
      .where(eq(news.id, newsId));

    if (!existingNews) throw new NotFoundException("adminNewsView.toast.notFoundError");

    const resources = await this.getNewsResources(newsId, requestedLanguage);
    const contentWithResources = this.injectResourcesIntoContent(
      existingNews.content,
      resources.flatList,
    );

    return {
      ...existingNews,
      content: contentWithResources,
      resources: resources.grouped,
    };
  }

  async createNewsLanguage(newsId: UUIDType, createNewsBody: CreateNews) {
    const { language } = createNewsBody;

    const existingNews = await this.validateNewsExists(newsId, language, false);

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

    const dateNow = new Date();
    const filePath = `${dateNow.getFullYear()}/${dateNow.getMonth() + 1}`;

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
    );

    return fileData.resourceId;
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

    const dateNow = new Date();
    const filePath = `${dateNow.getFullYear()}/${dateNow.getMonth() + 1}/covers`;

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
      const metadata =
        (resource as { metadata?: Record<string, unknown> }).metadata ??
        ({} as Record<string, unknown>);
      const fileUrl = resource.fileUrl;
      const baseResource: NewsResource = {
        id: resource.id,
        fileUrl,
        downloadUrl: fileUrl,
        contentType: resource.contentType,
        title: typeof resource.title === "string" ? resource.title : undefined,
        description: typeof resource.description === "string" ? resource.description : undefined,
        fileName:
          typeof metadata === "object" && metadata && "originalFilename" in metadata
            ? ((metadata as { originalFilename?: string }).originalFilename ?? undefined)
            : undefined,
      };

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

    if (cover) {
      groupedResources.coverImage = {
        id: cover.id,
        fileUrl: cover.fileUrl,
        downloadUrl: cover.fileUrl,
        contentType: cover.contentType,
        title: typeof cover.title === "string" ? cover.title : undefined,
        description: typeof cover.description === "string" ? cover.description : undefined,
        fileName:
          typeof cover.metadata === "object" &&
          cover.metadata &&
          "originalFilename" in cover.metadata &&
          typeof cover.metadata.originalFilename === "string"
            ? cover.metadata.originalFilename
            : undefined,
      };
    }

    return { grouped: groupedResources, flatList };
  }

  private injectResourcesIntoContent(content: string | null, resources: NewsResource[]) {
    if (!content) return content;
    if (!resources.length) return content;

    const $ = loadHtml(content);
    const resourceMap = new Map(resources.map((resource) => [resource.id, resource]));

    $("a").each((_, element) => {
      const anchor = $(element);
      const href = anchor.attr("href") || "";
      const dataResourceId = anchor.attr("data-resource-id");

      const matchingResource =
        (dataResourceId && resourceMap.get(dataResourceId as UUIDType)) ||
        resources.find((resource) => href.includes(String(resource.id)));

      if (!matchingResource) return;

      const parent = anchor.parent();

      match(matchingResource.contentType ?? "")
        .when(
          (type) => type.startsWith("image/"),
          () => {
            const imgTag = `<img src="${matchingResource.fileUrl}" alt="${
              matchingResource.title ?? ""
            }" />`;
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
            const iframe = `<iframe controls src="${matchingResource.fileUrl}" title="${
              matchingResource.title ?? ""
            }"></iframe>`;
            if (parent.is("p")) {
              anchor.remove();
              parent.after(iframe);
            } else {
              anchor.replaceWith(iframe);
            }
          },
        )
        .otherwise(() => {
          anchor.attr("href", matchingResource.downloadUrl);
          anchor.attr("download", matchingResource.fileName ?? "");
          anchor.attr("target", "_blank");
          anchor.attr("rel", "noopener noreferrer");
          anchor.text(matchingResource.title || matchingResource.fileName || anchor.text());
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
    const [existingNews] = await this.db.select().from(news).where(eq(news.id, newsId));

    if (!existingNews) throw new NotFoundException("adminNewsView.toast.notFoundError");

    if (!shouldIncludeLanguage || !language) return existingNews;

    if (!existingNews.availableLocales.includes(language))
      throw new BadRequestException("adminNewsView.toast.invalidLanguageError");

    return existingNews;
  }

  private buildUpdateData(
    existingNews: InferSelectModel<typeof news>,
    updateNewsData: Partial<Omit<UpdateNews, "language">>,
    language: string,
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

    directFields.forEach((field) => {
      if (field in updateNewsData && updateNewsData[field] !== undefined)
        updateData[field] = updateNewsData[field];
    });

    return updateData;
  }

  private sanitizeUpdatePayload(updateNewsData: Omit<UpdateNews, "language">) {
    const payload: Partial<Omit<UpdateNews, "language">> = {};

    if (typeof updateNewsData.title === "string" && updateNewsData.title.trim())
      payload.title = updateNewsData.title.trim();
    if (typeof updateNewsData.summary === "string") payload.summary = updateNewsData.summary;
    if (typeof updateNewsData.content === "string") payload.content = updateNewsData.content;
    if (updateNewsData.status === "draft" || updateNewsData.status === "published")
      payload.status = updateNewsData.status;
    if (typeof updateNewsData.isPublic === "boolean") payload.isPublic = updateNewsData.isPublic;

    return payload;
  }
}
