import { Injectable, Logger } from "@nestjs/common";
import {
  getLevelFromXp,
  getXpRequiredForLevel,
  hasPermission,
  PERMISSIONS,
  type SupportedLanguages,
} from "@repo/shared";

import { FileService } from "src/file/file.service";
import { PermissionsService } from "src/permissions/permissions.service";
import { TenantDbRunnerService } from "src/storage/db/tenant-db-runner.service";

import { GamificationRepository } from "./gamification.repository";
import { PREDEFINED_ACHIEVEMENTS } from "./predefined-achievements";

import type { UserGamificationProfileResponse } from "./schemas/gamification.schema";
import type { UUIDType } from "src/common";

@Injectable()
export class GamificationService {
  private readonly logger = new Logger(GamificationService.name);

  constructor(
    private readonly gamificationRepository: GamificationRepository,
    private readonly permissionsService: PermissionsService,
    private readonly tenantDbRunnerService: TenantDbRunnerService,
    private readonly fileService: FileService,
  ) {}

  /**
   * Re-measures every enabled achievement the user can earn (hidden ones only with gamification.earn_hidden)
   * and grants missing levels. Idempotent: an earned level is unique per user and level, and its XP
   * transaction is keyed to that earned level, so duplicate or replayed events never grant twice.
   */
  async evaluateUser(userId: UUIDType, sourceEventId: UUIDType | null): Promise<number> {
    return this.tenantDbRunnerService.transaction(async () => {
      const user = await this.gamificationRepository.findActiveUser(userId);

      if (!user) return 0;

      const { permissions } = await this.permissionsService.getUserAccess(userId);
      const canEarnHidden = hasPermission(permissions, PERMISSIONS.GAMIFICATION_EARN_HIDDEN);

      const evaluableAchievements =
        await this.gamificationRepository.findEvaluableAchievements(canEarnHidden);

      await this.gamificationRepository.ensureProfile(userId);

      let grantedXp = 0;

      for (const achievement of evaluableAchievements) {
        const value = await this.gamificationRepository.measureAchievement(userId, achievement);

        await this.gamificationRepository.upsertProgress(userId, achievement.id, value);

        for (const level of achievement.levels.filter(({ threshold }) => threshold <= value)) {
          const earnedLevelId = await this.gamificationRepository.insertEarnedLevel(
            userId,
            level.id,
            sourceEventId,
          );

          if (!earnedLevelId) continue;

          const isNewTransaction = await this.gamificationRepository.insertAchievementXpTransaction(
            userId,
            earnedLevelId,
            level.xpReward,
          );

          if (isNewTransaction) grantedXp += level.xpReward;
        }
      }

      if (grantedXp > 0) await this.applyXp(userId, grantedXp);

      return grantedXp;
    });
  }

  async recalculateTenant() {
    const userIds = await this.gamificationRepository.findUserIdsWithGamificationEvents();
    const failedUserIds: UUIDType[] = [];

    // One failing user must not stop the backfill for everyone after them.
    for (const userId of userIds) {
      try {
        await this.evaluateUser(userId, null);
      } catch (error) {
        failedUserIds.push(userId);
        this.logger.error(
          `Gamification recalculation failed for user ${userId}`,
          error instanceof Error ? error.stack : String(error),
        );
      }
    }

    this.logger.log(`Recalculated gamification for ${userIds.length - failedUserIds.length} users`);

    if (failedUserIds.length > 0) {
      throw new Error(`Gamification recalculation failed for ${failedUserIds.length} users`);
    }
  }

  /** Seeds missing predefined achievements; returns how many were added so callers can backfill. */
  async ensurePredefinedAchievements() {
    return this.tenantDbRunnerService.transaction(async () => {
      let insertedCount = 0;

      for (const definition of PREDEFINED_ACHIEVEMENTS) {
        const achievementId =
          await this.gamificationRepository.insertPredefinedAchievement(definition);

        if (achievementId) insertedCount++;
      }

      return insertedCount;
    });
  }

  async getUserProfile(
    userId: UUIDType,
    language: SupportedLanguages,
  ): Promise<UserGamificationProfileResponse> {
    const [profile, achievements, recentRewards] = await Promise.all([
      this.gamificationRepository.findProfile(userId),
      this.gamificationRepository.findUserAchievements(userId, language),
      this.gamificationRepository.findRecentRewards(userId, language),
    ]);

    // Derived from lifetime XP so the response can never disagree with it.
    const level = getLevelFromXp(profile?.lifetimeXp ?? 0);

    return {
      userId,
      lifetimeXp: profile?.lifetimeXp ?? 0,
      spendableXp: profile?.spendableXp ?? 0,
      level,
      currentLevelXp: getXpRequiredForLevel(level),
      nextLevelXp: getXpRequiredForLevel(level + 1),
      achievements: await Promise.all(
        achievements.map(async (achievement) => ({
          ...achievement,
          levels: await Promise.all(
            achievement.levels.map(async ({ badgeImageKey, ...level }) => ({
              ...level,
              badgeImageUrl: badgeImageKey
                ? await this.fileService.getFileUrl(badgeImageKey)
                : null,
            })),
          ),
        })),
      ),
      recentRewards,
    };
  }

  private async applyXp(userId: UUIDType, xp: number) {
    const profile = await this.gamificationRepository.addXp(userId, xp);

    // ensureProfile ran in this transaction, so a missing row means a broken tenant context;
    // throwing rolls back the earned levels instead of keeping XP the profile never shows.
    if (!profile) throw new Error(`Gamification profile missing for user ${userId}`);

    const level = getLevelFromXp(profile.lifetimeXp);

    if (level > profile.level) await this.gamificationRepository.updateLevel(userId, level);
  }
}
