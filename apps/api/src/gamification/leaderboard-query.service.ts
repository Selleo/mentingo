import { Inject, Injectable } from "@nestjs/common";
import { SYSTEM_ROLE_SLUGS } from "@repo/shared";
import { sql } from "drizzle-orm";

import { DatabasePg, type UUIDType } from "src/common";
import { FileService } from "src/file/file.service";
import { DB } from "src/storage/db/db.providers";
import {
  groups,
  groupUsers,
  permissionRoles,
  permissionUserRoles,
  pointEvents,
  users,
  userStatistics,
} from "src/storage/schema";

import type {
  LeaderboardGroup,
  LeaderboardResponse,
  LeaderboardRow,
  LeaderboardScope,
} from "./schemas/leaderboard.schema";

type LeaderboardSqlRow = {
  userId: UUIDType;
  fullName: string;
  avatarReference: string | null;
  points: number;
  lastPointAt: string | null;
};

type RankSqlRow = { rank: number };

type LeaderboardGroupSqlRow = {
  id: UUIDType;
  name: string;
};

@Injectable()
export class LeaderboardQueryService {
  constructor(
    @Inject(DB) private readonly db: DatabasePg,
    private readonly fileService: FileService,
  ) {}

  async query(params: {
    tenantId: UUIDType;
    scope: LeaderboardScope;
    viewerId: UUIDType;
    groupId?: UUIDType;
  }): Promise<LeaderboardResponse> {
    const top10 =
      params.scope === "month"
        ? await this.selectMonthlyTop10(params.tenantId, params.groupId)
        : await this.selectAllTimeTop10(params.tenantId, params.groupId);
    const ownRankRows =
      params.scope === "month"
        ? await this.selectMonthlyOwnRank(params.tenantId, params.viewerId, params.groupId)
        : await this.selectAllTimeOwnRank(params.tenantId, params.viewerId, params.groupId);
    const ownRowRows =
      params.scope === "month"
        ? await this.selectMonthlyOwnRow(params.tenantId, params.viewerId, params.groupId)
        : await this.selectOwnRowWhenAwarded(params.tenantId, params.viewerId, params.groupId);

    return {
      top10: await this.mapRows(top10),
      ownRank: ownRankRows[0]?.rank ?? null,
      ownRow: ownRowRows[0] ? await this.mapRow(ownRowRows[0]) : null,
    };
  }

  async listGroups(tenantId: UUIDType): Promise<LeaderboardGroup[]> {
    const rows = (await this.db.execute(sql`
      SELECT ${groups.id} AS "id", ${groups.name} AS "name"
      FROM ${groups}
      WHERE ${groups.tenantId} = ${tenantId}
      ORDER BY ${groups.name} ASC, ${groups.id} ASC
    `)) as LeaderboardGroupSqlRow[];

    return rows.map((row) => ({ id: row.id, name: row.name }));
  }

  private selectAllTimeTop10(tenantId: UUIDType, groupId?: UUIDType): Promise<LeaderboardSqlRow[]> {
    return this.db.execute(sql`
      WITH ranked AS (
        SELECT
          ${users.id} AS "userId",
          CONCAT_WS(' ', ${users.firstName}, ${users.lastName}) AS "fullName",
          ${users.avatarReference} AS "avatarReference",
          ${userStatistics.totalPoints}::INTEGER AS "points",
          ${userStatistics.lastPointAt} AS "lastPointAt",
          CAST(
            RANK() OVER (
              ORDER BY ${userStatistics.totalPoints} DESC, ${userStatistics.lastPointAt} ASC
            ) AS INTEGER
          ) AS "rank"
        FROM ${users}
        INNER JOIN ${userStatistics}
          ON ${userStatistics.userId} = ${users.id}
          AND ${userStatistics.tenantId} = ${tenantId}
        WHERE ${users.tenantId} = ${tenantId}
          AND ${userStatistics.totalPoints} > 0
          ${this.studentRoleFilterSql(tenantId)}
          ${this.groupFilterSql(tenantId, groupId)}
      )
      SELECT "userId", "fullName", "avatarReference", "points", "lastPointAt"
      FROM ranked
      ORDER BY "rank" ASC, "lastPointAt" ASC, "userId" ASC
      LIMIT 10
    `) as Promise<LeaderboardSqlRow[]>;
  }

  private selectAllTimeOwnRank(
    tenantId: UUIDType,
    viewerId: UUIDType,
    groupId?: UUIDType,
  ): Promise<RankSqlRow[]> {
    return this.db.execute(sql`
      WITH ranked AS (
        SELECT
          ${users.id} AS "userId",
          CAST(
            RANK() OVER (
              ORDER BY ${userStatistics.totalPoints} DESC, ${userStatistics.lastPointAt} ASC
            ) AS INTEGER
          ) AS "rank"
        FROM ${users}
        INNER JOIN ${userStatistics}
          ON ${userStatistics.userId} = ${users.id}
          AND ${userStatistics.tenantId} = ${tenantId}
        WHERE ${users.tenantId} = ${tenantId}
          AND ${userStatistics.totalPoints} > 0
          ${this.studentRoleFilterSql(tenantId)}
          ${this.groupFilterSql(tenantId, groupId)}
      )
      SELECT "rank"
      FROM ranked
      WHERE "userId" = ${viewerId}
      LIMIT 1
    `) as Promise<RankSqlRow[]>;
  }

  private selectOwnRowWhenAwarded(
    tenantId: UUIDType,
    viewerId: UUIDType,
    groupId?: UUIDType,
  ): Promise<LeaderboardSqlRow[]> {
    return this.db.execute(sql`
      SELECT
        ${users.id} AS "userId",
        CONCAT_WS(' ', ${users.firstName}, ${users.lastName}) AS "fullName",
        ${users.avatarReference} AS "avatarReference",
        COALESCE(${userStatistics.totalPoints}, 0)::INTEGER AS "points",
        ${userStatistics.lastPointAt} AS "lastPointAt"
      FROM ${users}
      LEFT JOIN ${userStatistics}
        ON ${userStatistics.userId} = ${users.id}
        AND ${userStatistics.tenantId} = ${tenantId}
      WHERE ${users.id} = ${viewerId}
        AND ${users.tenantId} = ${tenantId}
        ${this.studentRoleFilterSql(tenantId)}
        ${this.groupFilterSql(tenantId, groupId)}
        AND EXISTS (
          SELECT 1
          FROM ${pointEvents}
          WHERE ${pointEvents.userId} = ${users.id}
            AND ${pointEvents.tenantId} = ${tenantId}
        )
      LIMIT 1
    `) as Promise<LeaderboardSqlRow[]>;
  }

  private selectMonthlyTop10(tenantId: UUIDType, groupId?: UUIDType): Promise<LeaderboardSqlRow[]> {
    const startOfMonth = this.getStartOfCurrentMonthUtc();

    return this.db.execute(sql`
      SELECT
        ${users.id} AS "userId",
        CONCAT_WS(' ', ${users.firstName}, ${users.lastName}) AS "fullName",
        ${users.avatarReference} AS "avatarReference",
        SUM(${pointEvents.points})::INTEGER AS "points",
        MAX(${pointEvents.createdAt}) AS "lastPointAt"
      FROM ${pointEvents}
      INNER JOIN ${users}
        ON ${users.id} = ${pointEvents.userId}
        AND ${users.tenantId} = ${tenantId}
      WHERE ${pointEvents.tenantId} = ${tenantId}
        AND ${pointEvents.createdAt} >= ${startOfMonth}::timestamptz
        ${this.studentRoleFilterSql(tenantId)}
        ${this.groupFilterSql(tenantId, groupId)}
      GROUP BY ${users.id}, ${users.firstName}, ${users.lastName}, ${users.avatarReference}
      HAVING SUM(${pointEvents.points}) > 0
      ORDER BY SUM(${pointEvents.points}) DESC, MAX(${pointEvents.createdAt}) ASC, ${users.id} ASC
      LIMIT 10
    `) as Promise<LeaderboardSqlRow[]>;
  }

  private selectMonthlyOwnRank(
    tenantId: UUIDType,
    viewerId: UUIDType,
    groupId?: UUIDType,
  ): Promise<RankSqlRow[]> {
    const startOfMonth = this.getStartOfCurrentMonthUtc();

    return this.db.execute(sql`
      WITH monthly AS (
        SELECT
          ${users.id} AS "userId",
          SUM(${pointEvents.points}) AS "points",
          MAX(${pointEvents.createdAt}) AS "lastPointAt"
        FROM ${pointEvents}
        INNER JOIN ${users}
          ON ${users.id} = ${pointEvents.userId}
          AND ${users.tenantId} = ${tenantId}
        WHERE ${pointEvents.tenantId} = ${tenantId}
          AND ${pointEvents.createdAt} >= ${startOfMonth}::timestamptz
          ${this.studentRoleFilterSql(tenantId)}
          ${this.groupFilterSql(tenantId, groupId)}
        GROUP BY ${users.id}
        HAVING SUM(${pointEvents.points}) > 0
      ), ranked AS (
        SELECT
          "userId",
          CAST(
            RANK() OVER (ORDER BY "points" DESC, "lastPointAt" ASC)
            AS INTEGER
          ) AS "rank"
        FROM monthly
      )
      SELECT "rank"
      FROM ranked
      WHERE "userId" = ${viewerId}
      LIMIT 1
    `) as Promise<RankSqlRow[]>;
  }

  private selectMonthlyOwnRow(
    tenantId: UUIDType,
    viewerId: UUIDType,
    groupId?: UUIDType,
  ): Promise<LeaderboardSqlRow[]> {
    const startOfMonth = this.getStartOfCurrentMonthUtc();

    return this.db.execute(sql`
      SELECT
        ${users.id} AS "userId",
        CONCAT_WS(' ', ${users.firstName}, ${users.lastName}) AS "fullName",
        ${users.avatarReference} AS "avatarReference",
        SUM(${pointEvents.points})::INTEGER AS "points",
        MAX(${pointEvents.createdAt}) AS "lastPointAt"
      FROM ${pointEvents}
      INNER JOIN ${users}
        ON ${users.id} = ${pointEvents.userId}
        AND ${users.tenantId} = ${tenantId}
      WHERE ${pointEvents.tenantId} = ${tenantId}
        AND ${pointEvents.createdAt} >= ${startOfMonth}::timestamptz
        AND ${users.id} = ${viewerId}
        ${this.studentRoleFilterSql(tenantId)}
        ${this.groupFilterSql(tenantId, groupId)}
      GROUP BY ${users.id}, ${users.firstName}, ${users.lastName}, ${users.avatarReference}
      HAVING SUM(${pointEvents.points}) > 0
      LIMIT 1
    `) as Promise<LeaderboardSqlRow[]>;
  }

  private studentRoleFilterSql(tenantId: UUIDType) {
    return sql`
      AND EXISTS (
        SELECT 1
        FROM ${permissionUserRoles}
        INNER JOIN ${permissionRoles}
          ON ${permissionRoles.id} = ${permissionUserRoles.roleId}
        WHERE ${permissionUserRoles.userId} = ${users.id}
          AND ${permissionUserRoles.tenantId} = ${tenantId}
          AND ${permissionRoles.slug} = ${SYSTEM_ROLE_SLUGS.STUDENT}
      )
    `;
  }

  private groupFilterSql(tenantId: UUIDType, groupId?: UUIDType) {
    if (!groupId) return sql``;

    return sql`
      AND EXISTS (
        SELECT 1
        FROM ${groupUsers}
        WHERE ${groupUsers.userId} = ${users.id}
          AND ${groupUsers.tenantId} = ${tenantId}
          AND ${groupUsers.groupId} = ${groupId}
      )
    `;
  }

  private getStartOfCurrentMonthUtc() {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
  }

  private async mapRows(rows: LeaderboardSqlRow[]): Promise<LeaderboardRow[]> {
    return await Promise.all(rows.map((row) => this.mapRow(row)));
  }

  private async mapRow(row: LeaderboardSqlRow): Promise<LeaderboardRow> {
    return {
      userId: row.userId,
      fullName: row.fullName,
      avatarUrl: row.avatarReference
        ? await this.fileService.getFileUrl(row.avatarReference)
        : null,
      points: row.points,
    };
  }
}
