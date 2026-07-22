import { Injectable, Inject } from "@nestjs/common";
import { eq, sql } from "drizzle-orm";

import { DatabasePg } from "src/common";
import { LocalizationService } from "src/localization/localization.service";
import { DB } from "src/storage/db/db.providers";
import { achievements, userAchievementLevels, userProgress } from "src/storage/schema";
import { WsGateway } from "src/websocket";

import type { AchievementLevel } from "./gamification.types";
import type { SupportedLanguages } from "@repo/shared";
import type { UUIDType } from "src/common";
import type { GamificationEventPayload } from "src/websocket";

@Injectable()
export class GamificationRepository {
  constructor(
    @Inject(DB) private readonly db: DatabasePg,
    private readonly wsGateway: WsGateway,
    private readonly localizationService: LocalizationService,
  ) {}
  async createUsersMissingAchievements({
    achievementLevels,
    actualThreshold,
    event,
  }: {
    achievementLevels: AchievementLevel[];
    actualThreshold: number;
    event: GamificationEventPayload;
  }) {
    await this.checkUserProgress(event.userId);

    const qualifedLevels = achievementLevels.filter(
      (achievementLevel) => achievementLevel.threshold <= actualThreshold,
    );
    const userAchievementProgress = await this.db
      .select()
      .from(userAchievementLevels)
      .where(eq(userAchievementLevels.userId, event.userId));

    const missingLevels = qualifedLevels.filter(
      (level) =>
        !userAchievementProgress.some((progress) => progress.achievementLevelId == level.id),
    );

    if (missingLevels.length > 0) {
      let highestNewLevel: { userAchievementId: string; level: AchievementLevel } | null = null;
      for (const level of missingLevels) {
        const [newUserAchievement] = await this.db
          .insert(userAchievementLevels)
          .values({
            userId: event.userId,
            achievementLevelId: level.id,
            sourceId: event.sourceId,
          })
          .returning();
        await this.addXpToUser(event.userId, level.xpReward);
        await this.checkNextLevel(event.userId);

        if (!highestNewLevel || level.levelNumber > highestNewLevel.level.levelNumber) {
          highestNewLevel = { userAchievementId: newUserAchievement.id, level };
        }
      }
      if (highestNewLevel) {
        this.wsGateway.emitToUser(event.userId, "gamification:newLevel", {
          userAchievementId: highestNewLevel.userAchievementId,
          achievementName: highestNewLevel.level.achievementName,
          level: highestNewLevel.level.levelNumber,
          type: "achievement",
        });
      }
    }
  }
  private async checkUserProgress(userId: UUIDType) {
    const [actualUserProgress] = await this.db
      .select()
      .from(userProgress)
      .where(eq(userProgress.userId, userId));
    if (!actualUserProgress) {
      await this.db.insert(userProgress).values({
        userId: userId,
      });
    }
  }
  private async checkNextLevel(userId: UUIDType) {
    const [actualUserProgress] = await this.db
      .select()
      .from(userProgress)
      .where(eq(userProgress.userId, userId));
    const nextLevelRequiredXp = 100 * actualUserProgress.currentLevel ** 2;
    if (nextLevelRequiredXp <= actualUserProgress.lifetimeXp) {
      await this.db
        .update(userProgress)
        .set({
          currentLevel: sql`${userProgress.currentLevel} + 1`,
        })
        .where(eq(userProgress.userId, userId));
    }
  }
  private async addXpToUser(userId: UUIDType, xpReward: number) {
    await this.db
      .update(userProgress)
      .set({
        spendableXp: sql`${userProgress.spendableXp} + ${xpReward}`,
        lifetimeXp: sql`${userProgress.lifetimeXp} + ${xpReward}`,
      })
      .where(eq(userProgress.userId, userId));
  }

  getLocalizedAchievementKey(language?: SupportedLanguages) {
    return this.localizationService.getLocalizedSqlField(
      achievements.key,
      language ?? "en",
      achievements,
    );
  }
}
