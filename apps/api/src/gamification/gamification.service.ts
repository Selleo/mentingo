import { Injectable, NotFoundException } from "@nestjs/common";
import { ACTIVITY_LOG_ACTION_TYPES, ACTIVITY_LOG_RESOURCE_TYPES } from "@repo/shared";

import { WsGateway } from "src/websocket";

import { GamificationRepository } from "./gamification.repository";
import {
  GAMIFICATION_WEBSOCKET_EMIT_TITLE,
  GAMIFICATION_WEBSOCKET_EMIT_TYPE,
  type AchievementLevel,
} from "./gamification.types";

import type { WebsocketNotificationType } from "./gamification.worker";
import type { ActivityLogActionType, ActivityLogResourceType } from "@repo/shared";
import type { DatabasePg, UUIDType } from "src/common";
import type { GamificationEventPayload } from "src/websocket";

@Injectable()
export class GamificationService {
  constructor(
    private readonly gamificationRepository: GamificationRepository,
    private readonly wsGateway: WsGateway,
  ) {}

  async getUserProgress(userId: UUIDType) {
    const progress = await this.gamificationRepository.getUserProgress(userId);

    if (!progress) {
      throw new NotFoundException("gamification.errors.userProgressNotFound");
    }

    return progress;
  }

  async resolveThreshold(event: GamificationEventPayload, dbInstance?: DatabasePg) {
    if (
      event.resourceType === ACTIVITY_LOG_RESOURCE_TYPES.USER &&
      event.actionType === ACTIVITY_LOG_ACTION_TYPES.LOGIN
    ) {
      return this.gamificationRepository.getCurrentStreak(event.userId, dbInstance);
    }

    if (
      event.resourceType === ACTIVITY_LOG_RESOURCE_TYPES.LESSON ||
      event.resourceType === ACTIVITY_LOG_RESOURCE_TYPES.CHAPTER ||
      event.resourceType === ACTIVITY_LOG_RESOURCE_TYPES.COURSE
    ) {
      return this.gamificationRepository.getActivityLogCount(
        event.userId,
        event.actionType as ActivityLogActionType,
        event.resourceType as ActivityLogResourceType,
        dbInstance,
      );
    }

    return null;
  }

  async processAchievements(
    levels: AchievementLevel[],
    actualThreshold: number,
    event: GamificationEventPayload,
    dbInstance?: DatabasePg,
  ) {
    await this.ensureUserProgress(event.userId, dbInstance);

    const qualifiedLevels = levels.filter((l) => l.threshold <= actualThreshold);

    const alreadyEarned = await this.gamificationRepository.getUserAchievementProgress(
      event.userId,
      dbInstance,
    );

    const missingLevels = qualifiedLevels.filter(
      (level) => !alreadyEarned.some((earned) => earned.achievementLevelId === level.id),
    );

    if (missingLevels.length === 0) return null;

    let highestNewLevel: WebsocketNotificationType | null = null;

    for (const level of missingLevels) {
      const newRow = await this.gamificationRepository.insertUserAchievementLevel(
        event.userId,
        level.id,
        event.sourceId,
        dbInstance,
      );
      await this.gamificationRepository.addXpToUser(event.userId, level.xpReward, dbInstance);
      await this.checkAndIncrementLevel(event.userId, dbInstance);

      if (!highestNewLevel || level.levelNumber > highestNewLevel.level.levelNumber) {
        highestNewLevel = { userAchievementId: newRow.id, level };
      }
    }

    return highestNewLevel;
  }

  async emitAchievementNotification(
    userId: string,
    awarded: { userAchievementId: string; level: AchievementLevel },
  ) {
    await this.wsGateway.waitForConnection(userId);
    this.wsGateway.emitToUser(userId, GAMIFICATION_WEBSOCKET_EMIT_TITLE.NEW_LEVEL, {
      userAchievementId: awarded.userAchievementId,
      achievementName: awarded.level.achievementName,
      level: awarded.level.levelNumber,
      type: GAMIFICATION_WEBSOCKET_EMIT_TYPE.ACHIEVEMENT,
    });
  }

  private async ensureUserProgress(userId: UUIDType, dbInstance?: DatabasePg) {
    const existing = await this.gamificationRepository.getUserProgress(userId, dbInstance);
    if (!existing) {
      await this.gamificationRepository.insertUserProgress(userId, dbInstance);
    }
  }

  private async checkAndIncrementLevel(userId: UUIDType, dbInstance?: DatabasePg) {
    const progress = await this.gamificationRepository.getUserProgress(userId, dbInstance);
    if (!progress) return;

    const nextLevelRequiredXp = 100 * progress.currentLevel ** 2;
    if (progress.lifetimeXp >= nextLevelRequiredXp) {
      await this.gamificationRepository.incrementUserLevel(userId, dbInstance);
    }
  }
}
