import { Inject, Injectable } from "@nestjs/common";
import { SUPPORTED_LANGUAGES, type SupportedLanguages } from "@repo/shared";
import { and, asc, eq, getTableColumns, gte, isNotNull, isNull, or, sql } from "drizzle-orm";

import { DatabasePg, type UUIDType } from "src/common";
import { DB } from "src/storage/db/db.providers";
import {
  achievements,
  achievementTranslations,
  userAchievements,
  userStatistics,
} from "src/storage/schema";

import { evaluateAchievementUnlocks } from "./achievement.evaluator";

import type {
  Achievement,
  AchievementTranslationsInput,
  AchievementUnlock,
  CreateAchievementBody,
  ProfileAchievementsResponse,
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

  async unlockEligibleAchievements(params: {
    trx: Transaction;
    userId: UUIDType;
    tenantId: UUIDType;
    currentTotal: number;
    language: SupportedLanguages;
  }): Promise<AchievementUnlock[]> {
    const rows = await this.selectAchievementRows({
      db: params.trx,
      tenantId: params.tenantId,
      activeOnly: true,
    });
    const activeCatalog = this.mapRows(rows, params.language);

    const heldRows = await params.trx
      .select({ achievementId: userAchievements.achievementId })
      .from(userAchievements)
      .where(
        and(
          eq(userAchievements.userId, params.userId),
          eq(userAchievements.tenantId, params.tenantId),
        ),
      );

    const newlyUnlockedIds = evaluateAchievementUnlocks(
      params.currentTotal,
      heldRows.map((row) => row.achievementId),
      activeCatalog,
    );

    if (newlyUnlockedIds.length === 0) return [];

    const inserted = await params.trx
      .insert(userAchievements)
      .values(
        newlyUnlockedIds.map((achievementId) => ({
          achievementId,
          userId: params.userId,
          tenantId: params.tenantId,
        })),
      )
      .onConflictDoNothing({
        target: [userAchievements.userId, userAchievements.achievementId],
      })
      .returning({
        achievementId: userAchievements.achievementId,
        unlockedAt: userAchievements.unlockedAt,
      });

    const unlockedAtById = new Map(
      inserted.map((row) => [row.achievementId, row.unlockedAt] as const),
    );

    return activeCatalog
      .filter((achievement) => unlockedAtById.has(achievement.id))
      .map((achievement) => ({
        ...achievement,
        unlockedAt: unlockedAtById.get(achievement.id) ?? new Date().toISOString(),
      }));
  }

  async findProfileAchievements(params: {
    userId: UUIDType;
    tenantId: UUIDType;
    language: SupportedLanguages;
  }): Promise<ProfileAchievementsResponse> {
    const [statistics] = await this.db
      .select({ totalPoints: sql<number>`COALESCE(${userStatistics.totalPoints}, 0)` })
      .from(userStatistics)
      .where(
        and(eq(userStatistics.userId, params.userId), eq(userStatistics.tenantId, params.tenantId)),
      );
    const totalPoints = statistics?.totalPoints ?? 0;

    const rows = await this.db
      .select({
        achievement: getTableColumns(achievements),
        translation: getTableColumns(achievementTranslations),
        unlockedAt: userAchievements.unlockedAt,
      })
      .from(achievements)
      .leftJoin(achievementTranslations, eq(achievementTranslations.achievementId, achievements.id))
      .leftJoin(
        userAchievements,
        and(
          eq(userAchievements.achievementId, achievements.id),
          eq(userAchievements.userId, params.userId),
          eq(userAchievements.tenantId, params.tenantId),
        ),
      )
      .where(
        and(
          eq(achievements.tenantId, params.tenantId),
          or(eq(achievements.isActive, true), isNotNull(userAchievements.id)),
        ),
      )
      .orderBy(asc(achievements.pointThreshold), asc(achievements.createdAt));

    const byId = new Map<
      UUIDType,
      AchievementRow & {
        translations: AchievementTranslationRow[];
        unlockedAt: string | null;
      }
    >();

    for (const row of rows) {
      const existing = byId.get(row.achievement.id) ?? {
        ...row.achievement,
        translations: [],
        unlockedAt: row.unlockedAt,
      };
      if (row.translation) existing.translations.push(row.translation);
      byId.set(row.achievement.id, existing);
    }

    const achievementsGrid = [...byId.values()].map((achievement) => {
      const [localized] = this.mapRows(
        [
          { achievement, translation: null },
          ...achievement.translations.map((translation) => ({ achievement, translation })),
        ],
        params.language,
      );
      const pointsRemaining = Math.max(achievement.pointThreshold - totalPoints, 0);

      return {
        ...localized,
        unlockedAt: achievement.unlockedAt,
        progress: {
          currentTotal: totalPoints,
          threshold: achievement.pointThreshold,
          pointsRemaining,
          percentage: Math.min(100, Math.floor((totalPoints / achievement.pointThreshold) * 100)),
        },
      };
    });

    return { totalPoints, achievements: achievementsGrid };
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

      if (created.isActive) {
        await this.retroactivelyUnlockAchievement(trx as Transaction, created);
      }

      return created;
    });
  }

  async update(params: {
    id: UUIDType;
    tenantId: UUIDType;
    payload: UpdateAchievementBody;
  }): Promise<AchievementRow | null> {
    return await this.db.transaction(async (trx) => {
      const [previous] = await trx
        .select()
        .from(achievements)
        .where(and(eq(achievements.id, params.id), eq(achievements.tenantId, params.tenantId)));

      if (!previous) return null;

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

      const thresholdWasLowered =
        params.payload.pointThreshold !== undefined &&
        params.payload.pointThreshold < previous.pointThreshold;

      if (updated.isActive && thresholdWasLowered) {
        await this.retroactivelyUnlockAchievement(trx as Transaction, updated);
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

  private async retroactivelyUnlockAchievement(trx: Transaction, achievement: AchievementRow) {
    const candidates = await trx
      .select({ userId: userStatistics.userId, totalPoints: userStatistics.totalPoints })
      .from(userStatistics)
      .leftJoin(
        userAchievements,
        and(
          eq(userAchievements.userId, userStatistics.userId),
          eq(userAchievements.achievementId, achievement.id),
          eq(userAchievements.tenantId, achievement.tenantId),
        ),
      )
      .where(
        and(
          eq(userStatistics.tenantId, achievement.tenantId),
          gte(userStatistics.totalPoints, achievement.pointThreshold),
          isNull(userAchievements.id),
        ),
      );

    const userIdsToUnlock = candidates
      .filter((candidate) =>
        evaluateAchievementUnlocks(candidate.totalPoints, [], [achievement]).includes(
          achievement.id,
        ),
      )
      .map((candidate) => candidate.userId);

    if (userIdsToUnlock.length === 0) return;

    await trx
      .insert(userAchievements)
      .values(
        userIdsToUnlock.map((userId) => ({
          achievementId: achievement.id,
          userId,
          tenantId: achievement.tenantId,
        })),
      )
      .onConflictDoNothing({
        target: [userAchievements.userId, userAchievements.achievementId],
      });
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

  private selectAchievementRows(params: {
    db: Transaction | DatabasePg;
    tenantId: UUIDType;
    activeOnly: boolean;
  }) {
    return params.db
      .select({
        achievement: getTableColumns(achievements),
        translation: getTableColumns(achievementTranslations),
      })
      .from(achievements)
      .leftJoin(achievementTranslations, eq(achievementTranslations.achievementId, achievements.id))
      .where(
        and(
          eq(achievements.tenantId, params.tenantId),
          params.activeOnly ? eq(achievements.isActive, true) : undefined,
        ),
      )
      .orderBy(asc(achievements.pointThreshold), asc(achievements.createdAt));
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
