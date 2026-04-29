import request from "supertest";

import { FileService } from "src/file/file.service";
import { POINT_EVENT_TYPES } from "src/gamification/gamification.constants";
import { DB, DB_ADMIN } from "src/storage/db/db.providers";
import { groups, groupUsers, pointEvents, userStatistics } from "src/storage/schema";

import { createE2ETest } from "../../../test/create-e2e-test";
import { createUserFactory } from "../../../test/factory/user.factory";
import { cookieFor, truncateAllTables } from "../../../test/helpers/test-helpers";

import type { INestApplication } from "@nestjs/common";
import type { DatabasePg } from "src/common";

const password = "password123";

const iso = (day: number) => `2026-04-${String(day).padStart(2, "0")}T10:00:00.000Z`;
const currentMonthIso = (day: number, hour = 10) => {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), day, hour)).toISOString();
};
const previousMonthIso = () => {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 20, 10)).toISOString();
};
const testUuid = (index: number) => `00000000-0000-0000-0000-${String(index).padStart(12, "0")}`;

describe("LeaderboardController (e2e)", () => {
  let app: INestApplication;
  let db: DatabasePg;
  let baseDb: DatabasePg;
  let userFactory: ReturnType<typeof createUserFactory>;

  beforeAll(async () => {
    const e2e = await createE2ETest([
      {
        provide: FileService,
        useValue: {
          getFileUrl: jest.fn(async (key: string) => `signed://${key}`),
          uploadFile: jest.fn(),
        },
      },
    ]);

    app = e2e.app;
    db = app.get(DB);
    baseDb = app.get(DB_ADMIN);
    userFactory = createUserFactory(db);
  }, 30000);

  afterAll(async () => {
    await truncateAllTables(baseDb, db);
  });

  it("returns ordered all-time top 10 with own rank outside the top 10 and filters staff", async () => {
    const viewer = await userFactory
      .withCredentials({ password })
      .withUserSettings(db)
      .create({ firstName: "Viewer", lastName: "Student" });
    const tenantId = viewer.tenantId;

    const highScorer = await userFactory.create({ tenantId, firstName: "High", lastName: "Score" });
    const tieEarlier = await userFactory.create({
      tenantId,
      firstName: "Tie",
      lastName: "Earlier",
    });
    const tieLater = await userFactory.create({ tenantId, firstName: "Tie", lastName: "Later" });
    const remaining = await Promise.all(
      Array.from({ length: 8 }, (_, index) =>
        userFactory.create({
          tenantId,
          firstName: `Rank${index}`,
          lastName: "Student",
        }),
      ),
    );
    const staff = await userFactory.withAdminRole().create({
      tenantId,
      firstName: "Staff",
      lastName: "Member",
    });
    const otherTenantStudent = await userFactory.create({
      firstName: "Other",
      lastName: "Tenant",
    });

    await db.insert(userStatistics).values([
      { userId: highScorer.id, tenantId, totalPoints: 200, lastPointAt: iso(1) },
      { userId: tieEarlier.id, tenantId, totalPoints: 100, lastPointAt: iso(2) },
      { userId: tieLater.id, tenantId, totalPoints: 100, lastPointAt: iso(3) },
      ...remaining.map((user, index) => ({
        userId: user.id,
        tenantId,
        totalPoints: 90 - index,
        lastPointAt: iso(4 + index),
      })),
      { userId: viewer.id, tenantId, totalPoints: 1, lastPointAt: iso(20) },
      { userId: staff.id, tenantId, totalPoints: 1000, lastPointAt: iso(1) },
      {
        userId: otherTenantStudent.id,
        tenantId: otherTenantStudent.tenantId,
        totalPoints: 999,
        lastPointAt: iso(1),
      },
    ]);

    await db.insert(pointEvents).values({
      userId: viewer.id,
      tenantId,
      eventType: POINT_EVENT_TYPES.CHAPTER_COMPLETED,
      entityId: "00000000-0000-0000-0000-000000000001",
      points: 1,
    });

    const response = await request(app.getHttpServer())
      .get("/api/leaderboard?scope=all-time")
      .set("Cookie", await cookieFor(viewer, app))
      .expect(200);

    expect(response.body.data.top10).toHaveLength(10);
    expect(response.body.data.top10.map((row: { userId: string }) => row.userId)).toEqual([
      highScorer.id,
      tieEarlier.id,
      tieLater.id,
      ...remaining.slice(0, 7).map((user) => user.id),
    ]);
    expect(response.body.data.top10.map((row: { userId: string }) => row.userId)).not.toContain(
      staff.id,
    );
    expect(response.body.data.top10.map((row: { userId: string }) => row.userId)).not.toContain(
      otherTenantStudent.id,
    );
    expect(response.body.data.ownRank).toBe(12);
    expect(response.body.data.ownRow).toMatchObject({
      userId: viewer.id,
      fullName: "Viewer Student",
      points: 1,
    });
  });

  it("returns monthly leaderboard scoped to a selected group and lists all tenant groups", async () => {
    const viewer = await userFactory
      .withCredentials({ password })
      .withUserSettings(db)
      .create({ firstName: "Monthly", lastName: "Viewer" });
    const tenantId = viewer.tenantId;

    const highScorer = await userFactory.create({
      tenantId,
      firstName: "Monthly",
      lastName: "High",
    });
    const tieEarlier = await userFactory.create({
      tenantId,
      firstName: "MonthlyTie",
      lastName: "Earlier",
    });
    const tieLater = await userFactory.create({
      tenantId,
      firstName: "MonthlyTie",
      lastName: "Later",
    });
    const remaining = await Promise.all(
      Array.from({ length: 8 }, (_, index) =>
        userFactory.create({
          tenantId,
          firstName: `MonthlyRank${index}`,
          lastName: "Student",
        }),
      ),
    );
    const outsideGroup = await userFactory.create({
      tenantId,
      firstName: "Outside",
      lastName: "Group",
    });
    const previousMonthOnly = await userFactory.create({
      tenantId,
      firstName: "Previous",
      lastName: "Month",
    });
    const otherTenantStudent = await userFactory.create({
      firstName: "Other",
      lastName: "TenantMonthly",
    });

    const [selectedGroup] = await db
      .insert(groups)
      .values({ name: "Selected leaderboard group", tenantId })
      .returning();
    const [unjoinedGroup] = await db
      .insert(groups)
      .values({ name: "Unjoined leaderboard group", tenantId })
      .returning();
    const [otherTenantGroup] = await db
      .insert(groups)
      .values({ name: "Other tenant group", tenantId: otherTenantStudent.tenantId })
      .returning();

    await db.insert(groupUsers).values([
      { groupId: selectedGroup.id, userId: viewer.id, tenantId },
      { groupId: selectedGroup.id, userId: highScorer.id, tenantId },
      { groupId: selectedGroup.id, userId: tieEarlier.id, tenantId },
      { groupId: selectedGroup.id, userId: tieLater.id, tenantId },
      ...remaining.map((user) => ({ groupId: selectedGroup.id, userId: user.id, tenantId })),
      { groupId: selectedGroup.id, userId: previousMonthOnly.id, tenantId },
      { groupId: unjoinedGroup.id, userId: outsideGroup.id, tenantId },
      {
        groupId: otherTenantGroup.id,
        userId: otherTenantStudent.id,
        tenantId: otherTenantStudent.tenantId,
      },
    ]);

    await db.insert(pointEvents).values([
      {
        userId: highScorer.id,
        tenantId,
        eventType: POINT_EVENT_TYPES.CHAPTER_COMPLETED,
        entityId: testUuid(101),
        points: 100,
        createdAt: currentMonthIso(2),
      },
      {
        userId: tieEarlier.id,
        tenantId,
        eventType: POINT_EVENT_TYPES.CHAPTER_COMPLETED,
        entityId: testUuid(102),
        points: 20,
        createdAt: currentMonthIso(2),
      },
      {
        userId: tieEarlier.id,
        tenantId,
        eventType: POINT_EVENT_TYPES.COURSE_COMPLETED,
        entityId: testUuid(103),
        points: 30,
        createdAt: currentMonthIso(4),
      },
      {
        userId: tieLater.id,
        tenantId,
        eventType: POINT_EVENT_TYPES.CHAPTER_COMPLETED,
        entityId: testUuid(104),
        points: 50,
        createdAt: currentMonthIso(5),
      },
      ...remaining.map((user, index) => ({
        userId: user.id,
        tenantId,
        eventType: POINT_EVENT_TYPES.CHAPTER_COMPLETED,
        entityId: testUuid(105 + index),
        points: 40 - index,
        createdAt: currentMonthIso(6 + index),
      })),
      {
        userId: viewer.id,
        tenantId,
        eventType: POINT_EVENT_TYPES.CHAPTER_COMPLETED,
        entityId: testUuid(120),
        points: 1,
        createdAt: currentMonthIso(20),
      },
      {
        userId: outsideGroup.id,
        tenantId,
        eventType: POINT_EVENT_TYPES.CHAPTER_COMPLETED,
        entityId: testUuid(121),
        points: 999,
        createdAt: currentMonthIso(1),
      },
      {
        userId: previousMonthOnly.id,
        tenantId,
        eventType: POINT_EVENT_TYPES.CHAPTER_COMPLETED,
        entityId: testUuid(122),
        points: 1000,
        createdAt: previousMonthIso(),
      },
      {
        userId: otherTenantStudent.id,
        tenantId: otherTenantStudent.tenantId,
        eventType: POINT_EVENT_TYPES.CHAPTER_COMPLETED,
        entityId: testUuid(123),
        points: 1000,
        createdAt: currentMonthIso(1),
      },
    ]);

    const groupsResponse = await request(app.getHttpServer())
      .get("/api/leaderboard/groups")
      .set("Cookie", await cookieFor(viewer, app))
      .expect(200);

    expect(groupsResponse.body.data.map((group: { id: string }) => group.id)).toEqual([
      selectedGroup.id,
      unjoinedGroup.id,
    ]);

    const response = await request(app.getHttpServer())
      .get(`/api/leaderboard?scope=month&groupId=${selectedGroup.id}`)
      .set("Cookie", await cookieFor(viewer, app))
      .expect(200);

    expect(response.body.data.top10).toHaveLength(10);
    expect(response.body.data.top10.map((row: { userId: string }) => row.userId)).toEqual([
      highScorer.id,
      tieEarlier.id,
      tieLater.id,
      ...remaining.slice(0, 7).map((user) => user.id),
    ]);
    expect(response.body.data.top10.map((row: { userId: string }) => row.userId)).not.toContain(
      outsideGroup.id,
    );
    expect(response.body.data.top10.map((row: { userId: string }) => row.userId)).not.toContain(
      previousMonthOnly.id,
    );
    expect(response.body.data.top10.map((row: { userId: string }) => row.userId)).not.toContain(
      otherTenantStudent.id,
    );
    expect(response.body.data.ownRank).toBe(12);
    expect(response.body.data.ownRow).toMatchObject({
      userId: viewer.id,
      fullName: "Monthly Viewer",
      points: 1,
    });
  });

  it("rejects authenticated non-students", async () => {
    const admin = await userFactory.withCredentials({ password }).withAdminSettings(db).create();

    await request(app.getHttpServer())
      .get("/api/leaderboard?scope=all-time")
      .set("Cookie", await cookieFor(admin, app))
      .expect(403);

    await request(app.getHttpServer())
      .get("/api/leaderboard/groups")
      .set("Cookie", await cookieFor(admin, app))
      .expect(403);
  });
});
