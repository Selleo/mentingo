import { Inject, Injectable } from "@nestjs/common";
import { SYSTEM_ROLE_SLUGS } from "@repo/shared";
import { sql } from "drizzle-orm";

import { DatabasePg, type UUIDType } from "src/common";
import { FileService } from "src/file/file.service";
import { DB } from "src/storage/db/db.providers";
import {
  permissionRoles,
  permissionUserRoles,
  pointEvents,
  users,
  userStatistics,
} from "src/storage/schema";

import type { LeaderboardResponse, LeaderboardRow } from "./schemas/leaderboard.schema";

type LeaderboardSqlRow = {
  userId: UUIDType;
  fullName: string;
  avatarReference: string | null;
  points: number;
  lastPointAt: string | null;
};

type RankSqlRow = { rank: number };

@Injectable()
export class LeaderboardQueryService {
  constructor(
    @Inject(DB) private readonly db: DatabasePg,
    private readonly fileService: FileService,
  ) {}

  async query(params: {
    tenantId: UUIDType;
    scope: "all-time";
    viewerId: UUIDType;
  }): Promise<LeaderboardResponse> {
    const top10 = await this.selectAllTimeTop10(params.tenantId);
    const ownRankRows = await this.selectAllTimeOwnRank(params.tenantId, params.viewerId);
    const ownRowRows = await this.selectOwnRowWhenAwarded(params.tenantId, params.viewerId);

    return {
      top10: await this.mapRows(top10),
      ownRank: ownRankRows[0]?.rank ?? null,
      ownRow: ownRowRows[0] ? await this.mapRow(ownRowRows[0]) : null,
    };
  }

  private selectAllTimeTop10(tenantId: UUIDType): Promise<LeaderboardSqlRow[]> {
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
          AND EXISTS (
            SELECT 1
            FROM ${permissionUserRoles}
            INNER JOIN ${permissionRoles}
              ON ${permissionRoles.id} = ${permissionUserRoles.roleId}
            WHERE ${permissionUserRoles.userId} = ${users.id}
              AND ${permissionUserRoles.tenantId} = ${tenantId}
              AND ${permissionRoles.slug} = ${SYSTEM_ROLE_SLUGS.STUDENT}
          )
      )
      SELECT "userId", "fullName", "avatarReference", "points", "lastPointAt"
      FROM ranked
      ORDER BY "rank" ASC, "lastPointAt" ASC, "userId" ASC
      LIMIT 10
    `) as Promise<LeaderboardSqlRow[]>;
  }

  private selectAllTimeOwnRank(tenantId: UUIDType, viewerId: UUIDType): Promise<RankSqlRow[]> {
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
          AND EXISTS (
            SELECT 1
            FROM ${permissionUserRoles}
            INNER JOIN ${permissionRoles}
              ON ${permissionRoles.id} = ${permissionUserRoles.roleId}
            WHERE ${permissionUserRoles.userId} = ${users.id}
              AND ${permissionUserRoles.tenantId} = ${tenantId}
              AND ${permissionRoles.slug} = ${SYSTEM_ROLE_SLUGS.STUDENT}
          )
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
        AND EXISTS (
          SELECT 1
          FROM ${permissionUserRoles}
          INNER JOIN ${permissionRoles}
            ON ${permissionRoles.id} = ${permissionUserRoles.roleId}
          WHERE ${permissionUserRoles.userId} = ${users.id}
            AND ${permissionUserRoles.tenantId} = ${tenantId}
            AND ${permissionRoles.slug} = ${SYSTEM_ROLE_SLUGS.STUDENT}
        )
        AND EXISTS (
          SELECT 1
          FROM ${pointEvents}
          WHERE ${pointEvents.userId} = ${users.id}
            AND ${pointEvents.tenantId} = ${tenantId}
        )
      LIMIT 1
    `) as Promise<LeaderboardSqlRow[]>;
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
