import { Inject, Injectable, Logger } from "@nestjs/common";
import { and, eq } from "drizzle-orm";

import { DatabasePg } from "src/common";
import { LocalizationService } from "src/localization/localization.service";
import { OutboxRepository } from "src/outbox/outbox.repository";
import { SettingsService } from "src/settings/settings.service";
import { DB } from "src/storage/db/db.providers";
import { achievementLevels, achievements, activityLogs, userStatistics } from "src/storage/schema";

import { GamificationRepository } from "./gamification.repository";

import type { GamificationEventPayload } from "src/websocket";

@Injectable()
export class GamificationHandler {
  private readonly logger = new Logger(GamificationHandler.name);

  constructor(
    @Inject(DB) private readonly db: DatabasePg,
    private readonly gamificationRepository: GamificationRepository,
    private readonly localizationService: LocalizationService,
    private readonly settingsService: SettingsService,
    private readonly outboxRepository: OutboxRepository,
  ) {}

  async handle(event: GamificationEventPayload): Promise<void> {
    const userSettings = this.settingsService.getUserSettings(event.userId);
    const userLanguage = (await userSettings).language;

    if (!event.resourceType) throw new Error("common.error");
    if (!event.userId) throw new Error("common.error");

    const isFirstProcessing = await this.outboxRepository.markProcessedOrSkip(
      event.sourceId,
      event.tenantId,
      this.db,
    );

    if (!isFirstProcessing) {
      this.logger.warn(`Event ${event.sourceId} already processed`);
      return;
    }

    const achievementsList = await this.db
      .select()
      .from(achievements)
      .where(
        and(
          eq(achievements.tenantId, event.tenantId),
          eq(achievements.triggerEventType, event.resourceType),
          eq(achievements.isEnabled, true),
          ...(event.actorRole === "admin" ? [eq(achievements.visibility, "visible")] : []),
        ),
      );

    for (const achievement of achievementsList) {
      const allAchievementLevels = await this.db
        .select({
          id: achievementLevels.id,
          levelNumber: achievementLevels.levelNumber,
          threshold: achievementLevels.threshold,
          xpReward: achievementLevels.xpReward,
          achievementName: this.localizationService.getLocalizedSqlField(
            achievements.key,
            userLanguage,
            achievements,
          ),
        })
        .from(achievementLevels)
        .innerJoin(achievements, eq(achievementLevels.achievementId, achievements.id))
        .where(eq(achievementLevels.achievementId, achievement.id));

      if (event.resourceType == "user" && event.actionType == "login") {
        const [userStrike] = await this.db
          .select({
            currentStrike: userStatistics.currentStreak,
          })
          .from(userStatistics)
          .where(eq(userStatistics.userId, event.userId));
        const currentStreak = userStrike.currentStrike;
        await this.gamificationRepository.createUsersMissingAchievements({
          achievementLevels: allAchievementLevels,
          actualThreshold: currentStreak,
          event,
        });
      } else if (event.resourceType == "lesson" && event.actionType == "complete_lesson") {
        const completedLessons = await this.db
          .select()
          .from(activityLogs)
          .where(
            and(
              eq(activityLogs.actorId, event.userId),
              eq(activityLogs.actionType, "complete_lesson"),
            ),
          );
        const countOfCompletedLessons = completedLessons.length;
        await this.gamificationRepository.createUsersMissingAchievements({
          achievementLevels: allAchievementLevels,
          actualThreshold: countOfCompletedLessons,
          event,
        });
      } else if (event.resourceType == "chapter" && event.actionType == "complete_chapter") {
        const completedChapters = await this.db
          .select()
          .from(activityLogs)
          .where(
            and(
              eq(activityLogs.actorId, event.userId),
              eq(activityLogs.actionType, "complete_chapter"),
            ),
          );
        const countOfCompletedChapters = completedChapters.length;
        await this.gamificationRepository.createUsersMissingAchievements({
          achievementLevels: allAchievementLevels,
          actualThreshold: countOfCompletedChapters,
          event,
        });
      } else if (event.resourceType == "course" && event.actionType == "complete_course") {
        const completedCourses = await this.db
          .select()
          .from(activityLogs)
          .where(
            and(
              eq(activityLogs.actorId, event.userId),
              eq(activityLogs.actionType, "complete_course"),
            ),
          );
        const countOfCompletedCourses = completedCourses.length;
        await this.gamificationRepository.createUsersMissingAchievements({
          achievementLevels: allAchievementLevels,
          actualThreshold: countOfCompletedCourses,
          event,
        });
      }
    }
  }
}
