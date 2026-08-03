import { Injectable, Inject } from "@nestjs/common";
import { and, eq, sql } from "drizzle-orm";

import { DatabasePg } from "src/common";
import { LocalizationService } from "src/localization/localization.service";
import { DB } from "src/storage/db/db.providers";
import {
  achievements,
  achievementLevels,
  activityLogs,
  userAchievementLevels,
  userProgress,
  userStatistics,
} from "src/storage/schema";

import type {
  ActivityLogActionType,
  ActivityLogResourceType,
  SupportedLanguages,
} from "@repo/shared";
import type { UUIDType } from "src/common";

@Injectable()
export class GamificationRepository {
  constructor(
    @Inject(DB) private readonly db: DatabasePg,
    private readonly localizationService: LocalizationService,
  ) {}

  async getAchievementsForEvent(
    tenantId: string,
    resourceType: string,
    canViewHidden: boolean,
    dbInstance?: DatabasePg,
  ) {
    const db = dbInstance ?? this.db;

    return db
      .select()
      .from(achievements)
      .where(
        and(
          eq(achievements.tenantId, tenantId),
          eq(achievements.triggerEventType, resourceType),
          eq(achievements.isEnabled, true),
          ...(canViewHidden ? [] : [eq(achievements.visibility, "visible")]),
        ),
      );
  }

  async getAchievementLevelsWithName(
    achievementId: UUIDType,
    language: SupportedLanguages,
    dbInstance?: DatabasePg,
  ) {
    const db = dbInstance ?? this.db;

    return db
      .select({
        id: achievementLevels.id,
        levelNumber: achievementLevels.levelNumber,
        threshold: achievementLevels.threshold,
        xpReward: achievementLevels.xpReward,
        achievementName: this.localizationService.getLocalizedSqlField(
          achievements.title,
          language,
          achievements,
        ),
      })
      .from(achievementLevels)
      .innerJoin(achievements, eq(achievementLevels.achievementId, achievements.id))
      .where(eq(achievementLevels.achievementId, achievementId));
  }

  async getUserAchievementProgress(userId: UUIDType, dbInstance?: DatabasePg) {
    const db = dbInstance ?? this.db;

    return db.select().from(userAchievementLevels).where(eq(userAchievementLevels.userId, userId));
  }

  async insertUserAchievementLevel(
    userId: UUIDType,
    achievementLevelId: UUIDType,
    sourceId: UUIDType,
    dbInstance?: DatabasePg,
  ) {
    const db = dbInstance ?? this.db;

    const [row] = await db
      .insert(userAchievementLevels)
      .values({ userId, achievementLevelId, sourceId })
      .returning();
    return row;
  }

  async getUserProgress(userId: UUIDType, dbInstance?: DatabasePg) {
    const db = dbInstance ?? this.db;

    const [row] = await db.select().from(userProgress).where(eq(userProgress.userId, userId));
    return row ?? null;
  }

  async insertUserProgress(userId: UUIDType, dbInstance?: DatabasePg) {
    const db = dbInstance ?? this.db;

    await db.insert(userProgress).values({ userId });
  }

  async addXpToUser(userId: UUIDType, xpReward: number, dbInstance?: DatabasePg) {
    const db = dbInstance ?? this.db;

    await db
      .update(userProgress)
      .set({
        spendableXp: sql`${userProgress.spendableXp} + ${xpReward}`,
        lifetimeXp: sql`${userProgress.lifetimeXp} + ${xpReward}`,
      })
      .where(eq(userProgress.userId, userId));
  }

  async incrementUserLevel(userId: UUIDType, dbInstance?: DatabasePg) {
    const db = dbInstance ?? this.db;

    await db
      .update(userProgress)
      .set({ currentLevel: sql`${userProgress.currentLevel} + 1` })
      .where(eq(userProgress.userId, userId));
  }

  async getCurrentStreak(userId: UUIDType, dbInstance?: DatabasePg) {
    const db = dbInstance ?? this.db;

    const [row] = await db
      .select({ currentStreak: userStatistics.currentStreak })
      .from(userStatistics)
      .where(eq(userStatistics.userId, userId));
    return row?.currentStreak ?? null;
  }

  async getActivityLogCount(
    userId: UUIDType,
    actionType: ActivityLogActionType,
    resourceType: ActivityLogResourceType,
    dbInstance?: DatabasePg,
  ) {
    const db = dbInstance ?? this.db;

    const rows = await db
      .select()
      .from(activityLogs)
      .where(
        and(
          eq(activityLogs.actorId, userId),
          eq(activityLogs.actionType, actionType),
          eq(activityLogs.resourceType, resourceType),
        ),
      );
    return rows.length;
  }
}
