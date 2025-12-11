import { Inject, Injectable } from "@nestjs/common";
import { eq, getTableColumns, sql } from "drizzle-orm";

import { DatabasePg } from "src/common";
import { buildJsonbField, deleteJsonbField, setJsonbField } from "src/common/helpers/sqlHelpers";
import { LocalizationService } from "src/localization/localization.service";
import { questionsAndAnswers } from "src/storage/schema";
import { settingsToJSONBuildObject } from "src/utils/settings-to-json-build-object";

import type { SupportedLanguages } from "@repo/shared";
import type { UUIDType } from "src/common";
import type { CreateQABody, QAUpdateBody } from "src/qa/schemas/qa.schema";

@Injectable()
export class QARepository {
  constructor(
    @Inject("DB") private readonly db: DatabasePg,
    private readonly localizationService: LocalizationService,
  ) {}

  private updatedReturning(language: SupportedLanguages) {
    return {
      ...getTableColumns(questionsAndAnswers),
      title: this.localizationService.getFieldByLanguage(questionsAndAnswers.title, language),
      description: this.localizationService.getFieldByLanguage(
        questionsAndAnswers.description,
        language,
      ),
    };
  }

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
      .returning(this.updatedReturning(data.language));
  }

  async getQA(qaId: UUIDType, language: SupportedLanguages) {
    const [qa] = await this.db
      .select({
        ...getTableColumns(questionsAndAnswers),
        title: this.localizationService.getFieldByLanguage(questionsAndAnswers.title, language),
        description: this.localizationService.getFieldByLanguage(
          questionsAndAnswers.description,
          language,
        ),
        baseLanguage: sql<SupportedLanguages>`${questionsAndAnswers.baseLanguage}`,
        availableLocales: sql<SupportedLanguages[]>`${questionsAndAnswers.availableLocales}`,
      })
      .from(questionsAndAnswers)
      .where(eq(questionsAndAnswers.id, qaId));

    return qa;
  }

  async getAllQA(language?: SupportedLanguages) {
    return this.db
      .select({
        ...getTableColumns(questionsAndAnswers),
        title: this.localizationService.getLocalizedSqlField(
          questionsAndAnswers.title,
          language,
          questionsAndAnswers,
        ),
        description: this.localizationService.getLocalizedSqlField(
          questionsAndAnswers.description,
          language,
          questionsAndAnswers,
        ),
        baseLanguage: sql<SupportedLanguages>`${questionsAndAnswers.baseLanguage}`,
        availableLocales: sql<SupportedLanguages[]>`${questionsAndAnswers.availableLocales}`,
      })
      .from(questionsAndAnswers);
  }

  async createLanguage(qaId: UUIDType, languages: string[], language: SupportedLanguages) {
    return this.db
      .update(questionsAndAnswers)
      .set({ availableLocales: languages })
      .where(eq(questionsAndAnswers.id, qaId))
      .returning(this.updatedReturning(language));
  }

  async updateQA(data: QAUpdateBody, language: SupportedLanguages, qaId: UUIDType) {
    return this.db
      .update(questionsAndAnswers)
      .set({
        ...(data.title
          ? { title: setJsonbField(questionsAndAnswers.title, language, data.title) }
          : {}),
        ...(data.description
          ? {
              description: setJsonbField(
                questionsAndAnswers.description,
                language,
                data.description,
              ),
            }
          : {}),
      })
      .where(eq(questionsAndAnswers.id, qaId))
      .returning(this.updatedReturning(language));
  }

  async deleteQA(qaId: UUIDType) {
    return this.db.delete(questionsAndAnswers).where(eq(questionsAndAnswers.id, qaId));
  }

  async deleteLanguage(qaId: UUIDType, language: SupportedLanguages) {
    return this.db
      .update(questionsAndAnswers)
      .set({
        title: deleteJsonbField(questionsAndAnswers.title, language),
        description: deleteJsonbField(questionsAndAnswers.description, language),
        availableLocales: sql`ARRAY_REMOVE(${questionsAndAnswers.availableLocales}, ${language})`,
      })
      .where(eq(questionsAndAnswers.id, qaId))
      .returning(this.updatedReturning(language));
  }
}
