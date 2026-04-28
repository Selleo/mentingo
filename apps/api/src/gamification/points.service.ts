import { Inject, Injectable } from "@nestjs/common";
import { SYSTEM_ROLE_SLUGS } from "@repo/shared";
import { sql } from "drizzle-orm";

import { DatabasePg, type UUIDType } from "src/common";
import { PermissionsService } from "src/permissions/permissions.service";
import { DB } from "src/storage/db/db.providers";
import { pointEvents, userStatistics } from "src/storage/schema";

import { DEFAULT_POINTS } from "./gamification.constants";

import type { PointEventType } from "./gamification.constants";

export type AwardPointsResult = {
  pointsAwarded: number;
};

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

      const points = DEFAULT_POINTS[eventType];

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
}
