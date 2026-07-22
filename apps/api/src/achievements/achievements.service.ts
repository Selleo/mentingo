import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import { and, asc, eq } from "drizzle-orm";

import { DatabasePg } from "src/common";
import { buildJsonbField, setJsonbField } from "src/common/helpers/sqlHelpers";
import { GamificationRepository } from "src/gamification/gamification.repository";
import { LocalizationService } from "src/localization/localization.service";
import { DB } from "src/storage/db/db.providers";
import { achievementLevels, achievements, userAchievementLevels } from "src/storage/schema";

import { AchievementsRepository } from "./achievements.repository";

import type { CreateAchievement } from "./schema/createAchievement.schema";
import type { CreateAchievementLevel } from "./schema/createAchievementLevel.schema";
import type { UpdateAchievement } from "./schema/updateAchievement.schema";
import type { UpdateAchievementLevel } from "./schema/updateAchievementLevel.schema";
import type { GamificationVisibility, SupportedLanguages } from "@repo/shared";
import type { UUIDType } from "src/common";
import type { CurrentUserType } from "src/common/types/current-user.type";

@Injectable()
export class AchievementsService {
  constructor(
    @Inject(DB) private readonly db: DatabasePg,
    private readonly achievementsRepository: AchievementsRepository,
    private readonly gamificationRepository: GamificationRepository,
    private readonly localizationService: LocalizationService,
  ) {}

  async getAchievementsList(
    isEnabled?: boolean,
    visibility?: GamificationVisibility,
    triggerEventType?: string,
  ) {
    const conditions = await this.achievementsRepository.getAchievementsConditions(
      isEnabled,
      visibility,
      triggerEventType,
    );

    return await this.db
      .select()
      .from(achievements)
      .where(and(...conditions))
      .orderBy(asc(achievements.key));
  }
  async getAchievement(achievementId: UUIDType) {
    const [achievement] = await this.db
      .select()
      .from(achievements)
      .where(eq(achievements.id, achievementId));

    if (!achievement) {
      throw new BadRequestException("error");
    }

    return achievement;
  }

  async createAchievement(createAchievementBody: CreateAchievement) {
    const { language, key, visibility, isEnabled, triggerEventType } = createAchievementBody;

    const [createdAchievement] = await this.db
      .insert(achievements)
      .values({
        key: buildJsonbField(language, key),
        visibility: visibility,
        isEnabled: isEnabled,
        triggerEventType: triggerEventType,
        baseLanguage: language,
        availableLocales: [language],
      })
      .returning({
        id: achievements.id,
        key: achievements.key,
      });
    if (!createdAchievement) throw new BadRequestException("error");
    return createdAchievement;
  }

  async updateAchievement(achievementId: UUIDType, updateAchievementBody: UpdateAchievement) {
    const { language, key, visibility, isEnabled, triggerEventType } = updateAchievementBody;

    const updateData: {
      key?: ReturnType<typeof setJsonbField>;
      visibility?: GamificationVisibility;
      isEnabled?: boolean;
      triggerEventType?: string;
    } = {};

    if (key !== undefined) {
      const keyUpdate = setJsonbField(achievements.key, language, key);

      if (keyUpdate) {
        updateData.key = keyUpdate;
      }
    }

    if (visibility !== undefined) {
      updateData.visibility = visibility;
    }

    if (isEnabled !== undefined) {
      updateData.isEnabled = isEnabled;
    }

    if (triggerEventType !== undefined) {
      updateData.triggerEventType = triggerEventType;
    }

    if (Object.keys(updateData).length === 0) {
      return this.getAchievement(achievementId);
    }

    const [updatedAchievement] = await this.db
      .update(achievements)
      .set(updateData)
      .where(eq(achievements.id, achievementId))
      .returning();

    if (!updatedAchievement) {
      throw new BadRequestException("error");
    }

    return this.getAchievement(achievementId);
  }

  async deleteAchievement(achievementId: UUIDType) {
    const [deletedAchievement] = await this.db
      .delete(achievements)
      .where(eq(achievements.id, achievementId))
      .returning({ id: achievements.id });
    if (!deletedAchievement) throw new BadRequestException("common.error");
    return deletedAchievement;
  }

  async getAchievementLevels(achievementId: UUIDType, levelNumber?: number) {
    if (levelNumber) {
      return await this.db
        .select()
        .from(achievementLevels)
        .where(
          and(
            eq(achievementLevels.achievementId, achievementId),
            eq(achievementLevels.levelNumber, levelNumber),
          ),
        );
    } else
      return await this.db
        .select()
        .from(achievementLevels)
        .where(eq(achievementLevels.achievementId, achievementId));
  }

  async createAchievementLevel(
    achievementLevelBody: CreateAchievementLevel,
    achievementId: UUIDType,
  ) {
    const nextLevel = (await this.achievementsRepository.getActualLevelNumber(achievementId)) + 1;
    await this.achievementsRepository.validateThreshold(
      achievementId,
      achievementLevelBody.threshold,
      "post",
    );
    const [createdLevel] = await this.db
      .insert(achievementLevels)
      .values({ ...achievementLevelBody, levelNumber: nextLevel, achievementId: achievementId })
      .returning({
        id: achievementLevels.id,
      });
    if (!createdLevel) throw new BadRequestException("error");
    return createdLevel;
  }

  async updateAchievementLevel(
    updateAchievementLevel: UpdateAchievementLevel,
    achievementId: UUIDType,
    levelNumber: number,
  ) {
    await this.achievementsRepository.validateThreshold(
      achievementId,
      updateAchievementLevel?.threshold,
      "update",
      levelNumber,
    );
    const [updatedLevel] = await this.db
      .update(achievementLevels)
      .set({ ...updateAchievementLevel })
      .where(
        and(
          eq(achievementLevels.achievementId, achievementId),
          eq(achievementLevels.levelNumber, levelNumber),
        ),
      )
      .returning({
        id: achievementLevels.id,
      });
    if (!updatedLevel) throw new BadRequestException("error");
    return updatedLevel;
  }

  // DELETE ONLY HIGHEST LEVEL
  async deleteAchievemntLevel(achievementId: UUIDType) {
    const levelNumber = await this.achievementsRepository.getActualLevelNumber(achievementId);
    const [deletedLevel] = await this.db
      .delete(achievementLevels)
      .where(
        and(
          eq(achievementLevels.achievementId, achievementId),
          eq(achievementLevels.levelNumber, levelNumber),
        ),
      )
      .returning({ id: achievementLevels.id });
    if (!deletedLevel) throw new BadRequestException("error");
    return deletedLevel;
  }

  async getUserAchievements(currentUser: CurrentUserType, language?: SupportedLanguages) {
    return await this.db
      .select({
        achievementId: achievements.id,
        achievementKey: this.gamificationRepository.getLocalizedAchievementKey(language),
        visibility: achievements.visibility,

        levelId: achievementLevels.id,
        levelNumber: achievementLevels.levelNumber,
        threshold: achievementLevels.threshold,
        xpReward: achievementLevels.xpReward,

        earnedAt: userAchievementLevels.earnedAt,
      })
      .from(userAchievementLevels)
      .innerJoin(
        achievementLevels,
        eq(userAchievementLevels.achievementLevelId, achievementLevels.id),
      )
      .innerJoin(achievements, eq(achievementLevels.achievementId, achievements.id))
      .where(eq(userAchievementLevels.userId, currentUser.userId));
  }
  async createTranslation(id: UUIDType, language: SupportedLanguages, key: string) {
    const achievement = await this.getAchievement(id);

    if (achievement.availableLocales.includes(language)) {
      throw new BadRequestException({
        message: "adminAchievementView.toast.languageAlreadyExists",
      });
    }

    const keyUpdate = setJsonbField(achievements.key, language, key);

    await this.db
      .update(achievements)
      .set({
        availableLocales: [...achievement.availableLocales, language],
        ...(keyUpdate ? { key: keyUpdate } : {}),
      })
      .where(eq(achievements.id, id));

    return this.getAchievement(id);
  }
}
