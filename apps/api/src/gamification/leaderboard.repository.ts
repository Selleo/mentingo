import { Inject, Injectable } from "@nestjs/common";
import {
  LEADERBOARD_EXCLUDED_ROLE_SLUGS,
  LEADERBOARD_METRICS,
  type SupportedLanguages,
} from "@repo/shared";
import { and, asc, eq, exists, gte, inArray, isNull, lt, notExists, or, sql } from "drizzle-orm";
import { match } from "ts-pattern";

import { DatabasePg } from "src/common";
import { LocalizationService } from "src/localization/localization.service";
import { DB } from "src/storage/db/db.providers";
import {
  achievementLevels,
  groups,
  groupUsers,
  permissionRoles,
  permissionUserRoles,
  userAchievementLevels,
  users,
  xpTransactions,
} from "src/storage/schema";

import type { LeaderboardRankingOptions, LeaderboardRow } from "./leaderboard.types";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import type { UUIDType } from "src/common";

const inRange = (column: AnyPgColumn, { startsAt, endsAt }: LeaderboardRankingOptions) =>
  and(
    startsAt ? gte(column, startsAt.toISOString()) : undefined,
    endsAt ? lt(column, endsAt.toISOString()) : undefined,
  );

@Injectable()
export class LeaderboardRepository {
  constructor(
    @Inject(DB) private readonly db: DatabasePg,
    private readonly localizationService: LocalizationService,
  ) {}

  async groupExists(groupId: UUIDType) {
    const [group] = await this.db
      .select({ id: groups.id })
      .from(groups)
      .where(eq(groups.id, groupId));

    return Boolean(group);
  }

  async isGroupMember(userId: UUIDType, groupId: UUIDType) {
    const [membership] = await this.db
      .select({ id: groupUsers.id })
      .from(groupUsers)
      .where(and(eq(groupUsers.userId, userId), eq(groupUsers.groupId, groupId)));

    return Boolean(membership);
  }

  /** All groups when `memberId` is null, otherwise only the groups that user currently belongs to. */
  async findGroups(language: SupportedLanguages, memberId: UUIDType | null) {
    const name = this.localizationService.getLocalizedSqlField(groups.name, language, groups);

    return this.db
      .select({ id: groups.id, name })
      .from(groups)
      .where(
        memberId
          ? exists(
              this.db
                .select({ id: groupUsers.id })
                .from(groupUsers)
                .where(and(eq(groupUsers.groupId, groups.id), eq(groupUsers.userId, memberId))),
            )
          : undefined,
      )
      .orderBy(asc(name));
  }

  /**
   * Ranks active learners: ties share a rank (1, 1, 3) and list the viewer first, then by name, so
   * a viewer ranked within the top list is always shown in it. Returns the top
   * `topLimit` rows plus the rows within `nearbyDistance` positions of the viewer.
   */
  async findRanking(options: LeaderboardRankingOptions): Promise<LeaderboardRow[]> {
    const scores = match(options.metric)
      .with(LEADERBOARD_METRICS.XP, () =>
        this.db
          .select({
            userId: xpTransactions.userId,
            score: sql<number>`SUM(${xpTransactions.lifetimeDelta})`.as("score"),
          })
          .from(xpTransactions)
          .where(inRange(xpTransactions.createdAt, options))
          .groupBy(xpTransactions.userId),
      )
      // Distinct achievements with at least one level earned in the period.
      .with(LEADERBOARD_METRICS.ACHIEVEMENTS, () =>
        this.db
          .select({
            userId: userAchievementLevels.userId,
            score: sql<number>`COUNT(DISTINCT ${achievementLevels.achievementId})`.as("score"),
          })
          .from(userAchievementLevels)
          .innerJoin(
            achievementLevels,
            eq(achievementLevels.id, userAchievementLevels.achievementLevelId),
          )
          .where(inRange(userAchievementLevels.createdAt, options))
          .groupBy(userAchievementLevels.userId),
      )
      .exhaustive()
      .as("leaderboard_scores");

    const score = sql<number>`COALESCE(${scores.score}, 0)::int`;

    const ranked = this.db.$with("leaderboard_ranked").as(
      this.db
        .select({
          userId: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
          score: score.as("score"),
          rank: sql<number>`RANK() OVER (ORDER BY ${score} DESC)::int`.as("rank"),
          position: sql<number>`ROW_NUMBER() OVER (
            ORDER BY ${score} DESC, ${users.id} = ${options.viewerId} DESC,
              ${users.firstName}, ${users.lastName}, ${users.id}
          )::int`.as("position"),
        })
        .from(users)
        .leftJoin(scores, eq(scores.userId, users.id))
        .where(
          and(
            isNull(users.deletedAt),
            eq(users.archived, false),
            notExists(
              this.db
                .select({ id: permissionUserRoles.id })
                .from(permissionUserRoles)
                .innerJoin(permissionRoles, eq(permissionRoles.id, permissionUserRoles.roleId))
                .where(
                  and(
                    eq(permissionUserRoles.userId, users.id),
                    inArray(permissionRoles.slug, [...LEADERBOARD_EXCLUDED_ROLE_SLUGS]),
                  ),
                ),
            ),
            options.groupId
              ? exists(
                  this.db
                    .select({ id: groupUsers.id })
                    .from(groupUsers)
                    .where(
                      and(eq(groupUsers.userId, users.id), eq(groupUsers.groupId, options.groupId)),
                    ),
                )
              : undefined,
          ),
        ),
    );

    const viewerPosition = sql`(
      SELECT ${ranked.position} FROM ${sql.identifier("leaderboard_ranked")}
      WHERE ${ranked.userId} = ${options.viewerId}
    )`;

    return this.db
      .with(ranked)
      .select()
      .from(ranked)
      .where(
        or(
          sql`${ranked.position} <= ${options.topLimit}`,
          sql`ABS(${ranked.position} - ${viewerPosition}) <= ${options.nearbyDistance}`,
        ),
      )
      .orderBy(asc(ranked.position));
  }
}
