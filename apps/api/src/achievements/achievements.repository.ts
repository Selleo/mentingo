import { Inject, Injectable } from "@nestjs/common";
import { and, asc, desc, eq, type SQL } from "drizzle-orm";

import { DatabasePg } from "src/common";
import { buildJsonbField, setJsonbField } from "src/common/helpers/sqlHelpers";
import { LocalizationService } from "src/localization/localization.service";
import { DB } from "src/storage/db/db.providers";
import { achievementLevels, achievements, userAchievementLevels } from "src/storage/schema";

import type { CreateAchievement } from "./schema/createAchievement.schema";
import type { CreateAchievementLevel } from "./schema/createAchievementLevel.schema";
import type { UpdateAchievementLevel } from "./schema/updateAchievementLevel.schema";
import type { SupportedLanguages } from "@repo/shared";
import type { UUIDType } from "src/common";

@Injectable()
export class AchievementsRepository {
  constructor(
    @Inject(DB) private readonly db: DatabasePg,
    private readonly localizationService: LocalizationService,
  ) {}

  async getAchievementsList(conditions: SQL[]) {
    return this.db
      .select()
      .from(achievements)
      .where(and(...conditions))
      .orderBy(asc(achievements.title));
  }

  async getAchievementById(achievementId: UUIDType) {
    const [achievement] = await this.db
      .select()
      .from(achievements)
      .where(eq(achievements.id, achievementId));

    return achievement ?? null;
  }

  async insertAchievement(createAchievementBody: CreateAchievement) {
    const { language, title, visibility, isEnabled, triggerEventType } = createAchievementBody;

    const [row] = await this.db
      .insert(achievements)
      .values({
        title: buildJsonbField(language, title),
        visibility,
        isEnabled,
        triggerEventType,
        baseLanguage: language,
        availableLocales: [language],
      })
      .returning({ id: achievements.id, title: achievements.title });

    return row;
  }

  async updateAchievementById(achievementId: UUIDType, updateData: Record<string, unknown>) {
    const [row] = await this.db
      .update(achievements)
      .set(updateData)
      .where(eq(achievements.id, achievementId))
      .returning();

    return row ?? null;
  }

  async deleteAchievementById(achievementId: UUIDType) {
    const [row] = await this.db
      .delete(achievements)
      .where(eq(achievements.id, achievementId))
      .returning({ id: achievements.id });

    return row ?? null;
  }

  async updateAchievementLocales(
    achievementId: UUIDType,
    availableLocales: SupportedLanguages[],
    language: SupportedLanguages,
    title: string,
  ) {
    const titleUpdate = setJsonbField(achievements.title, language, title);

    await this.db
      .update(achievements)
      .set({
        availableLocales,
        ...(titleUpdate ? { title: titleUpdate } : {}),
      })
      .where(eq(achievements.id, achievementId));
  }

  async getAchievementLevelsByAchievementId(achievementId: UUIDType) {
    return this.db
      .select()
      .from(achievementLevels)
      .where(eq(achievementLevels.achievementId, achievementId))
      .orderBy(asc(achievementLevels.levelNumber));
  }

  async getAchievementLevelByNumber(achievementId: UUIDType, levelNumber: number) {
    const [row] = await this.db
      .select()
      .from(achievementLevels)
      .where(
        and(
          eq(achievementLevels.achievementId, achievementId),
          eq(achievementLevels.levelNumber, levelNumber),
        ),
      );

    return row ?? null;
  }

  async getHighestLevelNumber(achievementId: UUIDType) {
    const [highestLevel] = await this.db
      .select({ levelNumber: achievementLevels.levelNumber })
      .from(achievementLevels)
      .where(eq(achievementLevels.achievementId, achievementId))
      .orderBy(desc(achievementLevels.levelNumber))
      .limit(1);

    return highestLevel?.levelNumber ?? 0;
  }

  async insertAchievementLevel(
    createAchievementLevelBody: CreateAchievementLevel,
    achievementId: UUIDType,
    levelNumber: number,
  ) {
    const [row] = await this.db
      .insert(achievementLevels)
      .values({ ...createAchievementLevelBody, levelNumber, achievementId })
      .returning({ id: achievementLevels.id });

    return row;
  }

  async updateAchievementLevel(
    updateAchievementLevelBody: UpdateAchievementLevel,
    achievementId: UUIDType,
    levelNumber: number,
  ) {
    const [row] = await this.db
      .update(achievementLevels)
      .set({ ...updateAchievementLevelBody })
      .where(
        and(
          eq(achievementLevels.achievementId, achievementId),
          eq(achievementLevels.levelNumber, levelNumber),
        ),
      )
      .returning({ id: achievementLevels.id });

    return row ?? null;
  }

  async deleteAchievementLevel(achievementId: UUIDType, levelNumber: number) {
    const [row] = await this.db
      .delete(achievementLevels)
      .where(
        and(
          eq(achievementLevels.achievementId, achievementId),
          eq(achievementLevels.levelNumber, levelNumber),
        ),
      )
      .returning({ id: achievementLevels.id });

    return row ?? null;
  }

  async getUserAchievements(userId: UUIDType, language?: SupportedLanguages) {
    return this.db
      .select({
        achievementId: achievements.id,
        achievementTitle: this.localizationService.getLocalizedSqlField(
          achievements.title,
          language ?? "en",
          achievements,
        ),
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
      .where(eq(userAchievementLevels.userId, userId));
  }
}
