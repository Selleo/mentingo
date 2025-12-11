import { BadRequestException, Inject, Injectable } from "@nestjs/common";

import { DatabasePg } from "src/common";
import { buildJsonbField } from "src/common/helpers/sqlHelpers";
import { LocalizationService } from "src/localization/localization.service";
import { news } from "src/storage/schema";

import { baseNewsTitle } from "./constants";

import type { CreateNews } from "./schemas/createNews.schema";
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
}
