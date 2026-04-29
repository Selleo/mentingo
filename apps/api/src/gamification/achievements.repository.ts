import { Inject, Injectable } from "@nestjs/common";
import { SUPPORTED_LANGUAGES, type SupportedLanguages } from "@repo/shared";
import { and, asc, eq, getTableColumns, sql } from "drizzle-orm";

import { DatabasePg, type UUIDType } from "src/common";
import { DB } from "src/storage/db/db.providers";
import { achievements, achievementTranslations } from "src/storage/schema";

import type {
  Achievement,
  AchievementTranslationsInput,
  CreateAchievementBody,
  UpdateAchievementBody,
} from "./schemas/achievement.schema";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import type * as schema from "src/storage/schema";

type Transaction = PostgresJsDatabase<typeof schema>;
type AchievementRow = typeof achievements.$inferSelect;
type AchievementTranslationRow = typeof achievementTranslations.$inferSelect;

@Injectable()
export class AchievementsRepository {
  constructor(@Inject(DB) private readonly db: DatabasePg) {}

  async findAll(params: {
    tenantId: UUIDType;
    includeInactive: boolean;
    language: SupportedLanguages;
  }): Promise<Achievement[]> {
    const rows = await this.db
      .select({
        achievement: getTableColumns(achievements),
        translation: getTableColumns(achievementTranslations),
      })
      .from(achievements)
      .leftJoin(achievementTranslations, eq(achievementTranslations.achievementId, achievements.id))
      .where(
        and(
          eq(achievements.tenantId, params.tenantId),
          params.includeInactive ? undefined : eq(achievements.isActive, true),
        ),
      )
      .orderBy(asc(achievements.pointThreshold), asc(achievements.createdAt));

    return this.mapRows(rows, params.language);
  }

  async findById(params: {
    id: UUIDType;
    tenantId: UUIDType;
    language: SupportedLanguages;
  }): Promise<Achievement | null> {
    const rows = await this.db
      .select({
        achievement: getTableColumns(achievements),
        translation: getTableColumns(achievementTranslations),
      })
      .from(achievements)
      .leftJoin(achievementTranslations, eq(achievementTranslations.achievementId, achievements.id))
      .where(and(eq(achievements.id, params.id), eq(achievements.tenantId, params.tenantId)));

    return this.mapRows(rows, params.language)[0] ?? null;
  }

  async create(tenantId: UUIDType, payload: CreateAchievementBody): Promise<AchievementRow> {
    return await this.db.transaction(async (trx) => {
      const [created] = await trx
        .insert(achievements)
        .values({
          tenantId,
          imageReference: payload.imageReference,
          pointThreshold: payload.pointThreshold,
          isActive: payload.isActive ?? true,
        })
        .returning();

      await this.upsertTranslations(trx as Transaction, created.id, payload.translations);

      return created;
    });
  }

  async update(params: {
    id: UUIDType;
    tenantId: UUIDType;
    payload: UpdateAchievementBody;
  }): Promise<AchievementRow | null> {
    return await this.db.transaction(async (trx) => {
      const updatePayload = {
        updatedAt: sql`now()`,
        ...(params.payload.imageReference !== undefined && {
          imageReference: params.payload.imageReference,
        }),
        ...(params.payload.pointThreshold !== undefined && {
          pointThreshold: params.payload.pointThreshold,
        }),
        ...(params.payload.isActive !== undefined && { isActive: params.payload.isActive }),
      };

      const [updated] = await trx
        .update(achievements)
        .set(updatePayload)
        .where(and(eq(achievements.id, params.id), eq(achievements.tenantId, params.tenantId)))
        .returning();

      if (!updated) return null;

      if (params.payload.translations) {
        await this.upsertTranslations(trx as Transaction, updated.id, params.payload.translations);
      }

      return updated;
    });
  }

  async softDelete(id: UUIDType, tenantId: UUIDType): Promise<AchievementRow | null> {
    const [updated] = await this.db
      .update(achievements)
      .set({ isActive: false })
      .where(and(eq(achievements.id, id), eq(achievements.tenantId, tenantId)))
      .returning();

    return updated ?? null;
  }

  private async upsertTranslations(
    trx: Transaction,
    achievementId: UUIDType,
    translations: AchievementTranslationsInput,
  ) {
    const values = Object.values(SUPPORTED_LANGUAGES).map((locale) => ({
      achievementId,
      locale,
      name: translations[locale].name,
      description: translations[locale].description,
    }));

    await trx
      .insert(achievementTranslations)
      .values(values)
      .onConflictDoUpdate({
        target: [achievementTranslations.achievementId, achievementTranslations.locale],
        set: {
          name: sql`EXCLUDED.name`,
          description: sql`EXCLUDED.description`,
        },
      });
  }

  private mapRows(
    rows: Array<{
      achievement: AchievementRow;
      translation: AchievementTranslationRow | null;
    }>,
    language: SupportedLanguages,
  ): Achievement[] {
    const byId = new Map<
      UUIDType,
      AchievementRow & { translations: AchievementTranslationRow[] }
    >();

    for (const row of rows) {
      const existing = byId.get(row.achievement.id) ?? { ...row.achievement, translations: [] };
      if (row.translation) existing.translations.push(row.translation);
      byId.set(row.achievement.id, existing);
    }

    return [...byId.values()].map((achievement) => {
      const localized =
        achievement.translations.find((translation) => translation.locale === language) ??
        achievement.translations.find(
          (translation) => translation.locale === SUPPORTED_LANGUAGES.EN,
        ) ??
        achievement.translations[0];

      return {
        ...achievement,
        localizedName: localized?.name ?? "",
        localizedDescription: localized?.description ?? "",
        translations: achievement.translations,
      };
    });
  }
}
