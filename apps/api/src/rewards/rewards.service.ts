import { Injectable, Inject, NotFoundException } from "@nestjs/common";
import {
  DEFAULT_REWARD_RULE_POINTS,
  ENTITY_TYPES,
  REWARD_ACTION_TYPES,
  REWARD_SOURCE_ENTITY_TYPES,
  REWARDS_SOCKET_EVENTS,
  type RewardActionType,
  type RewardSourceEntityType,
} from "@repo/shared";
import { and, asc, eq, isNotNull, sql } from "drizzle-orm";

import { DatabasePg, type UUIDType } from "src/common";
import { RESOURCE_RELATIONSHIP_TYPES } from "src/file/file.constants";
import { FileService } from "src/file/file.service";
import {
  aiMentorStudentLessonProgress,
  chapters,
  groups,
  resourceEntity,
  rewardAchievements,
  rewardPointLedger,
  rewardRules,
  studentChapterProgress,
  studentCourses,
  studentLessonProgress,
  userRewardAchievements,
  userRewardTotals,
} from "src/storage/schema";
import { WsGateway } from "src/websocket";

import type { UpdateRewardRuleBody, UpsertRewardAchievementBody } from "src/rewards/rewards.schema";

type RewardGrantInput = {
  userId: UUIDType;
  actionType: RewardActionType;
  sourceEntityType: RewardSourceEntityType;
  sourceEntityId: UUIDType;
  metadata?: Record<string, unknown>;
  awardedAt?: string;
  notify?: boolean;
};

type LeaderboardEntry = {
  userId: UUIDType;
  firstName: string;
  lastName: string;
  profilePictureUrl: string | null;
  totalPoints: number;
  rank: number;
};

@Injectable()
export class RewardsService {
  constructor(
    @Inject("DB") private readonly db: DatabasePg,
    private readonly fileService: FileService,
    private readonly wsGateway: WsGateway,
  ) {}

  async getRules() {
    await this.ensureDefaultRules();

    return this.db
      .select({
        id: rewardRules.id,
        actionType: rewardRules.actionType,
        points: rewardRules.points,
        enabled: rewardRules.enabled,
        createdAt: rewardRules.createdAt,
        updatedAt: rewardRules.updatedAt,
      })
      .from(rewardRules)
      .orderBy(asc(rewardRules.actionType));
  }

  async updateRule(actionType: RewardActionType, body: UpdateRewardRuleBody) {
    await this.ensureDefaultRules();

    const [updated] = await this.db
      .update(rewardRules)
      .set({ points: body.points, enabled: body.enabled })
      .where(eq(rewardRules.actionType, actionType))
      .returning();

    if (!updated) throw new NotFoundException("Reward rule not found");

    return updated;
  }

  async getAchievements(includeArchived = false) {
    const rows = await this.db
      .select()
      .from(rewardAchievements)
      .where(includeArchived ? undefined : eq(rewardAchievements.archived, false))
      .orderBy(asc(rewardAchievements.sortOrder), asc(rewardAchievements.pointThreshold));

    return Promise.all(rows.map((achievement) => this.decorateAchievement(achievement)));
  }

  async createAchievement(body: UpsertRewardAchievementBody) {
    const [created] = await this.db.transaction(async (trx) => {
      const [achievement] = await trx
        .insert(rewardAchievements)
        .values({
          title: body.title,
          description: body.description,
          pointThreshold: body.pointThreshold,
          sortOrder: body.sortOrder ?? 0,
        })
        .returning();

      if (achievement && body.iconResourceId) {
        await this.setAchievementIcon(achievement.id, body.iconResourceId, trx);
      }

      return [achievement];
    });

    if (!created) throw new NotFoundException("Reward achievement not created");

    return this.decorateAchievement(created);
  }

  async updateAchievement(achievementId: UUIDType, body: UpsertRewardAchievementBody) {
    const [updated] = await this.db.transaction(async (trx) => {
      const [achievement] = await trx
        .update(rewardAchievements)
        .set({
          title: body.title,
          description: body.description,
          pointThreshold: body.pointThreshold,
          sortOrder: body.sortOrder ?? 0,
        })
        .where(eq(rewardAchievements.id, achievementId))
        .returning();

      if (!achievement) return [];

      if (body.iconResourceId !== undefined) {
        await this.setAchievementIcon(achievementId, body.iconResourceId, trx);
      }

      return [achievement];
    });

    if (!updated) throw new NotFoundException("Reward achievement not found");

    return this.decorateAchievement(updated);
  }

  async archiveAchievement(achievementId: UUIDType) {
    const [updated] = await this.db
      .update(rewardAchievements)
      .set({ archived: true })
      .where(eq(rewardAchievements.id, achievementId))
      .returning();

    if (!updated) throw new NotFoundException("Reward achievement not found");

    return this.decorateAchievement(updated);
  }

  async getProfile(userId: UUIDType) {
    const totalPoints = await this.getTotalPoints(userId);
    const achievementRows = await this.db
      .select({
        id: rewardAchievements.id,
        title: rewardAchievements.title,
        description: rewardAchievements.description,
        pointThreshold: rewardAchievements.pointThreshold,
        sortOrder: rewardAchievements.sortOrder,
        createdAt: rewardAchievements.createdAt,
        updatedAt: rewardAchievements.updatedAt,
        archived: rewardAchievements.archived,
        earnedAt: userRewardAchievements.earnedAt,
      })
      .from(rewardAchievements)
      .leftJoin(
        userRewardAchievements,
        and(
          eq(userRewardAchievements.achievementId, rewardAchievements.id),
          eq(userRewardAchievements.userId, userId),
        ),
      )
      .where(eq(rewardAchievements.archived, false))
      .orderBy(asc(rewardAchievements.sortOrder), asc(rewardAchievements.pointThreshold));

    const achievements = await Promise.all(
      achievementRows.map(async (achievement) => {
        const decorated = await this.decorateAchievement(achievement);

        return {
          id: decorated.id,
          title: decorated.title,
          description: decorated.description,
          pointThreshold: decorated.pointThreshold,
          pointsRequired: Math.max(decorated.pointThreshold - totalPoints, 0),
          earnedAt: achievement.earnedAt,
          iconResourceId: decorated.iconResourceId,
          iconUrl: decorated.iconUrl,
        };
      }),
    );

    return { userId, totalPoints, achievements };
  }

  async getLeaderboard(currentUserId: UUIDType, groupId?: UUIDType) {
    const groupFilter = groupId
      ? sql`AND EXISTS (
          SELECT 1 FROM group_users gu
          WHERE gu.user_id = ranked.user_id AND gu.group_id = ${groupId}
        )`
      : sql``;

    const rows = await this.db.execute<LeaderboardEntry>(sql`
      WITH ranked AS (
        SELECT
          u.id AS "userId",
          u.first_name AS "firstName",
          u.last_name AS "lastName",
          u.avatar_reference AS "profilePictureUrl",
          COALESCE(urt.total_points, 0)::integer AS "totalPoints",
          RANK() OVER (ORDER BY COALESCE(urt.total_points, 0) DESC)::integer AS rank,
          urt.updated_at AS total_updated_at
        FROM users u
        LEFT JOIN user_reward_totals urt ON urt.user_id = u.id
        WHERE u.archived = false
          AND u.deleted_at IS NULL
      )
      SELECT "userId", "firstName", "lastName", "profilePictureUrl", "totalPoints", rank
      FROM ranked
      WHERE true ${groupFilter}
      ORDER BY "totalPoints" DESC, total_updated_at ASC NULLS LAST, "lastName" ASC, "firstName" ASC
      LIMIT 10
    `);

    const entries = Array.from(rows);
    const currentUserRank = await this.getCurrentUserRank(currentUserId, groupId);

    return {
      groupId: groupId ?? null,
      entries,
      currentUserRank: entries.some((entry) => entry.userId === currentUserId)
        ? null
        : currentUserRank,
    };
  }

  async getGroups() {
    return this.db
      .select({ id: groups.id, name: groups.name })
      .from(groups)
      .orderBy(asc(groups.name));
  }

  async getPointsByDay(userId: UUIDType, days = 30) {
    const safeDays = Math.min(Math.max(Math.trunc(days) || 30, 1), 90);
    const rows = await this.db
      .select({
        date: sql<string>`to_char(${rewardPointLedger.awardedAt}::date, 'YYYY-MM-DD')`,
        points: sql<number>`sum(${rewardPointLedger.points})::integer`,
      })
      .from(rewardPointLedger)
      .where(
        and(
          eq(rewardPointLedger.userId, userId),
          sql`${rewardPointLedger.awardedAt} >= CURRENT_DATE - (${safeDays - 1} * INTERVAL '1 day')`,
        ),
      )
      .groupBy(sql`${rewardPointLedger.awardedAt}::date`)
      .orderBy(sql`${rewardPointLedger.awardedAt}::date`);

    const pointsByDate = new Map(rows.map((row) => [row.date, row.points]));
    const today = new Date();

    return Array.from({ length: safeDays }, (_, index) => {
      const date = new Date(today);
      date.setDate(today.getDate() - (safeDays - 1 - index));
      const key = date.toISOString().slice(0, 10);

      return { date: key, points: pointsByDate.get(key) ?? 0 };
    });
  }

  async grantPoints(input: RewardGrantInput, dbInstance: DatabasePg = this.db) {
    await this.ensureDefaultRules();

    const [rule] = await dbInstance
      .select()
      .from(rewardRules)
      .where(and(eq(rewardRules.actionType, input.actionType), eq(rewardRules.enabled, true)));

    if (!rule || rule.points <= 0) return null;

    const [ledgerEntry] = await dbInstance
      .insert(rewardPointLedger)
      .values({
        userId: input.userId,
        actionType: input.actionType,
        sourceEntityType: input.sourceEntityType,
        sourceEntityId: input.sourceEntityId,
        points: rule.points,
        ruleId: rule.id,
        metadata: input.metadata ?? {},
        ...(input.awardedAt ? { awardedAt: input.awardedAt } : {}),
      })
      .onConflictDoNothing()
      .returning();

    if (!ledgerEntry) return null;

    const totalPoints = await this.incrementTotal(input.userId, rule.points, dbInstance);
    const earnedAchievements = await this.grantNewAchievements(
      input.userId,
      totalPoints,
      dbInstance,
    );

    if (input.notify ?? true) {
      this.wsGateway.emitToUser(input.userId, REWARDS_SOCKET_EVENTS.UPDATED, {
        actionType: input.actionType,
        pointsAwarded: rule.points,
        totalPoints,
        earnedAchievementIds: earnedAchievements.map((achievement) => achievement.id),
      });
    }

    return { ledgerEntry, totalPoints, earnedAchievements };
  }

  async backfillCurrentTenant() {
    await this.ensureDefaultRules();

    let chapterGrants = 0;
    let aiConversationGrants = 0;
    let courseGrants = 0;

    const completedChapters = await this.db
      .select({
        userId: studentChapterProgress.studentId,
        courseId: studentChapterProgress.courseId,
        chapterId: studentChapterProgress.chapterId,
        awardedAt: studentChapterProgress.completedAt,
      })
      .from(studentChapterProgress)
      .where(isNotNull(studentChapterProgress.completedAt));

    for (const row of completedChapters) {
      const grant = await this.grantPoints({
        userId: row.userId,
        actionType: REWARD_ACTION_TYPES.CHAPTER_COMPLETED,
        sourceEntityType: REWARD_SOURCE_ENTITY_TYPES.CHAPTER,
        sourceEntityId: row.chapterId,
        metadata: { courseId: row.courseId },
        awardedAt: row.awardedAt ?? undefined,
        notify: false,
      });

      if (grant) chapterGrants += 1;
    }

    const passedAiLessons = await this.db
      .select({
        userId: studentLessonProgress.studentId,
        courseId: chapters.courseId,
        lessonId: studentLessonProgress.lessonId,
        awardedAt: sql<string>`COALESCE(
          ${studentLessonProgress.completedAt},
          ${aiMentorStudentLessonProgress.updatedAt}
        )`,
      })
      .from(studentLessonProgress)
      .innerJoin(
        aiMentorStudentLessonProgress,
        eq(aiMentorStudentLessonProgress.studentLessonProgressId, studentLessonProgress.id),
      )
      .innerJoin(chapters, eq(chapters.id, studentLessonProgress.chapterId))
      .where(eq(aiMentorStudentLessonProgress.passed, true));

    for (const row of passedAiLessons) {
      const grant = await this.grantPoints({
        userId: row.userId,
        actionType: REWARD_ACTION_TYPES.AI_CONVERSATION_PASSED,
        sourceEntityType: REWARD_SOURCE_ENTITY_TYPES.LESSON,
        sourceEntityId: row.lessonId,
        metadata: { courseId: row.courseId },
        awardedAt: row.awardedAt ?? undefined,
        notify: false,
      });

      if (grant) aiConversationGrants += 1;
    }

    const completedCourses = await this.db
      .select({
        userId: studentCourses.studentId,
        courseId: studentCourses.courseId,
        awardedAt: studentCourses.completedAt,
      })
      .from(studentCourses)
      .where(isNotNull(studentCourses.completedAt));

    for (const row of completedCourses) {
      const grant = await this.grantPoints({
        userId: row.userId,
        actionType: REWARD_ACTION_TYPES.COURSE_COMPLETED,
        sourceEntityType: REWARD_SOURCE_ENTITY_TYPES.COURSE,
        sourceEntityId: row.courseId,
        awardedAt: row.awardedAt ?? undefined,
        notify: false,
      });

      if (grant) courseGrants += 1;
    }

    return { chapterGrants, aiConversationGrants, courseGrants };
  }

  private async ensureDefaultRules() {
    await this.db
      .insert(rewardRules)
      .values(
        Object.entries(DEFAULT_REWARD_RULE_POINTS).map(([actionType, points]) => ({
          actionType: actionType as RewardActionType,
          points,
          enabled: true,
        })),
      )
      .onConflictDoNothing();
  }

  private async incrementTotal(userId: UUIDType, points: number, dbInstance: DatabasePg) {
    const [total] = await dbInstance
      .insert(userRewardTotals)
      .values({ userId, totalPoints: points })
      .onConflictDoUpdate({
        target: [userRewardTotals.tenantId, userRewardTotals.userId],
        set: {
          totalPoints: sql`${userRewardTotals.totalPoints} + ${points}`,
          updatedAt: sql`CURRENT_TIMESTAMP`,
        },
      })
      .returning({ totalPoints: userRewardTotals.totalPoints });

    return total?.totalPoints ?? points;
  }

  private async grantNewAchievements(
    userId: UUIDType,
    totalPoints: number,
    dbInstance: DatabasePg,
  ) {
    const availableAchievements = await dbInstance
      .select()
      .from(rewardAchievements)
      .where(
        and(
          eq(rewardAchievements.archived, false),
          sql`${rewardAchievements.pointThreshold} <= ${totalPoints}`,
        ),
      );

    if (!availableAchievements.length) return [];

    const inserted = await dbInstance
      .insert(userRewardAchievements)
      .values(
        availableAchievements.map((achievement) => ({
          userId,
          achievementId: achievement.id,
          pointTotalAtEarn: totalPoints,
          thresholdAtEarn: achievement.pointThreshold,
        })),
      )
      .onConflictDoNothing()
      .returning({ id: userRewardAchievements.achievementId });

    return inserted;
  }

  private async getTotalPoints(userId: UUIDType) {
    const [total] = await this.db
      .select({ totalPoints: userRewardTotals.totalPoints })
      .from(userRewardTotals)
      .where(eq(userRewardTotals.userId, userId));

    return total?.totalPoints ?? 0;
  }

  private async getCurrentUserRank(currentUserId: UUIDType, groupId?: UUIDType) {
    const groupFilter = groupId
      ? sql`AND EXISTS (
          SELECT 1 FROM group_users gu
          WHERE gu.user_id = ranked.user_id AND gu.group_id = ${groupId}
        )`
      : sql``;

    const rows = await this.db.execute<LeaderboardEntry>(sql`
      WITH ranked AS (
        SELECT
          u.id AS "userId",
          u.first_name AS "firstName",
          u.last_name AS "lastName",
          u.avatar_reference AS "profilePictureUrl",
          COALESCE(urt.total_points, 0)::integer AS "totalPoints",
          RANK() OVER (ORDER BY COALESCE(urt.total_points, 0) DESC)::integer AS rank
        FROM users u
        LEFT JOIN user_reward_totals urt ON urt.user_id = u.id
        WHERE u.archived = false
          AND u.deleted_at IS NULL
      )
      SELECT "userId", "firstName", "lastName", "profilePictureUrl", "totalPoints", rank
      FROM ranked
      WHERE "userId" = ${currentUserId} ${groupFilter}
      LIMIT 1
    `);

    return Array.from(rows)[0] ?? null;
  }

  private async decorateAchievement<T extends { id: UUIDType }>(achievement: T) {
    const [icon] = await this.fileService.getResourcesForEntity(
      achievement.id,
      ENTITY_TYPES.REWARD_ACHIEVEMENT,
      RESOURCE_RELATIONSHIP_TYPES.ICON,
    );

    return {
      ...achievement,
      iconResourceId: icon?.id ?? null,
      iconUrl: icon?.fileUrl ?? null,
    };
  }

  private async setAchievementIcon(
    achievementId: UUIDType,
    resourceId: UUIDType | null,
    dbInstance: DatabasePg,
  ) {
    await dbInstance
      .delete(resourceEntity)
      .where(
        and(
          eq(resourceEntity.entityId, achievementId),
          eq(resourceEntity.entityType, ENTITY_TYPES.REWARD_ACHIEVEMENT),
          eq(resourceEntity.relationshipType, RESOURCE_RELATIONSHIP_TYPES.ICON),
        ),
      );

    if (!resourceId) return;

    await dbInstance
      .insert(resourceEntity)
      .values({
        resourceId,
        entityId: achievementId,
        entityType: ENTITY_TYPES.REWARD_ACHIEVEMENT,
        relationshipType: RESOURCE_RELATIONSHIP_TYPES.ICON,
      })
      .onConflictDoNothing();
  }
}
