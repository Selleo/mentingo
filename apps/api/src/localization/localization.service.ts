import { Inject, Injectable } from "@nestjs/common";
import { eq, sql } from "drizzle-orm";
import { alias, type AnyPgColumn } from "drizzle-orm/pg-core";

import { DatabasePg } from "src/common";
import { setJsonbField } from "src/common/helpers/sqlHelpers";
import { chapters, courses, lessons } from "src/storage/schema";

import { ENTITY_TYPE } from "./localization.types";

import type { BaseTable, EntityType } from "./localization.types";
import type { SupportedLanguages } from "@repo/shared";
import type { UUIDType } from "src/common";

@Injectable()
export class LocalizationService {
  constructor(@Inject("DB") private readonly db: DatabasePg) {}
  async getBaseLanguage(entityType: EntityType, entityId: UUIDType, language?: SupportedLanguages) {
    let query;

    switch (entityType) {
      case ENTITY_TYPE.COURSE:
        query = this.db
          .select({
            baseLanguage: sql<SupportedLanguages>`${courses.baseLanguage}`,
            availableLocales: sql<SupportedLanguages>`${courses.availableLocales}`,
          })
          .from(courses)
          .where(eq(courses.id, entityId));
        break;
      case ENTITY_TYPE.CHAPTER:
        query = this.db
          .select({
            baseLanguage: sql<SupportedLanguages>`${courses.baseLanguage}`,
            availableLocales: sql<SupportedLanguages>`${courses.availableLocales}`,
          })
          .from(chapters)
          .innerJoin(courses, eq(courses.id, chapters.courseId))
          .where(eq(chapters.id, entityId));
        break;
      case ENTITY_TYPE.LESSON:
        query = this.db
          .select({
            baseLanguage: sql<SupportedLanguages>`${courses.baseLanguage}`,
            availableLocales: sql<SupportedLanguages>`${courses.availableLocales}`,
          })
          .from(lessons)
          .innerJoin(chapters, eq(lessons.chapterId, chapters.id))
          .innerJoin(courses, eq(courses.id, chapters.courseId))
          .where(eq(lessons.id, entityId));
        break;
      default:
        throw new Error("Invalid entity type");
    }

    const [courseLocalization] = await query;

    const newLanguage =
      language && courseLocalization.availableLocales.includes(language)
        ? language
        : courseLocalization.baseLanguage;

    return {
      baseLanguage: courseLocalization.baseLanguage,
      language: newLanguage,
      availableLocales: courseLocalization.availableLocales,
    };
  }

  /**
   * Note: callers must join `baseTable` so `baseTable.baseLanguage` and `baseTable.availableLocales` are available.
   */
  getLocalizedSqlField(
    fieldColumn: AnyPgColumn,
    language?: SupportedLanguages,
    baseTable: BaseTable = courses,
    joinedAliasName?: string,
  ) {
    const aliased = joinedAliasName ? alias(baseTable, joinedAliasName) : baseTable;

    const langExpr = language ? sql`${language}` : aliased.baseLanguage;

    return sql<string>`
      COALESCE(
        CASE
          WHEN ${aliased.availableLocales} @> ARRAY[${langExpr}]::text[]
            THEN COALESCE(
              ${fieldColumn}::jsonb ->> ${langExpr}::text,
              ${fieldColumn}::jsonb ->> ${aliased.baseLanguage}::text
            )
          ELSE ${fieldColumn}::jsonb ->> ${aliased.baseLanguage}::text
        END,
        ''
      )
    `;
  }

  getFieldByLanguage(fieldColumn: AnyPgColumn, language: SupportedLanguages) {
    return sql<string>`
        COALESCE(
            ${fieldColumn}->>${language}::text,
            ''
        )
    `;
  }

  /**
   * Updates localizable fields in an entity by setting JSONB field values for the specified language
   * @param localizableFields Array of field names that should be localized
   * @param existingEntity The current entity data containing existing field values
   * @param updateData The data containing new values to update
   * @param language The language to update the fields for
   * @returns Object with updated localizable fields
   */
  updateLocalizableFields<
    TEntity extends Record<string, any>,
    TUpdateData extends Record<string, any>,
    TField extends keyof TUpdateData & keyof TEntity,
  >(
    localizableFields: readonly TField[],
    existingEntity: TEntity,
    updateData: TUpdateData,
    language: string,
  ): Partial<Record<TField, unknown>> {
    const result: Partial<Record<TField, unknown>> = {};

    localizableFields.forEach((field) => {
      if (updateData[field])
        result[field] = setJsonbField(existingEntity[field], language, updateData[field]);
    });

    return result;
  }
}
