import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import {
  ACHIEVEMENT_BADGE_FILE_RESOURCE,
  ACHIEVEMENT_REQUIREMENT_TYPES,
  GAMIFICATION_EVENT_FILTERS,
  type LocalizedText,
  type SupportedLanguages,
} from "@repo/shared";

import { FileService } from "src/file/file.service";
import { findStorageKeyTenantId } from "src/file/utils/tenantStorageKey";
import { TenantDbRunnerService } from "src/storage/db/tenant-db-runner.service";

import { AchievementAdminRepository } from "./achievement-admin.repository";
import { GamificationQueueService } from "./gamification-queue.service";

import type { AchievementDefinitionInput } from "./gamification.types";
import type {
  AdminAchievement,
  AdminAchievementDetails,
  UpsertAchievementBody,
} from "./schemas/achievement-admin.schema";
import type { UUIDType } from "src/common";

type AchievementRow = Awaited<ReturnType<AchievementAdminRepository["findAchievements"]>>[number];

const withoutEmptyEntries = (text: LocalizedText): LocalizedText =>
  Object.fromEntries(
    Object.entries(text)
      .map(([language, value]) => [language, value?.trim()])
      .filter(([, value]) => value),
  );

@Injectable()
export class AchievementAdminService {
  constructor(
    private readonly achievementAdminRepository: AchievementAdminRepository,
    private readonly gamificationQueueService: GamificationQueueService,
    private readonly tenantDbRunnerService: TenantDbRunnerService,
    private readonly fileService: FileService,
  ) {}

  async getAchievements(language: SupportedLanguages): Promise<AdminAchievement[]> {
    const rows = await this.achievementAdminRepository.findAchievements(language);

    return Promise.all(
      rows.map(async (row) => ({
        ...(await this.toAdminAchievementBase(row)),
        title: row.localizedTitle,
        description: row.localizedDescription,
      })),
    );
  }

  async getAchievement(
    id: UUIDType,
    language: SupportedLanguages,
  ): Promise<AdminAchievementDetails> {
    const [row] = await this.achievementAdminRepository.findAchievements(language, id);

    if (!row) throw new NotFoundException("gamification.admin.toast.achievementNotFound");

    return {
      ...(await this.toAdminAchievementBase(row)),
      title: row.title,
      description: row.description,
      baseLanguage: row.baseLanguage,
    };
  }

  async createAchievement(body: UpsertAchievementBody, tenantId: UUIDType) {
    const definition = await this.toDefinition(body, tenantId);

    const id = await this.tenantDbRunnerService.transaction(async () => {
      const achievementId = await this.achievementAdminRepository.insertAchievement(definition);
      await this.achievementAdminRepository.replaceLevels(achievementId, definition.levels);

      return achievementId;
    });

    if (definition.isEnabled) await this.recalculate(tenantId);

    return { id };
  }

  /** Predefined achievements can only be enabled or disabled; their definitions ship with the app. */
  async updateAchievement(id: UUIDType, body: UpsertAchievementBody, tenantId: UUIDType) {
    const existing = await this.achievementAdminRepository.findAchievementKey(id);

    if (!existing) throw new NotFoundException("gamification.admin.toast.achievementNotFound");

    if (existing.key) {
      throw new BadRequestException("gamification.admin.toast.predefinedNotEditable");
    }

    const definition = await this.toDefinition(body, tenantId);

    await this.tenantDbRunnerService.transaction(async () => {
      // Earned levels are never revoked, so they cannot be removed from the definition.
      const highestEarnedLevel = await this.achievementAdminRepository.findHighestEarnedLevel(id);

      if (definition.levels.length < highestEarnedLevel) {
        throw new BadRequestException("gamification.admin.toast.earnedLevelRemoved");
      }

      await this.achievementAdminRepository.updateAchievement(id, definition);
      await this.achievementAdminRepository.replaceLevels(id, definition.levels);
      // A stricter definition would otherwise keep showing progress measured under the old rules.
      await this.achievementAdminRepository.deleteProgress(id);
    });

    if (definition.isEnabled) await this.recalculate(tenantId);
  }

  async updateAchievementStatus(id: UUIDType, isEnabled: boolean, tenantId: UUIDType) {
    const updated = await this.achievementAdminRepository.updateAchievementStatus(id, isEnabled);

    if (!updated) throw new NotFoundException("gamification.admin.toast.achievementNotFound");

    // Disabling only stops new progress; re-enabling backfills activity from the disabled period.
    if (isEnabled) await this.recalculate(tenantId);
  }

  private async toDefinition(
    body: UpsertAchievementBody,
    tenantId: UUIDType,
  ): Promise<AchievementDefinitionInput> {
    const title = withoutEmptyEntries(body.title);
    const description = withoutEmptyEntries(body.description);

    if (!title[body.baseLanguage]) {
      throw new BadRequestException("gamification.admin.toast.baseLanguageTitleRequired");
    }

    const allowedFilters: string[] = GAMIFICATION_EVENT_FILTERS[body.eventType];
    const usedFilters = Object.entries(body.filters).filter(([, value]) => value !== undefined);

    if (usedFilters.some(([key]) => !allowedFilters.includes(key))) {
      throw new BadRequestException("gamification.admin.toast.unsupportedFilter");
    }

    if (
      body.filters.courseId &&
      !(await this.achievementAdminRepository.courseExists(body.filters.courseId))
    ) {
      throw new BadRequestException("gamification.admin.toast.courseNotFound");
    }

    const isTimeWindow = body.requirementType === ACHIEVEMENT_REQUIREMENT_TYPES.TIME_WINDOW;

    if (isTimeWindow !== (body.windowDays !== null)) {
      throw new BadRequestException("gamification.admin.toast.invalidTimeWindow");
    }

    const isFirstTime = body.requirementType === ACHIEVEMENT_REQUIREMENT_TYPES.FIRST_TIME;
    const [firstLevel] = body.levels;

    if (isFirstTime && (body.levels.length !== 1 || firstLevel?.threshold !== 1)) {
      throw new BadRequestException("gamification.admin.toast.invalidFirstTimeLevels");
    }

    const hasAscendingThresholds = body.levels.every(
      (level, index) => index === 0 || level.threshold > body.levels[index - 1].threshold,
    );

    if (!hasAscendingThresholds) {
      throw new BadRequestException("gamification.admin.toast.thresholdsNotAscending");
    }

    const hasForeignBadge = body.levels.some(
      ({ badgeImageKey }) => badgeImageKey && !this.isTenantBadgeKey(badgeImageKey, tenantId),
    );

    if (hasForeignBadge) {
      throw new BadRequestException("gamification.admin.toast.invalidBadgeImage");
    }

    return {
      ...body,
      title,
      description,
      availableLocales: Object.keys(title) as SupportedLanguages[],
      filters: Object.fromEntries(usedFilters),
    };
  }

  private isTenantBadgeKey(key: string, tenantId: UUIDType) {
    return (
      findStorageKeyTenantId(key) === tenantId &&
      // Keys look like `<tenantId>/<resource>/...`, also for image variants.
      key.split("/")[1] === ACHIEVEMENT_BADGE_FILE_RESOURCE
    );
  }

  private async toAdminAchievementBase(row: AchievementRow) {
    return {
      id: row.id,
      isPredefined: row.key !== null,
      eventType: row.eventType,
      requirementType: row.requirementType,
      windowDays: row.windowDays,
      filters: row.filters,
      visibility: row.visibility,
      isEnabled: row.isEnabled,
      icon: row.icon,
      levels: await Promise.all(
        row.levels.map(async (level) => ({
          ...level,
          badgeImageUrl: level.badgeImageKey
            ? await this.fileService.getFileUrl(level.badgeImageKey)
            : null,
        })),
      ),
    };
  }

  private async recalculate(tenantId: UUIDType) {
    await this.gamificationQueueService.enqueueRecalculateTenant({ tenantId });
  }
}
