import { Inject, Injectable } from "@nestjs/common";
import { SYSTEM_ROLE_SLUGS } from "@repo/shared";
import { and, eq, isNull, sql } from "drizzle-orm";

import { DatabasePg, type UUIDType } from "src/common";
import { PermissionsService } from "src/permissions/permissions.service";
import { DB } from "src/storage/db/db.providers";
import {
  aiMentorLessons,
  chapters,
  courses,
  pointEvents,
  settings,
  userStatistics,
} from "src/storage/schema";

import { POINT_DEFAULT_SETTING_KEYS, POINT_EVENT_TYPES } from "./gamification.constants";

import type { PointEventType } from "./gamification.constants";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import type * as schema from "src/storage/schema";

export type AwardPointsResult = {
  pointsAwarded: number;
};

type Transaction = PostgresJsDatabase<typeof schema>;

@Injectable()
export class PointsService {
  constructor(
    @Inject(DB) private readonly db: DatabasePg,
    private readonly permissionsService: PermissionsService,
  ) {}

  async award(
    userId: UUIDType,
    eventType: PointEventType,
    entityId: UUIDType,
    tenantId: UUIDType,
  ): Promise<AwardPointsResult> {
    return await this.db.transaction(async (trx) => {
      const { roleSlugs } = await this.permissionsService.getUserAccess(userId, trx);

      if (!roleSlugs.includes(SYSTEM_ROLE_SLUGS.STUDENT)) {
        return { pointsAwarded: 0 };
      }

      const points = await this.resolveEffectivePoints(
        trx as Transaction,
        eventType,
        entityId,
        tenantId,
      );

      const insertedEvents = await trx
        .insert(pointEvents)
        .values({
          tenantId,
          userId,
          eventType,
          entityId,
          points,
        })
        .onConflictDoNothing({
          target: [pointEvents.userId, pointEvents.eventType, pointEvents.entityId],
        })
        .returning({ id: pointEvents.id });

      if (insertedEvents.length === 0) {
        return { pointsAwarded: 0 };
      }

      if (points === 0) {
        return { pointsAwarded: 0 };
      }

      await trx
        .insert(userStatistics)
        .values({
          tenantId,
          userId,
          totalPoints: points,
          lastPointAt: sql`now()`,
        })
        .onConflictDoUpdate({
          target: userStatistics.userId,
          set: {
            totalPoints: sql`${userStatistics.totalPoints} + ${points}`,
            lastPointAt: sql`now()`,
            updatedAt: sql`now()`,
          },
        });

      return { pointsAwarded: points };
    });
  }

  private async resolveEffectivePoints(
    trx: Transaction,
    eventType: PointEventType,
    entityId: UUIDType,
    tenantId: UUIDType,
  ): Promise<number> {
    const [row] = await this.selectPointConfiguration(trx, eventType, entityId, tenantId);

    return row?.points ?? 0;
  }

  private selectPointConfiguration(
    trx: Transaction,
    eventType: PointEventType,
    entityId: UUIDType,
    tenantId: UUIDType,
  ): Promise<Array<{ points: number }>> {
    const defaultSettingKey = POINT_DEFAULT_SETTING_KEYS[eventType];
    const tenantDefault = sql<number>`COALESCE((${settings.settings}->>${defaultSettingKey})::int, 0)`;

    if (eventType === POINT_EVENT_TYPES.CHAPTER_COMPLETED) {
      return trx
        .select({ points: sql<number>`COALESCE(${chapters.pointsOverride}, ${tenantDefault}, 0)` })
        .from(chapters)
        .innerJoin(settings, and(eq(settings.tenantId, tenantId), isNull(settings.userId)))
        .where(and(eq(chapters.id, entityId), eq(chapters.tenantId, tenantId)));
    }

    if (eventType === POINT_EVENT_TYPES.COURSE_COMPLETED) {
      return trx
        .select({ points: sql<number>`COALESCE(${courses.pointsOverride}, ${tenantDefault}, 0)` })
        .from(courses)
        .innerJoin(settings, and(eq(settings.tenantId, tenantId), isNull(settings.userId)))
        .where(and(eq(courses.id, entityId), eq(courses.tenantId, tenantId)));
    }

    return trx
      .select({
        points: sql<number>`COALESCE(${aiMentorLessons.pointsOverride}, ${tenantDefault}, 0)`,
      })
      .from(aiMentorLessons)
      .innerJoin(settings, and(eq(settings.tenantId, tenantId), isNull(settings.userId)))
      .where(and(eq(aiMentorLessons.lessonId, entityId), eq(aiMentorLessons.tenantId, tenantId)));
  }
}
