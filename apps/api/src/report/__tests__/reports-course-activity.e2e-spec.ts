import { COURSE_ENROLLMENT, SYSTEM_ROLE_SLUGS } from "@repo/shared";
import { sql } from "drizzle-orm";
import request from "supertest";

import {
  groupManagerGroups,
  learningPathCourses,
  lessons,
  studentCourses,
  studentLearningPathCourses,
  studentLearningPaths,
  studentLessonProgress,
  tenants,
} from "src/storage/schema";

import { createE2ETest } from "../../../test/create-e2e-test";
import { createChapterFactory } from "../../../test/factory/chapter.factory";
import { createCourseFactory } from "../../../test/factory/course.factory";
import { createGroupFactory } from "../../../test/factory/group.factory";
import { createLearningPathFactory } from "../../../test/factory/learningPath.factory";
import { createUserFactory } from "../../../test/factory/user.factory";
import { assignSystemRoleToUserInTests } from "../../../test/helpers/permission-role-helpers";
import { cookieFor } from "../../../test/helpers/test-helpers";

import type { ReportsQuery, ReportsResult } from "../schemas/reports.schema";
import type { INestApplication } from "@nestjs/common";
import type { DatabasePg } from "src/common";

/** Real HTTP + tenant RLS + persisted aggregates, not mocked rows. */
describe("Course activity reports (e2e)", () => {
  let app: INestApplication;
  let db: DatabasePg;
  let adminCookie: string;
  let managerCookie: string;
  let creatorCookie: string;
  let learnerCookie: string;
  let groupId: string;
  let courseId: string;
  let neverId: string;
  let unassignedId: string;
  let creatorCourseId: string;
  let firstLearnerId: string;
  let pathId: string;
  const period = { from: "2026-03-29", to: "2026-03-29" };
  const baseQuery = (): ReportsQuery => ({
    view: "organisation",
    language: "en",
    timezone: "Europe/Warsaw",
    groupIds: [groupId],
    page: 1,
    pageSize: 1,
    activityPeriod: period,
  });
  const run = async (overrides: Partial<ReportsQuery> = {}, cookie = adminCookie) => {
    const response = await request(app.getHttpServer())
      .post("/api/report/query")
      .set("Cookie", cookie)
      .send({ ...baseQuery(), ...overrides });
    expect(response.status).toBe(201);
    return response.body.data as ReportsResult;
  };

  beforeAll(async () => {
    const context = await createE2ETest({ useDbProxy: true });
    ({ app, db } = context);
    const users = createUserFactory(db);
    const admin = await users
      .withCredentials({ password: "password123" })
      .withAdminSettings(db)
      .create({ tenantId: context.defaultTenantId });
    const manager = await users
      .withCredentials({ password: "password123" })
      .withUserSettings(db)
      .create({ tenantId: context.defaultTenantId });
    const creator = await users
      .withCredentials({ password: "password123" })
      .withUserSettings(db)
      .create({ tenantId: context.defaultTenantId });
    await assignSystemRoleToUserInTests(
      db,
      manager.id,
      context.defaultTenantId,
      SYSTEM_ROLE_SLUGS.GROUP_MANAGER,
    );
    await assignSystemRoleToUserInTests(
      db,
      creator.id,
      context.defaultTenantId,
      SYSTEM_ROLE_SLUGS.CONTENT_CREATOR,
    );
    const first = await users
      .withCredentials({ password: "password123" })
      .withUserSettings(db)
      .create({ tenantId: context.defaultTenantId });
    const second = await users.withUserSettings(db).create({ tenantId: context.defaultTenantId });
    const outside = await users.withUserSettings(db).create({ tenantId: context.defaultTenantId });
    firstLearnerId = first.id;
    groupId = (
      await createGroupFactory(db)
        .withMembers([first.id, second.id])
        .create({ name: "Activity group" })
    ).id;
    await db.insert(groupManagerGroups).values({ groupId, managerUserId: manager.id });
    const courses = createCourseFactory(db);
    courseId = (await courses.create({ title: "Activity", authorId: admin.id })).id;
    neverId = (await courses.create({ title: "Never opened", authorId: admin.id })).id;
    unassignedId = (await courses.create({ title: "No enrollments", authorId: admin.id })).id;
    creatorCourseId = (await courses.create({ title: "Author only", authorId: creator.id })).id;
    await courses.create({ title: "Draft excluded", status: "draft", authorId: admin.id });
    await courses.create({ title: "Archived excluded", isArchived: true, authorId: admin.id });
    await db.insert(studentCourses).values([
      {
        studentId: first.id,
        courseId,
        status: COURSE_ENROLLMENT.ENROLLED,
        completedAt: "2026-03-28T23:00:00Z",
        lastOpenedAt: "2026-04-10T00:00:00Z",
      },
      {
        studentId: second.id,
        courseId,
        status: COURSE_ENROLLMENT.ENROLLED,
        completedAt: "2026-03-29T22:00:00Z",
      },
      {
        studentId: outside.id,
        courseId,
        status: COURSE_ENROLLMENT.ENROLLED,
        completedAt: "2026-03-29T12:00:00Z",
        lastOpenedAt: "2026-05-01T00:00:00Z",
      },
      { studentId: first.id, courseId: neverId, status: COURSE_ENROLLMENT.ENROLLED },
    ]);
    const chapter = await createChapterFactory(db).create({ courseId, authorId: admin.id });
    const [lesson] = await db
      .insert(lessons)
      .values({ chapterId: chapter.id, type: "article", title: { en: "Activity lesson" } })
      .returning();
    await db.insert(studentLessonProgress).values({
      chapterId: chapter.id,
      lessonId: lesson.id,
      studentId: first.id,
      completedAt: "2026-03-29T21:59:59.999Z",
      isStarted: true,
    });
    for (let index = 0; index < 2; index++) {
      const path = await createLearningPathFactory(db).create({
        title: { en: `Path ${index}` },
        authorId: admin.id,
      });
      pathId = path.id;
      await db
        .insert(learningPathCourses)
        .values({ learningPathId: path.id, courseId, displayOrder: 0 });
      await db
        .insert(studentLearningPaths)
        .values({ learningPathId: path.id, studentId: first.id });
      await db
        .insert(studentLearningPathCourses)
        .values({ learningPathId: path.id, studentId: first.id, courseId });
    }
    // The same tenant-independent catalog query must not leak a foreign course.
    const [foreignTenant] = await db
      .insert(tenants)
      .values({
        name: "Other activity tenant",
        host: `https://${crypto.randomUUID()}.activity.test`,
      })
      .returning();
    await db.transaction(async (transaction) => {
      await transaction.execute(sql`SELECT set_config('app.tenant_id', ${foreignTenant.id}, true)`);
      const foreignAuthor = await createUserFactory(transaction as DatabasePg).create({
        tenantId: foreignTenant.id,
      });
      await createCourseFactory(transaction as DatabasePg).create({
        authorId: foreignAuthor.id,
        title: "Foreign excluded",
      });
    });
    adminCookie = await cookieFor(admin, app);
    managerCookie = await cookieFor(manager, app);
    creatorCookie = await cookieFor(creator, app);
    learnerCookie = await cookieFor(first, app);
  }, 120_000);

  afterAll(async () => {
    await app?.close();
  });

  it("aggregates all filtered rows, deduplicates repeat activity and paths, and includes both local date boundaries correctly", async () => {
    const result = await run();
    expect(result.rows).toHaveLength(1);
    expect(result.total).toBe(3);
    expect(result.courseActivity?.popular).toEqual([
      expect.objectContaining({
        id: courseId,
        activeLearners: 1,
        lastActivityAt: "2026-04-10T00:00:00.000Z",
      }),
      expect.objectContaining({
        id: neverId,
        activeLearners: 0,
        lastActivityAt: null,
        inactiveDays: null,
      }),
    ]);
    expect((await run({ page: 2 })).courseActivity).toEqual(result.courseActivity);
    expect(result.courseActivity?.inactive[0].id).toBe(neverId);
    expect(
      (await run({ view: "developmentPaths", subjectId: pathId })).courseActivity?.popular[0]
        .activeLearners,
    ).toBe(1);
  });

  it("keeps last activity all-time while changing popularity periods", async () => {
    const result = await run({ activityPeriod: { from: "2026-04-10", to: "2026-04-10" } });
    expect(result.courseActivity?.popular[0]).toMatchObject({
      id: courseId,
      activeLearners: 1,
      lastActivityAt: "2026-04-10T00:00:00.000Z",
    });
    const emptyPeriod = await run({ activityPeriod: { from: "2020-01-01", to: "2020-01-01" } });
    expect(emptyPeriod.courseActivity?.popular.every((item) => item.activeLearners === 0)).toBe(
      true,
    );
    const inactivity = (report: ReportsResult) =>
      report.courseActivity?.inactive.map(({ id, lastActivityAt, inactiveDays }) => ({
        id,
        lastActivityAt,
        inactiveDays,
      }));
    expect(inactivity(emptyPeriod)).toEqual(inactivity(result));
  });

  it("respects selected learner and course conditions, with no unrelated zero-activity courses", async () => {
    const result = await run({
      filter: {
        match: "all",
        rules: [
          { field: "learner", operator: "eq", value: firstLearnerId },
          { field: "courseId", operator: "eq", value: neverId },
        ],
      },
    });
    expect(result.courseActivity?.popular).toEqual([
      expect.objectContaining({ id: neverId, activeLearners: 0 }),
    ]);
    const empty = await run({
      filter: { match: "all", rules: [{ field: "score", operator: "gte", value: 90 }] },
    });
    expect(empty.courseActivity).toEqual({ popular: [], inactive: [] });
  });

  it("includes authorized unenrolled courses only in an unfiltered catalog and excludes drafts, archived and foreign tenants", async () => {
    const result = await run({ groupIds: [] });
    expect(result.courseActivity?.popular.map((item) => item.id).sort()).toEqual(
      [courseId, neverId, unassignedId, creatorCourseId].sort(),
    );
    expect(
      result.courseActivity?.popular.find((item) => item.id === courseId)?.activeLearners,
    ).toBe(2);
    expect(result.courseActivity?.popular.find((item) => item.id === unassignedId)).toMatchObject({
      activeLearners: 0,
      lastActivityAt: null,
    });
  });

  it("restricts group managers and course authors and rejects a learner", async () => {
    const manager = await run({ groupIds: [] }, managerCookie);
    expect(manager.courseActivity?.popular.map((item) => item.id).sort()).toEqual(
      [courseId, neverId].sort(),
    );
    expect(manager.courseActivity?.popular.find((item) => item.id === courseId)).toMatchObject({
      activeLearners: 1,
      lastActivityAt: "2026-04-10T00:00:00.000Z",
    });
    const creator = await run({ groupIds: [] }, creatorCookie);
    expect(creator.courseActivity?.popular.map((item) => item.id)).toEqual([creatorCourseId]);
    await request(app.getHttpServer())
      .post("/api/report/query")
      .set("Cookie", learnerCookie)
      .send(baseQuery())
      .expect(403);
    await request(app.getHttpServer())
      .post("/api/report/query")
      .set("Cookie", managerCookie)
      .send({ ...baseQuery(), view: "course", subjectId: unassignedId })
      .expect(403);
  });
});
