import { Injectable, Inject, BadRequestException } from "@nestjs/common";
import { eq, desc } from "drizzle-orm";

import { DatabasePg } from "src/common";
import { DB } from "src/storage/db/db.providers";
import { achievementLevels, achievements } from "src/storage/schema";

import type { GamificationVisibility } from "@repo/shared";
import type { UUIDType } from "src/common";

@Injectable()
export class AchievementsRepository {
  constructor(@Inject(DB) private readonly db: DatabasePg) {}
  async getActualLevelNumber(achievementId: UUIDType) {
    const [highestLevel] = await this.db
      .select({
        levelNumber: achievementLevels.levelNumber,
      })
      .from(achievementLevels)
      .where(eq(achievementLevels.achievementId, achievementId))
      .orderBy(desc(achievementLevels.levelNumber))
      .limit(1);

    return highestLevel == undefined ? 0 : highestLevel.levelNumber;
  }

  async getAchievementsConditions(
    isEnabled?: boolean,
    visibility?: GamificationVisibility,
    triggerEventType?: string,
  ) {
    const conditions = [];

    if (isEnabled !== undefined) {
      conditions.push(eq(achievements.isEnabled, isEnabled));
    }

    if (visibility) {
      conditions.push(eq(achievements.visibility, visibility));
    }

    if (triggerEventType) {
      conditions.push(eq(achievements.triggerEventType, triggerEventType));
    }

    return conditions;
  }

  async validateThreshold(
    achievementId: UUIDType,
    threshold: number | undefined,
    type: "post" | "update",
    levelNumber?: number,
  ) {
    if (!threshold)
      throw new BadRequestException("gamification.errors.wrongAchievementLevelThreshold");
    const levels = await this.db
      .select()
      .from(achievementLevels)
      .where(eq(achievementLevels.achievementId, achievementId))
      .orderBy(desc(achievementLevels.levelNumber));
    if (levels.length > 0) {
      if (type == "post") {
        if (levels[0].threshold >= threshold) {
          throw new BadRequestException("gamification.errors.wrongAchievementLevelThreshold");
        }
      } else if (type == "update") {
        const actualLevel = levels.findIndex((level) => level.levelNumber == levelNumber);
        if (actualLevel == 0) {
          if (levels[actualLevel + 1].threshold >= threshold) {
            throw new BadRequestException("gamification.errors.wrongAchievementLevelThreshold");
          }
        } else if (actualLevel == levels.length - 1) {
          if (levels[actualLevel - 1].threshold <= threshold) {
            throw new BadRequestException("gamification.errors.wrongAchievementLevelThreshold");
          }
        } else {
          if (
            levels[actualLevel - 1].threshold <= threshold ||
            levels[actualLevel + 1].threshold >= threshold
          ) {
            throw new BadRequestException("gamification.errors.wrongAchievementLevelThreshold");
          }
        }
      }
    }
  }
}
