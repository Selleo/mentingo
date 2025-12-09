import { Inject, Injectable } from "@nestjs/common";
import { eq, sql } from "drizzle-orm";
import { alias, type AnyPgColumn } from "drizzle-orm/pg-core";

import { DatabasePg } from "src/common";
import { chapters, courses, lessons } from "src/storage/schema";

import { ENTITY_TYPE } from "./localization.types";

import type { EntityType } from "./localization.types";
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
   * Note: callers must join `courses` so `courses.baseLanguage` and `courses.availableLocales` are available.
   */
  getLocalizedSqlField(
    fieldColumn: AnyPgColumn,
    language?: SupportedLanguages,
    aliasName: string = "courses",
  ) {
    const aliased = alias(courses, aliasName);

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
}
