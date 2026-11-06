import { Inject, Injectable } from "@nestjs/common";
import {
  ACHIEVEMENT_REQUIREMENT_TYPES,
  ACHIEVEMENT_VISIBILITY,
  XP_TRANSACTION_TYPES,
  type SupportedLanguages,
} from "@repo/shared";
import { and, asc, desc, eq, inArray, isNull, sql, type SQL } from "drizzle-orm";

import { DatabasePg } from "src/common";
import { buildJsonbFieldWithMultipleEntries } from "src/common/helpers/sqlHelpers";
import { LocalizationService } from "src/localization/localization.service";
import { DB } from "src/storage/db/db.providers";
import {
  achievementLevels,
  achievements,
  GAMIFICATION_OUTBOX_EVENT_TYPES,
  OUTBOX_EVENT_USER_ID_SQL,
  outboxEvents,
  userAchievementLevels,
  userAchievementProgress,
  userGamificationProfiles,
  users,
  xpTransactions,
} from "src/storage/schema";

import { GAMIFICATION_EVENT_SOURCES, RECENT_REWARDS_LIMIT } from "./gamification.constants";

import type { EvaluableAchievement, PredefinedAchievement } from "./gamification.types";
import type { UUIDType } from "src/common";

// Same expression as the partial index on outbox_events, so per-user lookups stay indexed.
const outboxEventUserId = sql.raw(OUTBOX_EVENT_USER_ID_SQL);

const outboxPayloadText = (path: string[]) =>
  sql`${outboxEvents.payload} #>> ARRAY[${sql.join(
    path.map((segment) => sql`${segment}`),
    sql`, `,
  )}]::text[]`;

const outboxEventDay = sql`(${outboxEvents.createdAt} AT TIME ZONE 'UTC')::date`;

@Injectable()
export class GamificationRepository {
  constructor(
    @Inject(DB) private readonly db: DatabasePg,
    private readonly localizationService: LocalizationService,
  ) {}

  async findActiveUser(userId: UUIDType) {
    const [user] = await this.db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.id, userId), isNull(users.deletedAt), eq(users.archived, false)));

    return user ?? null;
  }

  async findUserIdsWithGamificationEvents() {
    const rows = await this.db
      .selectDistinct({ userId: users.id })
      .from(outboxEvents)
      .innerJoin(users, sql`${users.id}::text = ${outboxEventUserId}`)
      .where(
        and(
          inArray(outboxEvents.eventType, [...GAMIFICATION_OUTBOX_EVENT_TYPES]),
          isNull(users.deletedAt),
          eq(users.archived, false),
        ),
      );

    return rows.map(({ userId }) => userId);
  }

  async findEvaluableAchievements(includeHidden: boolean): Promise<EvaluableAchievement[]> {
    const rows = await this.db
      .select({
        id: achievements.id,
        eventType: achievements.eventType,
        requirementType: achievements.requirementType,
        filters: achievements.filters,
        levels: sql<EvaluableAchievement["levels"]>`
          COALESCE(
            json_agg(
              json_build_object(
                'id', ${achievementLevels.id},
                'level', ${achievementLevels.level},
                'threshold', ${achievementLevels.threshold},
                'xpReward', ${achievementLevels.xpReward}
              ) ORDER BY ${achievementLevels.level}
            ) FILTER (WHERE ${achievementLevels.id} IS NOT NULL),
            '[]'::json
          )
        `,
      })
      .from(achievements)
      .leftJoin(achievementLevels, eq(achievementLevels.achievementId, achievements.id))
      .where(
        and(
          eq(achievements.isEnabled, true),
          includeHidden ? undefined : eq(achievements.visibility, ACHIEVEMENT_VISIBILITY.VISIBLE),
        ),
      )
      .groupBy(achievements.id);

    return rows;
  }

  /** Measures an achievement straight from outbox events, ignoring support-mode activity. */
  async measureAchievement(userId: UUIDType, achievement: EvaluableAchievement): Promise<number> {
    const source = GAMIFICATION_EVENT_SOURCES[achievement.eventType];
    const { courseId, minScore } = achievement.filters;

    // Inlined as a literal so the planner can match the partial index predicate.
    const eventTypeLiteral = `'${source.outboxEventType}'`;

    const conditions: SQL[] = [
      sql`${outboxEvents.eventType} = ${sql.raw(eventTypeLiteral)}`,
      sql`${outboxEventUserId} = ${userId}`,
      sql`COALESCE((${outboxPayloadText(source.supportModePath)})::boolean, false) = false`,
    ];

    if (courseId && source.courseIdPath) {
      conditions.push(sql`${outboxPayloadText(source.courseIdPath)} = ${courseId}`);
    }

    if (minScore !== undefined && source.scorePath) {
      conditions.push(sql`(${outboxPayloadText(source.scorePath)})::numeric >= ${minScore}`);
    }

    const where = and(...conditions);

    if (achievement.requirementType === ACHIEVEMENT_REQUIREMENT_TYPES.STREAK) {
      return this.measureLongestDailyStreak(where);
    }

    const subject = source.subjectPath ? outboxPayloadText(source.subjectPath) : outboxEventDay;

    const [row] = await this.db
      .select({ value: sql<number>`COUNT(DISTINCT ${subject})::int` })
      .from(outboxEvents)
      .where(where);

    return row?.value ?? 0;
  }

  async upsertProgress(userId: UUIDType, achievementId: UUIDType, value: number) {
    await this.db
      .insert(userAchievementProgress)
      .values({ userId, achievementId, value })
      .onConflictDoUpdate({
        target: [userAchievementProgress.userId, userAchievementProgress.achievementId],
        // Additive only: progress never goes down.
        set: {
          value: sql`GREATEST(${userAchievementProgress.value}, excluded.value)`,
          updatedAt: sql`now()`,
        },
      });
  }

  /** Returns the new row id, or null when the level was already earned. */
  async insertEarnedLevel(
    userId: UUIDType,
    achievementLevelId: UUIDType,
    sourceEventId: UUIDType | null,
  ) {
    const [row] = await this.db
      .insert(userAchievementLevels)
      .values({ userId, achievementLevelId, sourceEventId })
      .onConflictDoNothing()
      .returning({ id: userAchievementLevels.id });

    return row?.id ?? null;
  }

  async insertAchievementXpTransaction(userId: UUIDType, sourceId: UUIDType, xp: number) {
    const [row] = await this.db
      .insert(xpTransactions)
      .values({
        userId,
        sourceId,
        type: XP_TRANSACTION_TYPES.ACHIEVEMENT_LEVEL,
        lifetimeDelta: xp,
        spendableDelta: xp,
      })
      .onConflictDoNothing()
      .returning({ id: xpTransactions.id });

    return Boolean(row);
  }

  async ensureProfile(userId: UUIDType) {
    await this.db.insert(userGamificationProfiles).values({ userId }).onConflictDoNothing();
  }

  async addXp(userId: UUIDType, xp: number) {
    const [row] = await this.db
      .update(userGamificationProfiles)
      .set({
        lifetimeXp: sql`${userGamificationProfiles.lifetimeXp} + ${xp}`,
        spendableXp: sql`${userGamificationProfiles.spendableXp} + ${xp}`,
        updatedAt: sql`now()`,
      })
      .where(eq(userGamificationProfiles.userId, userId))
      .returning({
        lifetimeXp: userGamificationProfiles.lifetimeXp,
        level: userGamificationProfiles.level,
      });

    return row;
  }

  async updateLevel(userId: UUIDType, level: number) {
    await this.db
      .update(userGamificationProfiles)
      .set({ level, updatedAt: sql`now()` })
      .where(eq(userGamificationProfiles.userId, userId));
  }

  async findProfile(userId: UUIDType) {
    const [profile] = await this.db
      .select({
        lifetimeXp: userGamificationProfiles.lifetimeXp,
        spendableXp: userGamificationProfiles.spendableXp,
        level: userGamificationProfiles.level,
      })
      .from(userGamificationProfiles)
      .where(eq(userGamificationProfiles.userId, userId));

    return profile ?? null;
  }

  /** Enabled visible achievements plus any achievement the user has already earned. */
  async findUserAchievements(userId: UUIDType, language: SupportedLanguages) {
    const isEarned = sql`bool_or(${userAchievementLevels.id} IS NOT NULL)`;

    return this.db
      .select({
        id: achievements.id,
        title: this.localizationService.getLocalizedSqlField(
          achievements.title,
          language,
          achievements,
        ),
        description: this.localizationService.getLocalizedSqlField(
          achievements.description,
          language,
          achievements,
        ),
        eventType: achievements.eventType,
        requirementType: achievements.requirementType,
        visibility: achievements.visibility,
        progress: sql<number>`COALESCE(${userAchievementProgress.value}, 0)`,
        levels: sql<
          { level: number; threshold: number; xpReward: number; earnedAt: string | null }[]
        >`json_agg(json_build_object(
            'level', ${achievementLevels.level},
            'threshold', ${achievementLevels.threshold},
            'xpReward', ${achievementLevels.xpReward},
            'earnedAt', ${userAchievementLevels.createdAt}
          ) ORDER BY ${achievementLevels.level})`,
      })
      .from(achievements)
      .innerJoin(achievementLevels, eq(achievementLevels.achievementId, achievements.id))
      .leftJoin(
        userAchievementLevels,
        and(
          eq(userAchievementLevels.achievementLevelId, achievementLevels.id),
          eq(userAchievementLevels.userId, userId),
        ),
      )
      .leftJoin(
        userAchievementProgress,
        and(
          eq(userAchievementProgress.achievementId, achievements.id),
          eq(userAchievementProgress.userId, userId),
        ),
      )
      .groupBy(achievements.id, userAchievementProgress.value)
      .having(
        sql`${isEarned} OR (${achievements.isEnabled} AND ${achievements.visibility} = ${ACHIEVEMENT_VISIBILITY.VISIBLE})`,
      )
      .orderBy(asc(achievements.createdAt), asc(achievements.id));
  }

  async findRecentRewards(userId: UUIDType, language: SupportedLanguages) {
    return this.db
      .select({
        id: userAchievementLevels.id,
        achievementId: achievements.id,
        achievementTitle: this.localizationService.getLocalizedSqlField(
          achievements.title,
          language,
          achievements,
        ),
        level: achievementLevels.level,
        xpReward: achievementLevels.xpReward,
        earnedAt: userAchievementLevels.createdAt,
      })
      .from(userAchievementLevels)
      .innerJoin(
        achievementLevels,
        eq(achievementLevels.id, userAchievementLevels.achievementLevelId),
      )
      .innerJoin(achievements, eq(achievements.id, achievementLevels.achievementId))
      .where(eq(userAchievementLevels.userId, userId))
      .orderBy(desc(userAchievementLevels.createdAt), desc(achievementLevels.level))
      .limit(RECENT_REWARDS_LIMIT);
  }

  /** Returns the inserted achievement id, or null when the tenant already has this key. */
  async insertPredefinedAchievement(definition: PredefinedAchievement) {
    const [row] = await this.db
      .insert(achievements)
      .values({
        key: definition.key,
        title: buildJsonbFieldWithMultipleEntries(definition.title),
        description: buildJsonbFieldWithMultipleEntries(definition.description),
        eventType: definition.eventType,
        requirementType: definition.requirementType,
        // The text cast keeps postgres.js from encoding the JSON parameter as a JSONB string.
        filters: sql`${JSON.stringify(definition.filters)}::text::jsonb`,
        visibility: definition.visibility,
        availableLocales: Object.keys(definition.title) as SupportedLanguages[],
      })
      .onConflictDoNothing({ target: [achievements.tenantId, achievements.key] })
      .returning({ id: achievements.id });

    if (!row) return null;

    await this.db
      .insert(achievementLevels)
      .values(definition.levels.map((level) => ({ ...level, achievementId: row.id })));

    return row.id;
  }

  private async measureLongestDailyStreak(where: SQL | undefined) {
    const days = this.db
      .selectDistinct({ day: sql<string>`${outboxEventDay}`.as("day") })
      .from(outboxEvents)
      .where(where)
      .as("days");

    // Consecutive days share the same (day - row_number) value.
    const runs = this.db
      .select({ run: sql<number>`COUNT(*)`.as("run") })
      .from(
        this.db
          .select({
            grp: sql`${days.day} - (ROW_NUMBER() OVER (ORDER BY ${days.day}))::int`.as("grp"),
          })
          .from(days)
          .as("grouped"),
      )
      .groupBy(sql`grp`)
      .as("runs");

    const [row] = await this.db
      .select({ value: sql<number>`COALESCE(MAX(${runs.run}), 0)::int` })
      .from(runs);

    return row?.value ?? 0;
  }
}
