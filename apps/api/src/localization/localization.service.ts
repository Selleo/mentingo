import { Inject, Injectable } from "@nestjs/common";
import { eq, sql } from "drizzle-orm";

import { DatabasePg } from "src/common";
import {
  ENTITY_TYPE,
  type EntityType,
  type EntityField,
} from "src/localization/localization.types";
import { chapters, courses, lessons } from "src/storage/schema";

import type { SupportedLanguages } from "@repo/shared";
import type { UUIDType } from "src/common";

@Injectable()
export class LocalizationService {
  constructor(@Inject("DB") private readonly db: DatabasePg) {}

  async getLanguageByEntity(entityType: EntityType, entityId: UUIDType, language?: string) {
    let query;

    switch (entityType) {
      case ENTITY_TYPE.COURSE:
        query = this.db
          .select({
            baseLanguage: courses.baseLanguage,
            availableLocales: courses.availableLocales,
          })
          .from(courses)
          .where(eq(courses.id, entityId));
        break;
      case ENTITY_TYPE.CHAPTER:
        query = this.db
          .select({
            baseLanguage: courses.baseLanguage,
            availableLocales: courses.availableLocales,
          })
          .from(chapters)
          .innerJoin(courses, eq(courses.id, chapters.courseId))
          .where(eq(chapters.id, entityId));
        break;
      case ENTITY_TYPE.LESSON:
        query = this.db
          .select({
            baseLanguage: courses.baseLanguage,
            availableLocales: courses.availableLocales,
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

    if (language && courseLocalization.availableLocales.includes(language)) {
      return { language, availableLocales: courseLocalization.availableLocales };
    }

    return {
      language: courseLocalization.baseLanguage,
      availableLocales: courseLocalization.availableLocales,
    };
  }

  /**
   * Note: callers must join `courses` so `courses.baseLanguage` and `courses.availableLocales` are available.
   */
  getLocalizedSqlField(
    entityType: EntityType,
    field: EntityField,
    language?: SupportedLanguages,
  ) {
    const columnMap: Record<EntityType, Record<EntityField, any>> = {
      [ENTITY_TYPE.COURSE]: {
        title: courses.title,
        description: courses.description,
      },
      [ENTITY_TYPE.CHAPTER]: {
        title: chapters.title,
        description: chapters.title,
      },
      [ENTITY_TYPE.LESSON]: {
        title: lessons.title,
        description: lessons.description,
      },
    };

    const fieldColumn = columnMap[entityType][field];
    const langExpr = language ? sql`${language}` : courses.baseLanguage;

    return sql<string>`
      CASE
        WHEN ${courses.availableLocales} @> ARRAY[${langExpr}]::text[]
          THEN COALESCE(
            ${fieldColumn}::jsonb ->> ${langExpr}::text,
            ${fieldColumn}::jsonb ->> ${courses.baseLanguage}::text
          )
        ELSE ${fieldColumn}::jsonb ->> ${courses.baseLanguage}::text
      END
    `;
  }
}
