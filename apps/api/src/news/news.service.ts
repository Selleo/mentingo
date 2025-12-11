import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { eq } from "drizzle-orm";

import { DatabasePg } from "src/common";
import { buildJsonbField } from "src/common/helpers/sqlHelpers";
import { LocalizationService } from "src/localization/localization.service";
import { news } from "src/storage/schema";

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

  async createNewsLanguage(newsId: UUIDType, createNewsBody: CreateNews) {
    const { language } = createNewsBody;

    const existingNews = await this.validateNewsExists(newsId, language, false);

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
      if (updateNewsData[field]) updateData[field] = updateNewsData[field];
    });

    return updateData;
  }
}
