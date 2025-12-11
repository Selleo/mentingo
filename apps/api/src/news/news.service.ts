import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { and, count, eq, getTableColumns, ne, sql } from "drizzle-orm";

import { DatabasePg } from "src/common";
import { buildJsonbField } from "src/common/helpers/sqlHelpers";
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

  async updateNews(newsId: UUIDType, updateNewsBody: UpdateNews) {
    const { language, ...updateNewsData } = updateNewsBody;

    const existingNews = await this.validateNewsExists(newsId, language);

    const finalUpdateData = this.buildUpdateData(existingNews, updateNewsData, language);

    const [updatedNews] = await this.db
      .update(news)
      .set(finalUpdateData)
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

    return existingNews;
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

    return fileData;
  }

  private async validateNewsExists(
    newsId: UUIDType,
    language: SupportedLanguages,
    shouldIncludeLanguage = true,
  ) {
    const [existingNews] = await this.db.select().from(news).where(eq(news.id, newsId));

    if (!existingNews) throw new NotFoundException("adminNewsView.toast.notFoundError");

    if (!shouldIncludeLanguage) return existingNews;

    if (!existingNews.availableLocales.includes(language))
      throw new BadRequestException("adminNewsView.toast.invalidLanguageError");

    return existingNews;
  }

  private buildUpdateData(
    existingNews: InferSelectModel<typeof news>,
    updateNewsData: Omit<UpdateNews, "language">,
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
}
