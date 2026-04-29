import { SYSTEM_ROLE_SLUGS } from "@repo/shared";

import { POINT_EVENT_TYPES } from "src/gamification/gamification.constants";
import { PointsService } from "src/gamification/points.service";
import {
  aiMentorLessons,
  chapters,
  courses,
  pointEvents,
  userStatistics,
} from "src/storage/schema";

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

type PointConfigurationTable = typeof chapters | typeof courses | typeof aiMentorLessons;

class FakeTransaction {
  constructor(private readonly state: FakeDb) {}

  select() {
    const operation = {
      sourceTable: undefined as PointConfigurationTable | undefined,
      from: (table: PointConfigurationTable) => {
        operation.sourceTable = table;
        return operation;
      },
      innerJoin: () => operation,
      where: async () => [{ points: this.state.resolvePoints(operation.sourceTable) }],
    };

    return operation;
  }

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
  defaults = {
    chapter: 10,
    course: 50,
    aiPass: 30,
  };
  overrides = {
    chapter: undefined as number | null | undefined,
    course: undefined as number | null | undefined,
    aiPass: undefined as number | null | undefined,
  };

  resolvePoints(table?: PointConfigurationTable) {
    if (table === chapters) return this.overrides.chapter ?? this.defaults.chapter ?? 0;
    if (table === courses) return this.overrides.course ?? this.defaults.course ?? 0;
    if (table === aiMentorLessons) return this.overrides.aiPass ?? this.defaults.aiPass ?? 0;

    return 0;
  }

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
const courseId = "00000000-0000-0000-0000-000000000004" as UUIDType;
const lessonId = "00000000-0000-0000-0000-000000000005" as UUIDType;

const createService = (roleSlugs: string[] = [SYSTEM_ROLE_SLUGS.STUDENT]) => {
  const db = new FakeDb();
  const permissionsService = {
    getUserAccess: jest.fn(async () => ({ roleSlugs, permissions: [] })),
  };

  const achievementsRepository = {
    unlockEligibleAchievements: jest.fn(async () => []),
  };

  return {
    db,
    permissionsService,
    achievementsRepository,
    service: new PointsService(
      db as never,
      permissionsService as never,
      achievementsRepository as never,
    ),
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

    expect(firstAward).toEqual({ pointsAwarded: 10, newlyUnlocked: [] });
    expect(duplicateAward).toEqual({ pointsAwarded: 0, newlyUnlocked: [] });
    expect(db.pointEvents).toHaveLength(1);
    expect(db.userStatistics.get(userId)?.totalPoints).toBe(10);
  });

  it("resolves points from per-entity overrides when present", async () => {
    const { db, service } = createService();
    db.overrides.chapter = 25;

    const result = await service.award(
      userId,
      POINT_EVENT_TYPES.CHAPTER_COMPLETED,
      chapterId,
      tenantId,
    );

    expect(result).toEqual({ pointsAwarded: 25, newlyUnlocked: [] });
    expect(db.pointEvents[0]?.points).toBe(25);
    expect(db.userStatistics.get(userId)?.totalPoints).toBe(25);
  });

  it("falls back to tenant defaults when an override is null", async () => {
    const { db, service } = createService();
    db.overrides.course = null;
    db.defaults.course = 42;

    const result = await service.award(
      userId,
      POINT_EVENT_TYPES.COURSE_COMPLETED,
      courseId,
      tenantId,
    );

    expect(result).toEqual({ pointsAwarded: 42, newlyUnlocked: [] });
    expect(db.pointEvents[0]?.points).toBe(42);
    expect(db.userStatistics.get(userId)?.totalPoints).toBe(42);
  });

  it("snapshots zero-point events without bumping totals", async () => {
    const { db, service } = createService();
    db.overrides.aiPass = null;
    db.defaults.aiPass = 0;

    const result = await service.award(
      userId,
      POINT_EVENT_TYPES.AI_MENTOR_PASSED,
      lessonId,
      tenantId,
    );

    expect(result).toEqual({ pointsAwarded: 0, newlyUnlocked: [] });
    expect(db.pointEvents).toHaveLength(1);
    expect(db.pointEvents[0]?.points).toBe(0);
    expect(db.userStatistics.has(userId)).toBe(false);
  });

  it("awards configured course and AI mentor pass points", async () => {
    const { db, service } = createService();

    const courseAward = await service.award(
      userId,
      POINT_EVENT_TYPES.COURSE_COMPLETED,
      courseId,
      tenantId,
    );
    const aiMentorAward = await service.award(
      userId,
      POINT_EVENT_TYPES.AI_MENTOR_PASSED,
      lessonId,
      tenantId,
    );

    expect(courseAward).toEqual({ pointsAwarded: 50, newlyUnlocked: [] });
    expect(aiMentorAward).toEqual({ pointsAwarded: 30, newlyUnlocked: [] });
    expect(db.pointEvents).toHaveLength(2);
    expect(db.userStatistics.get(userId)?.totalPoints).toBe(80);
  });

  it("does not write ledger rows or totals for non-student users", async () => {
    const { db, service } = createService([SYSTEM_ROLE_SLUGS.ADMIN]);

    const result = await service.award(
      userId,
      POINT_EVENT_TYPES.CHAPTER_COMPLETED,
      chapterId,
      tenantId,
    );

    expect(result).toEqual({ pointsAwarded: 0, newlyUnlocked: [] });
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

  it("returns newly unlocked achievements from the evaluator repository", async () => {
    const { achievementsRepository, service } = createService();
    const newlyUnlocked = [
      {
        id: "00000000-0000-0000-0000-000000000010",
        pointThreshold: 10,
        unlockedAt: "2026-04-29T00:00:00.000Z",
      },
      {
        id: "00000000-0000-0000-0000-000000000011",
        pointThreshold: 10,
        unlockedAt: "2026-04-29T00:00:00.000Z",
      },
    ];
    achievementsRepository.unlockEligibleAchievements.mockResolvedValueOnce(newlyUnlocked as never);

    const result = await service.award(
      userId,
      POINT_EVENT_TYPES.CHAPTER_COMPLETED,
      chapterId,
      tenantId,
    );

    expect(result).toEqual({ pointsAwarded: 10, newlyUnlocked });
    expect(achievementsRepository.unlockEligibleAchievements).toHaveBeenCalledWith(
      expect.objectContaining({ currentTotal: 10, userId, tenantId }),
    );
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
    expect(resultAfterRecompletion).toEqual({ pointsAwarded: 0, newlyUnlocked: [] });
    expect(db.pointEvents).toEqual(pointEventsAfterReset);
    expect(db.userStatistics.get(userId)?.totalPoints).toBe(10);
  });
});
