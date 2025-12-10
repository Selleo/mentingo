import { Inject, Injectable } from "@nestjs/common";
import { getTableColumns } from "drizzle-orm";

import { DatabasePg } from "src/common";
import { buildJsonbField } from "src/common/helpers/sqlHelpers";
import { LocalizationService } from "src/localization/localization.service";
import { questionsAndAnswers } from "src/storage/schema";
import { settingsToJSONBuildObject } from "src/utils/settings-to-json-build-object";

import type { SupportedLanguages } from "@repo/shared";
import type { UUIDType } from "src/common";
import type { CreateQABody } from "src/qa/schemas/qa.schema";

@Injectable()
export class QARepository {
  constructor(
    @Inject("DB") private readonly db: DatabasePg,
    private readonly localizationService: LocalizationService,
  ) {}

  async createQA(data: CreateQABody, metadata: object) {
    return this.db
      .insert(questionsAndAnswers)
      .values({
        title: buildJsonbField(data.language, data.title),
        description: buildJsonbField(data.language, data.description),
        baseLanguage: data.language,
        availableLocales: [data.language],
        metadata: settingsToJSONBuildObject(metadata),
      })
      .returning({
        ...getTableColumns(questionsAndAnswers),
        title: this.localizationService.getFieldByLanguage(
          questionsAndAnswers.title,
          data.language,
        ),
        description: this.localizationService.getFieldByLanguage(
          questionsAndAnswers.description,
          data.language,
        ),
      });
  }

  async getQA(qaId: UUIDType, language?: SupportedLanguages) {
    return this.db.select({
      ...getTableColumns(questionsAndAnswers),
      title: this.localizationService.getLocalizedSqlField(questionsAndAnswers.title, language, {
        baseTable: questionsAndAnswers,
      }),
      description: this.localizationService.getLocalizedSqlField(
        questionsAndAnswers.description,
        language,
        { baseTable: questionsAndAnswers },
      ),
    });
  }
}
