import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  hasPermission,
  PERMISSIONS,
  type GamificationVisibility,
  type SupportedLanguages,
} from "@repo/shared";
import { eq } from "drizzle-orm";

import { setJsonbField } from "src/common/helpers/sqlHelpers";
import { achievements } from "src/storage/schema";

import { AchievementsRepository } from "./achievements.repository";
import { VALIDATE_THRESHOLD_TYPE, type validateThresholdType } from "./achievements.types";

import type { CreateAchievement } from "./schema/createAchievement.schema";
import type { CreateAchievementLevel } from "./schema/createAchievementLevel.schema";
import type { UpdateAchievement } from "./schema/updateAchievement.schema";
import type { UpdateAchievementLevel } from "./schema/updateAchievementLevel.schema";
import type { SQL } from "drizzle-orm";
import type { UUIDType } from "src/common";
import type { CurrentUserType } from "src/common/types/current-user.type";

@Injectable()
export class AchievementsService {
  constructor(private readonly achievementsRepository: AchievementsRepository) {}

  async getAchievementsList(
    currentUser: CurrentUserType,
    isEnabled?: boolean,
    visibility?: GamificationVisibility,
    triggerEventType?: string,
  ) {
    if (
      !hasPermission(currentUser.permissions, PERMISSIONS.ACHIEVEMENTS_MANAGE_PARAMS) &&
      String(isEnabled) === "false"
    ) {
      throw new ForbiddenException("common.toast.noAccess");
    }

    const conditions = this.buildAchievementsConditions(isEnabled, visibility, triggerEventType);
    return this.achievementsRepository.getAchievementsList(conditions);
  }

  async getAchievement(achievementId: UUIDType) {
    const achievement = await this.achievementsRepository.getAchievementById(achievementId);

    if (!achievement) {
      throw new NotFoundException("gamification.errors.achievementNotFound");
    }

    return achievement;
  }

  async createAchievement(createAchievementBody: CreateAchievement) {
    return this.achievementsRepository.insertAchievement(createAchievementBody);
  }

  async updateAchievement(achievementId: UUIDType, updateAchievementBody: UpdateAchievement) {
    const updateData = this.buildUpdateData(updateAchievementBody);

    if (Object.keys(updateData).length === 0) {
      return this.getAchievement(achievementId);
    }

    const updated = await this.achievementsRepository.updateAchievementById(
      achievementId,
      updateData,
    );

    if (!updated) {
      throw new NotFoundException("gamification.errors.achievementNotFound");
    }

    return this.getAchievement(achievementId);
  }

  async deleteAchievement(achievementId: UUIDType) {
    const deleted = await this.achievementsRepository.deleteAchievementById(achievementId);

    if (!deleted) {
      throw new NotFoundException("gamification.errors.achievementNotFound");
    }

    return deleted;
  }

  async getAchievementLevels(achievementId: UUIDType, levelNumber?: number) {
    if (levelNumber !== undefined) {
      return this.achievementsRepository.getAchievementLevelByNumber(achievementId, levelNumber);
    }
    return this.achievementsRepository.getAchievementLevelsByAchievementId(achievementId);
  }

  async createAchievementLevel(
    createAchievementLevelBody: CreateAchievementLevel,
    achievementId: UUIDType,
  ) {
    const nextLevel = (await this.achievementsRepository.getHighestLevelNumber(achievementId)) + 1;

    if (nextLevel > 5) {
      throw new BadRequestException("gamification.errors.wrongAchievementLevel");
    }

    await this.validateThreshold(
      achievementId,
      createAchievementLevelBody.threshold,
      VALIDATE_THRESHOLD_TYPE.POST,
    );

    return this.achievementsRepository.insertAchievementLevel(
      createAchievementLevelBody,
      achievementId,
      nextLevel,
    );
  }

  async updateAchievementLevel(
    updateAchievementLevelBody: UpdateAchievementLevel,
    achievementId: UUIDType,
    levelNumber: number,
  ) {
    await this.validateThreshold(
      achievementId,
      updateAchievementLevelBody?.threshold,
      VALIDATE_THRESHOLD_TYPE.UPDATE,
      levelNumber,
    );

    const updated = await this.achievementsRepository.updateAchievementLevel(
      updateAchievementLevelBody,
      achievementId,
      levelNumber,
    );

    if (!updated) {
      throw new NotFoundException("gamification.errors.achievementLevelNotFound");
    }

    return updated;
  }

  async deleteAchievementLevel(achievementId: UUIDType) {
    const levelNumber = await this.achievementsRepository.getHighestLevelNumber(achievementId);

    const deleted = await this.achievementsRepository.deleteAchievementLevel(
      achievementId,
      levelNumber,
    );

    if (!deleted) {
      throw new NotFoundException("gamification.errors.achievementLevelNotFound");
    }

    return deleted;
  }

  async getUserAchievements(userId?: UUIDType, language?: SupportedLanguages) {
    if (!userId) return [];

    return this.achievementsRepository.getUserAchievements(userId, language);
  }

  async createTranslation(id: UUIDType, language: SupportedLanguages, title: string) {
    const achievement = await this.getAchievement(id);

    if (achievement.availableLocales.includes(language)) {
      throw new ConflictException({
        message: "adminAchievementView.toast.languageAlreadyExists",
      });
    }

    await this.achievementsRepository.updateAchievementLocales(
      id,
      [...achievement.availableLocales, language],
      language,
      title,
    );

    return this.getAchievement(id);
  }

  private buildUpdateData(updateAchievementBody: UpdateAchievement) {
    const { language, title, visibility, isEnabled, triggerEventType } = updateAchievementBody;
    const updateData: Record<string, unknown> = {};

    if (title !== undefined) {
      const titleUpdate = setJsonbField(achievements.title, language, title);
      if (titleUpdate) updateData.title = titleUpdate;
    }

    if (visibility !== undefined) updateData.visibility = visibility;
    if (isEnabled !== undefined) updateData.isEnabled = isEnabled;
    if (triggerEventType !== undefined) updateData.triggerEventType = triggerEventType;

    return updateData;
  }

  private buildAchievementsConditions(
    isEnabled?: boolean | string,
    visibility?: GamificationVisibility,
    triggerEventType?: string,
  ) {
    const conditions: SQL[] = [];

    if (isEnabled !== undefined) {
      const isEnabledBool = isEnabled === true || isEnabled === "true";
      conditions.push(eq(achievements.isEnabled, isEnabledBool));
    }
    if (visibility) conditions.push(eq(achievements.visibility, visibility));
    if (triggerEventType) conditions.push(eq(achievements.triggerEventType, triggerEventType));

    return conditions;
  }

  private async validateThreshold(
    achievementId: UUIDType,
    threshold: number | undefined,
    type: validateThresholdType,
    levelNumber?: number,
  ) {
    if (!threshold) {
      throw new BadRequestException("gamification.errors.wrongAchievementLevelThreshold");
    }

    const levels =
      await this.achievementsRepository.getAchievementLevelsByAchievementId(achievementId);
    const sortedLevels = [...levels].sort((a, b) => b.levelNumber - a.levelNumber);

    if (sortedLevels.length === 0) return;

    if (type === VALIDATE_THRESHOLD_TYPE.POST) {
      if (sortedLevels[0].threshold >= threshold) {
        throw new BadRequestException("gamification.errors.wrongAchievementLevelThreshold");
      }
      return;
    }

    if (type === VALIDATE_THRESHOLD_TYPE.UPDATE) {
      const idx = sortedLevels.findIndex((l) => l.levelNumber === levelNumber);

      if (idx === 0) {
        if (sortedLevels[idx + 1]?.threshold >= threshold) {
          throw new BadRequestException("gamification.errors.wrongAchievementLevelThreshold");
        }
      } else if (idx === sortedLevels.length - 1) {
        if (sortedLevels[idx - 1]?.threshold <= threshold) {
          throw new BadRequestException("gamification.errors.wrongAchievementLevelThreshold");
        }
      } else {
        if (
          sortedLevels[idx - 1].threshold <= threshold ||
          sortedLevels[idx + 1].threshold >= threshold
        ) {
          throw new BadRequestException("gamification.errors.wrongAchievementLevelThreshold");
        }
      }
    }
  }
}
