import { Inject, Injectable } from "@nestjs/common";
import { and, asc, eq, gt, sql } from "drizzle-orm";

import { DatabasePg } from "src/common";
import { buildJsonbFieldWithMultipleEntries } from "src/common/helpers/sqlHelpers";
import { LocalizationService } from "src/localization/localization.service";
import { DB } from "src/storage/db/db.providers";
import {
  achievementLevels,
  achievements,
  courses,
  userAchievementLevels,
  userAchievementProgress,
} from "src/storage/schema";

import type { AchievementDefinitionInput } from "./gamification.types";
import type { SupportedLanguages } from "@repo/shared";
import type { UUIDType } from "src/common";

@Injectable()
export class AchievementAdminRepository {
  constructor(
    @Inject(DB) private readonly db: DatabasePg,
    private readonly localizationService: LocalizationService,
  ) {}

  async findAchievements(language: SupportedLanguages, id?: UUIDType) {
    const earnedCounts = this.db
      .select({
        achievementLevelId: userAchievementLevels.achievementLevelId,
        earnedCount: sql<number>`COUNT(*)::int`.as("earned_count"),
      })
      .from(userAchievementLevels)
      .groupBy(userAchievementLevels.achievementLevelId)
      .as("earned_counts");

    return this.db
      .select({
        id: achievements.id,
        key: achievements.key,
        title: achievements.title,
        description: achievements.description,
        localizedTitle: this.localizationService.getLocalizedSqlField(
          achievements.title,
          language,
          achievements,
        ),
        localizedDescription: this.localizationService.getLocalizedSqlField(
          achievements.description,
          language,
          achievements,
        ),
        baseLanguage: achievements.baseLanguage,
        eventType: achievements.eventType,
        requirementType: achievements.requirementType,
        windowDays: achievements.windowDays,
        filters: achievements.filters,
        visibility: achievements.visibility,
        isEnabled: achievements.isEnabled,
        icon: achievements.icon,
        levels: sql<
          {
            level: number;
            threshold: number;
            xpReward: number;
            earnedCount: number;
            badgeImageKey: string | null;
          }[]
        >`
          COALESCE(
            json_agg(
              json_build_object(
                'level', ${achievementLevels.level},
                'threshold', ${achievementLevels.threshold},
                'xpReward', ${achievementLevels.xpReward},
                'earnedCount', COALESCE(${earnedCounts.earnedCount}, 0),
                'badgeImageKey', ${achievementLevels.badgeImageKey}
              ) ORDER BY ${achievementLevels.level}
            ) FILTER (WHERE ${achievementLevels.id} IS NOT NULL),
            '[]'::json
          )
        `,
      })
      .from(achievements)
      .leftJoin(achievementLevels, eq(achievementLevels.achievementId, achievements.id))
      .leftJoin(earnedCounts, eq(earnedCounts.achievementLevelId, achievementLevels.id))
      .where(id ? eq(achievements.id, id) : undefined)
      .groupBy(achievements.id)
      .orderBy(asc(achievements.createdAt), asc(achievements.id));
  }

  async findAchievementKey(id: UUIDType) {
    const [row] = await this.db
      .select({ key: achievements.key })
      .from(achievements)
      .where(eq(achievements.id, id));

    return row ?? null;
  }

  async courseExists(courseId: UUIDType) {
    const [row] = await this.db
      .select({ id: courses.id })
      .from(courses)
      .where(eq(courses.id, courseId));

    return Boolean(row);
  }

  async findHighestEarnedLevel(achievementId: UUIDType) {
    const [row] = await this.db
      .select({ level: sql<number>`COALESCE(MAX(${achievementLevels.level}), 0)::int` })
      .from(achievementLevels)
      .innerJoin(
        userAchievementLevels,
        eq(userAchievementLevels.achievementLevelId, achievementLevels.id),
      )
      .where(eq(achievementLevels.achievementId, achievementId));

    return row?.level ?? 0;
  }

  async insertAchievement(definition: AchievementDefinitionInput) {
    const [row] = await this.db
      .insert(achievements)
      .values(this.toAchievementValues(definition))
      .returning({ id: achievements.id });

    return row.id;
  }

  async updateAchievement(id: UUIDType, definition: AchievementDefinitionInput) {
    await this.db
      .update(achievements)
      .set({ ...this.toAchievementValues(definition), updatedAt: sql`now()` })
      .where(eq(achievements.id, id));
  }

  async updateAchievementStatus(id: UUIDType, isEnabled: boolean) {
    const [row] = await this.db
      .update(achievements)
      .set({ isEnabled, updatedAt: sql`now()` })
      .where(eq(achievements.id, id))
      .returning({ id: achievements.id });

    return Boolean(row);
  }

  /**
   * Levels are matched by number so existing rows and their earned records are kept. Levels past the
   * new count are deleted, so callers must reject removing an earned level first.
   */
  async replaceLevels(achievementId: UUIDType, levels: AchievementDefinitionInput["levels"]) {
    await this.db
      .insert(achievementLevels)
      .values(levels.map((level, index) => ({ ...level, achievementId, level: index + 1 })))
      .onConflictDoUpdate({
        target: [achievementLevels.achievementId, achievementLevels.level],
        set: {
          threshold: sql`excluded.threshold`,
          xpReward: sql`excluded.xp_reward`,
          badgeImageKey: sql`excluded.badge_image_key`,
          updatedAt: sql`now()`,
        },
      });

    await this.db
      .delete(achievementLevels)
      .where(
        and(
          eq(achievementLevels.achievementId, achievementId),
          gt(achievementLevels.level, levels.length),
        ),
      );
  }

  /** Stored progress only ever grows, so it must be cleared before a changed definition is re-measured. */
  async deleteProgress(achievementId: UUIDType) {
    await this.db
      .delete(userAchievementProgress)
      .where(eq(userAchievementProgress.achievementId, achievementId));
  }

  private toAchievementValues(definition: AchievementDefinitionInput) {
    return {
      title: buildJsonbFieldWithMultipleEntries(definition.title),
      description: buildJsonbFieldWithMultipleEntries(definition.description),
      baseLanguage: definition.baseLanguage,
      availableLocales: definition.availableLocales,
      eventType: definition.eventType,
      requirementType: definition.requirementType,
      windowDays: definition.windowDays,
      // The text cast keeps postgres.js from encoding the JSON parameter as a JSONB string.
      filters: sql`${JSON.stringify(definition.filters)}::text::jsonb`,
      visibility: definition.visibility,
      isEnabled: definition.isEnabled,
      icon: definition.icon,
    };
  }
}
