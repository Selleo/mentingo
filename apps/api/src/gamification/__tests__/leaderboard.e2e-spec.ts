import { randomUUID } from "node:crypto";

import {
  LEADERBOARD_METRICS,
  LEADERBOARD_PERIODS,
  LEADERBOARD_VISIBILITY,
  XP_TRANSACTION_TYPES,
  type LeaderboardVisibility,
} from "@repo/shared";
import { subDays } from "date-fns";
import { and, asc, eq, isNull, sql } from "drizzle-orm";
import request from "supertest";

import { GamificationService } from "src/gamification/gamification.service";
import { DB, DB_ADMIN } from "src/storage/db/db.providers";
import {
  achievementLevels,
  achievements,
  groupUsers,
  settings,
  userAchievementLevels,
  xpTransactions,
} from "src/storage/schema";

import { createE2ETest } from "../../../test/create-e2e-test";
import { createGroupFactory } from "../../../test/factory/group.factory";
import { createSettingsFactory } from "../../../test/factory/settings.factory";
import { createUserFactory, type UserWithCredentials } from "../../../test/factory/user.factory";
import { cookieFor, truncateAllTables } from "../../../test/helpers/test-helpers";

import type { INestApplication } from "@nestjs/common";
import type { DatabasePg, UUIDType } from "src/common";

const PASSWORD = "Password123@@";

type Entry = { userId: string; firstName: string; score: number; rank: number };

describe("Leaderboards (e2e)", () => {
  let app: INestApplication;
  let db: DatabasePg;
  let baseDb: DatabasePg;
  let gamificationService: GamificationService;
  let runAsTenant: <T>(function_: () => Promise<T>) => Promise<T>;
  let userFactory: ReturnType<typeof createUserFactory>;
  let groupFactory: ReturnType<typeof createGroupFactory>;
  let admin: UserWithCredentials;

  const createStudent = (firstName: string, overrides: Partial<UserWithCredentials> = {}) =>
    userFactory
      .withCredentials({ password: PASSWORD })
      .withUserSettings(db)
      .create({ firstName, lastName: "Learner", ...overrides });

  const grantXp = (userId: UUIDType, lifetimeDelta: number, createdAt = new Date()) =>
    db.insert(xpTransactions).values({
      userId,
      type: XP_TRANSACTION_TYPES.ACHIEVEMENT_LEVEL,
      sourceId: randomUUID(),
      lifetimeDelta,
      // Spendable XP never ranks, so make it disagree with lifetime XP.
      spendableDelta: 0,
      createdAt: createdAt.toISOString(),
    });

  const earnLevels = async (
    userId: UUIDType,
    key: string,
    levels: number[],
    createdAt = new Date(),
  ) => {
    const rows = await db
      .select({ id: achievementLevels.id })
      .from(achievementLevels)
      .innerJoin(achievements, eq(achievements.id, achievementLevels.achievementId))
      .where(eq(achievements.key, key))
      .orderBy(asc(achievementLevels.level));

    await db.insert(userAchievementLevels).values(
      levels.map((level) => ({
        userId,
        achievementLevelId: rows[level - 1].id,
        createdAt: createdAt.toISOString(),
      })),
    );
  };

  const setGlobalSettings = (values: Record<string, unknown>) =>
    db
      .update(settings)
      .set({ settings: sql`${settings.settings} || ${JSON.stringify(values)}::text::jsonb` })
      .where(isNull(settings.userId));

  const setVisibility = async (leaderboardVisibility: LeaderboardVisibility) =>
    request(app.getHttpServer())
      .patch("/api/settings/admin/leaderboards")
      .set("Cookie", await cookieFor(admin, app))
      .send({ leaderboardVisibility })
      .expect(200);

  const fetchLeaderboard = async (
    viewer: UserWithCredentials,
    query: Record<string, string> = {},
    status = 200,
  ) =>
    request(app.getHttpServer())
      .get("/api/gamification/leaderboards")
      .query({ metric: LEADERBOARD_METRICS.XP, period: LEADERBOARD_PERIODS.ALL_TIME, ...query })
      .set("Cookie", await cookieFor(viewer, app))
      .expect(status);

  const fetchScopes = async (viewer: UserWithCredentials, status = 200) =>
    request(app.getHttpServer())
      .get("/api/gamification/leaderboards/scopes?language=en")
      .set("Cookie", await cookieFor(viewer, app))
      .expect(status);

  /** Students named "Student 00".."Student NN", ranked in that order by the given XP. */
  const createRankedStudents = async (scores: number[]) => {
    const students: UserWithCredentials[] = [];

    for (const [index, score] of scores.entries()) {
      const student = await createStudent(`Student ${String(index).padStart(2, "0")}`);
      await grantXp(student.id, score);
      students.push(student);
    }

    return students;
  };

  const descendingScores = (count: number) =>
    Array.from({ length: count }, (_, index) => 1000 - index * 10);

  const expectNearbyOutsideTop = (data: { entries: Entry[]; nearby: Entry[] }) => {
    const topIds = data.entries.map(({ userId }) => userId);
    const nearbyIds = data.nearby.map(({ userId }) => userId);

    expect(nearbyIds.filter((userId) => topIds.includes(userId))).toEqual([]);
    expect(new Set(nearbyIds).size).toBe(nearbyIds.length);
  };

  const ranking = (entries: Entry[]) =>
    entries.map(({ firstName, score, rank }) => ({ firstName, score, rank }));

  beforeAll(async () => {
    const testContext = await createE2ETest();

    app = testContext.app;
    db = app.get(DB);
    baseDb = app.get(DB_ADMIN);
    gamificationService = app.get(GamificationService);
    runAsTenant = (function_) => testContext.runAsTenant(testContext.defaultTenantId, function_);
    userFactory = createUserFactory(db);
    groupFactory = createGroupFactory(db);
  });

  beforeEach(async () => {
    await truncateAllTables(baseDb, db);
    await createSettingsFactory(db, null).create({ userId: null });
    await setGlobalSettings({ gamificationEnabled: true, leaderboardsEnabled: true });
    await runAsTenant(() => gamificationService.ensurePredefinedAchievements());

    admin = await userFactory
      .withCredentials({ password: PASSWORD })
      .withAdminSettings(db)
      .create({ firstName: "Admin" });
  });

  afterAll(async () => {
    await app.close();
  });

  it("ranks by lifetime XP, sharing ranks on ties and ordering ties by name", async () => {
    const charlie = await createStudent("Charlie");
    const bob = await createStudent("Bob");
    const alice = await createStudent("Alice");
    const dave = await createStudent("Dave");

    await grantXp(bob.id, 100);
    await grantXp(alice.id, 60);
    await grantXp(alice.id, 40);
    await grantXp(charlie.id, 90);

    const { body } = await fetchLeaderboard(admin);

    expect(ranking(body.data.entries)).toEqual([
      { firstName: "Alice", score: 100, rank: 1 },
      { firstName: "Bob", score: 100, rank: 1 },
      { firstName: "Charlie", score: 90, rank: 3 },
      { firstName: "Dave", score: 0, rank: 4 },
    ]);
    expect(body.data.entries[3].userId).toBe(dave.id);
  });

  it("only counts XP earned inside the period", async () => {
    const alice = await createStudent("Alice");
    const bob = await createStudent("Bob");

    await grantXp(alice.id, 500, subDays(new Date(), 400));
    await grantXp(bob.id, 50);

    const thisMonth = await fetchLeaderboard(admin, { period: LEADERBOARD_PERIODS.MONTH });

    expect(ranking(thisMonth.body.data.entries)).toEqual([
      { firstName: "Bob", score: 50, rank: 1 },
      { firstName: "Alice", score: 0, rank: 2 },
    ]);

    const oldDay = subDays(new Date(), 400).toISOString().slice(0, 10);
    const custom = await fetchLeaderboard(admin, {
      period: LEADERBOARD_PERIODS.CUSTOM,
      from: oldDay,
      to: oldDay,
    });

    expect(custom.body.data.entries[0]).toMatchObject({ firstName: "Alice", score: 500 });
    expect(custom.body.data.startsAt).toBe(`${oldDay}T00:00:00.000Z`);
  });

  it("rejects a custom period without a valid range", async () => {
    await fetchLeaderboard(admin, { period: LEADERBOARD_PERIODS.CUSTOM, from: "2026-10-01" }, 400);
    await fetchLeaderboard(
      admin,
      { period: LEADERBOARD_PERIODS.CUSTOM, from: "2026-10-31", to: "2026-10-01" },
      400,
    );
  });

  it("counts distinct achievements, not earned levels", async () => {
    const alice = await createStudent("Alice");
    const bob = await createStudent("Bob");

    await earnLevels(alice.id, "login_streak", [1, 2, 3]);
    await earnLevels(bob.id, "first_login", [1]);
    await earnLevels(bob.id, "first_lesson", [1]);

    const { body } = await fetchLeaderboard(admin, { metric: LEADERBOARD_METRICS.ACHIEVEMENTS });

    expect(ranking(body.data.entries)).toEqual([
      { firstName: "Bob", score: 2, rank: 1 },
      { firstName: "Alice", score: 1, rank: 2 },
    ]);
  });

  it("excludes staff roles, archived and deleted users", async () => {
    await createStudent("Alice");
    await createStudent("Archived", { archived: true });
    await createStudent("Deleted", { deletedAt: new Date().toISOString() });
    await userFactory.withTrainerSettings(db).create({ firstName: "Trainer" });
    await userFactory.withContentCreatorSettings(db).create({ firstName: "Creator" });

    const { body } = await fetchLeaderboard(admin);

    expect(ranking(body.data.entries).map(({ firstName }) => firstName)).toEqual(["Alice"]);
    expect(body.data.currentUser).toBeNull();
  });

  it("returns the viewer's rank and nearby users beyond the top list", async () => {
    const students: UserWithCredentials[] = [];

    for (let index = 0; index < 15; index++) {
      const student = await createStudent(`Student ${String(index).padStart(2, "0")}`);
      await grantXp(student.id, 1000 - index * 10);
      students.push(student);
    }

    const viewer = students[12];
    const { body } = await fetchLeaderboard(viewer, {}, 403);

    expect(body.message).toBe("common.toast.noAccess");

    await setVisibility(LEADERBOARD_VISIBILITY.PUBLIC);

    const { body: publicBody } = await fetchLeaderboard(viewer);

    expect(publicBody.data.entries).toHaveLength(10);
    expect(publicBody.data.currentUser).toMatchObject({ userId: viewer.id, rank: 13 });
    expect(publicBody.data.nearby.map(({ rank }: Entry) => rank)).toEqual([11, 12, 13, 14, 15]);
  });

  it.each([11, 12])(
    "does not repeat top users in nearby for a viewer at position %i",
    async (position) => {
      const students = await createRankedStudents(descendingScores(15));
      await setVisibility(LEADERBOARD_VISIBILITY.PUBLIC);

      const { body } = await fetchLeaderboard(students[position - 1]);

      expect(body.data.entries).toHaveLength(10);
      expect(body.data.currentUser).toMatchObject({ rank: position });
      expectNearbyOutsideTop(body.data);
      expect(body.data.nearby.map(({ rank }: Entry) => rank)).toEqual(
        [position - 2, position - 1, position, position + 1, position + 2].filter(
          (rank) => rank > 10,
        ),
      );
    },
  );

  it.each([1, 5, 10])(
    "returns no nearby users for a viewer at position %i in the top list",
    async (position) => {
      const students = await createRankedStudents(descendingScores(15));
      await setVisibility(LEADERBOARD_VISIBILITY.PUBLIC);

      const viewer = students[position - 1];
      const { body } = await fetchLeaderboard(viewer);

      expect(body.data.currentUser).toMatchObject({ userId: viewer.id, rank: position });
      expect(body.data.entries.map(({ userId }: Entry) => userId)).toContain(viewer.id);
      expect(body.data.nearby).toEqual([]);
    },
  );

  it("lists a viewer tied with the 10th place inside the top list", async () => {
    const students = await createRankedStudents([...descendingScores(9), 500, 500]);
    await setVisibility(LEADERBOARD_VISIBILITY.PUBLIC);

    const tenth = students[9];
    const eleventh = students[10];
    const { body } = await fetchLeaderboard(eleventh);

    expect(body.data.entries).toHaveLength(10);
    expect(body.data.entries[9]).toMatchObject({ userId: eleventh.id, rank: 10, score: 500 });
    expect(body.data.entries.map(({ userId }: Entry) => userId)).not.toContain(tenth.id);
    expect(body.data.currentUser).toMatchObject({ userId: eleventh.id, rank: 10 });
    expect(body.data.nearby).toEqual([]);

    // Other viewers keep the alphabetical order within the tie.
    const { body: adminBody } = await fetchLeaderboard(admin);

    expect(adminBody.data.entries[9]).toMatchObject({ userId: tenth.id, rank: 10 });
  });

  it("lists the viewer first within a tie and keeps the others alphabetical", async () => {
    const alice = await createStudent("Alice");
    const bob = await createStudent("Bob");
    const carol = await createStudent("Carol");

    for (const student of [alice, bob, carol]) await grantXp(student.id, 100);

    await setVisibility(LEADERBOARD_VISIBILITY.PUBLIC);

    const { body } = await fetchLeaderboard(carol);

    expect(ranking(body.data.entries)).toEqual([
      { firstName: "Carol", score: 100, rank: 1 },
      { firstName: "Alice", score: 100, rank: 1 },
      { firstName: "Bob", score: 100, rank: 1 },
    ]);
  });

  it("counts achievements with a level earned inside the period", async () => {
    const alice = await createStudent("Alice");
    const bob = await createStudent("Bob");

    await earnLevels(alice.id, "login_streak", [1], subDays(new Date(), 400));
    await earnLevels(alice.id, "login_streak", [2]);
    await earnLevels(bob.id, "first_login", [1], subDays(new Date(), 400));

    const { body } = await fetchLeaderboard(admin, {
      metric: LEADERBOARD_METRICS.ACHIEVEMENTS,
      period: LEADERBOARD_PERIODS.MONTH,
    });

    expect(ranking(body.data.entries)).toEqual([
      { firstName: "Alice", score: 1, rank: 1 },
      { firstName: "Bob", score: 0, rank: 2 },
    ]);
  });

  it("includes the start of a custom range and excludes the day after its end", async () => {
    const alice = await createStudent("Alice");
    const bob = await createStudent("Bob");
    const carol = await createStudent("Carol");

    await grantXp(alice.id, 10, new Date("2026-03-01T00:00:00.000Z"));
    await grantXp(alice.id, 5, new Date("2026-03-02T23:59:59.999Z"));
    await grantXp(bob.id, 20, new Date("2026-03-03T00:00:00.000Z"));
    await grantXp(carol.id, 30, new Date("2026-02-28T23:59:59.999Z"));

    const { body } = await fetchLeaderboard(admin, {
      period: LEADERBOARD_PERIODS.CUSTOM,
      from: "2026-03-01",
      to: "2026-03-02",
    });

    expect(body.data).toMatchObject({
      startsAt: "2026-03-01T00:00:00.000Z",
      endsAt: "2026-03-03T00:00:00.000Z",
    });
    expect(ranking(body.data.entries)).toEqual([
      { firstName: "Alice", score: 15, rank: 1 },
      { firstName: "Bob", score: 0, rank: 2 },
      { firstName: "Carol", score: 0, rank: 2 },
    ]);
  });

  it("rejects a custom range with an invalid date", async () => {
    // `from` < `to` as strings, so only date-format validation can reject this.
    const { body } = await fetchLeaderboard(
      admin,
      { period: LEADERBOARD_PERIODS.CUSTOM, from: "2026-13-45", to: "2026-13-46" },
      400,
    );

    expect(body.message).not.toBe("gamification.leaderboard.invalidRange");
  });

  it("rejects users without the leaderboard permission on both endpoints", async () => {
    await setVisibility(LEADERBOARD_VISIBILITY.PUBLIC);

    const trainer = await userFactory
      .withCredentials({ password: PASSWORD })
      .withTrainerSettings(db)
      .create({ firstName: "Trainer" });
    const groupId = (await groupFactory.withMembers([trainer.id]).create()).id;

    await fetchLeaderboard(trainer, {}, 403);
    await fetchLeaderboard(trainer, { groupId }, 403);
    await fetchScopes(trainer, 403);
  });

  describe("scope isolation", () => {
    let alice: UserWithCredentials;
    let bob: UserWithCredentials;
    let ownGroupId: UUIDType;
    let otherGroupId: UUIDType;

    beforeEach(async () => {
      alice = await createStudent("Alice");
      bob = await createStudent("Bob");
      const trainer = await userFactory.withTrainerSettings(db).create({ firstName: "Trainer" });

      ownGroupId = (
        await groupFactory.withMembers([alice.id, trainer.id]).create({ name: "Alpha" })
      ).id;
      otherGroupId = (await groupFactory.withMembers([bob.id]).create({ name: "Beta" })).id;

      await grantXp(alice.id, 10);
      await grantXp(bob.id, 20);
    });

    it("lets students open only the groups they belong to", async () => {
      const { body } = await fetchLeaderboard(alice, { groupId: ownGroupId });

      expect(ranking(body.data.entries).map(({ firstName }) => firstName)).toEqual(["Alice"]);
      expect(body.data.currentUser).toMatchObject({ userId: alice.id, rank: 1 });

      await fetchLeaderboard(alice, { groupId: otherGroupId }, 403);
    });

    it("revokes group access once a student leaves the group", async () => {
      await db
        .delete(groupUsers)
        .where(and(eq(groupUsers.userId, alice.id), eq(groupUsers.groupId, ownGroupId)));

      await fetchLeaderboard(alice, { groupId: ownGroupId }, 403);
      expect((await fetchScopes(alice)).body.data).toEqual({ tenantWide: false, groups: [] });
    });

    it("gives a student without groups no scopes in closed mode", async () => {
      const carol = await createStudent("Carol");

      expect((await fetchScopes(carol)).body.data).toEqual({ tenantWide: false, groups: [] });
      await fetchLeaderboard(carol, {}, 403);
    });

    it("shows the organization-wide leaderboard to students only in public mode", async () => {
      await fetchLeaderboard(alice, {}, 403);
      expect((await fetchScopes(alice)).body.data).toEqual({
        tenantWide: false,
        groups: [{ id: ownGroupId, name: "Alpha" }],
      });

      await setVisibility(LEADERBOARD_VISIBILITY.PUBLIC);

      const { body } = await fetchLeaderboard(alice);

      expect(ranking(body.data.entries).map(({ firstName }) => firstName)).toEqual([
        "Bob",
        "Alice",
      ]);
      expect((await fetchScopes(alice)).body.data.tenantWide).toBe(true);
    });

    it("lets admins open the organization and any group", async () => {
      await fetchLeaderboard(admin, { groupId: otherGroupId });
      await fetchLeaderboard(admin, { groupId: randomUUID() }, 404);

      expect((await fetchScopes(admin)).body.data).toEqual({
        tenantWide: true,
        groups: [
          { id: ownGroupId, name: "Alpha" },
          { id: otherGroupId, name: "Beta" },
        ],
      });
    });

    it("rejects every request while leaderboards or gamification are off", async () => {
      await setGlobalSettings({ leaderboardsEnabled: false });
      await fetchLeaderboard(admin, {}, 400);
      await fetchLeaderboard(alice, { groupId: ownGroupId }, 400);

      await setGlobalSettings({ leaderboardsEnabled: true, gamificationEnabled: false });
      await fetchLeaderboard(admin, {}, 400);
    });
  });
});
