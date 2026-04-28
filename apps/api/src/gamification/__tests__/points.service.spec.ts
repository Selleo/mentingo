import { SYSTEM_ROLE_SLUGS } from "@repo/shared";

import { POINT_EVENT_TYPES } from "src/gamification/gamification.constants";
import { PointsService } from "src/gamification/points.service";
import { pointEvents, userStatistics } from "src/storage/schema";

import type { UUIDType } from "src/common";

type PointEventRecord = {
  userId: UUIDType;
  eventType: string;
  entityId: UUIDType;
  points: number;
  tenantId: UUIDType;
};

type UserStatisticRecord = {
  userId: UUIDType;
  tenantId: UUIDType;
  totalPoints: number;
  lastPointAt: string | null;
};

class FakeTransaction {
  constructor(private readonly state: FakeDb) {}

  insert(table: unknown) {
    const operation = {
      payload: undefined as Record<string, unknown> | undefined,
      values: (payload: Record<string, unknown>) => {
        operation.payload = payload;
        return operation;
      },
      onConflictDoNothing: () => operation,
      onConflictDoUpdate: () => {
        if (table !== userStatistics) return operation;
        if (this.state.failStatisticsUpsert) throw new Error("statistics bump failed");

        const payload = operation.payload as {
          userId: UUIDType;
          tenantId: UUIDType;
          totalPoints: number;
        };
        const existing = this.state.userStatistics.get(payload.userId);

        this.state.userStatistics.set(payload.userId, {
          userId: payload.userId,
          tenantId: payload.tenantId,
          totalPoints: (existing?.totalPoints ?? 0) + payload.totalPoints,
          lastPointAt: "now",
        });

        return operation;
      },
      returning: async () => {
        if (table !== pointEvents) return [];

        const payload = operation.payload as PointEventRecord;
        const uniqueKey = `${payload.userId}:${payload.eventType}:${payload.entityId}`;

        if (this.state.pointEventUniqueKeys.has(uniqueKey)) return [];

        this.state.pointEventUniqueKeys.add(uniqueKey);
        this.state.pointEvents.push(payload);

        return [{ id: "point-event-id" }];
      },
    };

    return operation;
  }
}

class FakeDb {
  pointEvents: PointEventRecord[] = [];
  pointEventUniqueKeys = new Set<string>();
  userStatistics = new Map<UUIDType, UserStatisticRecord>();
  failStatisticsUpsert = false;

  async transaction<T>(callback: (trx: FakeTransaction) => Promise<T>): Promise<T> {
    const pointEventsSnapshot = [...this.pointEvents];
    const uniqueKeysSnapshot = new Set(this.pointEventUniqueKeys);
    const userStatisticsSnapshot = new Map(this.userStatistics);

    try {
      return await callback(new FakeTransaction(this));
    } catch (error) {
      this.pointEvents = pointEventsSnapshot;
      this.pointEventUniqueKeys = uniqueKeysSnapshot;
      this.userStatistics = userStatisticsSnapshot;
      throw error;
    }
  }
}

const userId = "00000000-0000-0000-0000-000000000001" as UUIDType;
const chapterId = "00000000-0000-0000-0000-000000000002" as UUIDType;
const tenantId = "00000000-0000-0000-0000-000000000003" as UUIDType;

const createService = (roleSlugs: string[] = [SYSTEM_ROLE_SLUGS.STUDENT]) => {
  const db = new FakeDb();
  const permissionsService = {
    getUserAccess: jest.fn(async () => ({ roleSlugs, permissions: [] })),
  };

  return {
    db,
    permissionsService,
    service: new PointsService(db as never, permissionsService as never),
  };
};

describe("PointsService", () => {
  it("awards chapter completion points once and no-ops duplicate events", async () => {
    const { db, service } = createService();

    const firstAward = await service.award(
      userId,
      POINT_EVENT_TYPES.CHAPTER_COMPLETED,
      chapterId,
      tenantId,
    );
    const duplicateAward = await service.award(
      userId,
      POINT_EVENT_TYPES.CHAPTER_COMPLETED,
      chapterId,
      tenantId,
    );

    expect(firstAward).toEqual({ pointsAwarded: 10 });
    expect(duplicateAward).toEqual({ pointsAwarded: 0 });
    expect(db.pointEvents).toHaveLength(1);
    expect(db.userStatistics.get(userId)?.totalPoints).toBe(10);
  });

  it("does not write ledger rows or totals for non-student users", async () => {
    const { db, service } = createService([SYSTEM_ROLE_SLUGS.ADMIN]);

    const result = await service.award(
      userId,
      POINT_EVENT_TYPES.CHAPTER_COMPLETED,
      chapterId,
      tenantId,
    );

    expect(result).toEqual({ pointsAwarded: 0 });
    expect(db.pointEvents).toHaveLength(0);
    expect(db.userStatistics.has(userId)).toBe(false);
  });

  it("rolls back the ledger insert when the total bump fails", async () => {
    const { db, service } = createService();
    db.failStatisticsUpsert = true;

    await expect(
      service.award(userId, POINT_EVENT_TYPES.CHAPTER_COMPLETED, chapterId, tenantId),
    ).rejects.toThrow("statistics bump failed");

    expect(db.pointEvents).toHaveLength(0);
    expect(db.userStatistics.has(userId)).toBe(false);
  });

  it("keeps point events append-only across chapter resets", async () => {
    const { db, service } = createService();

    await service.award(userId, POINT_EVENT_TYPES.CHAPTER_COMPLETED, chapterId, tenantId);

    // A chapter reset mutates progress state elsewhere; the points ledger remains untouched.
    const pointEventsAfterReset = [...db.pointEvents];

    const resultAfterRecompletion = await service.award(
      userId,
      POINT_EVENT_TYPES.CHAPTER_COMPLETED,
      chapterId,
      tenantId,
    );

    expect(pointEventsAfterReset).toHaveLength(1);
    expect(resultAfterRecompletion).toEqual({ pointsAwarded: 0 });
    expect(db.pointEvents).toEqual(pointEventsAfterReset);
    expect(db.userStatistics.get(userId)?.totalPoints).toBe(10);
  });
});
