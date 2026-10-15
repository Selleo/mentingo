import { COURSE_ENROLLMENT, SYSTEM_ROLE_SLUGS } from "@repo/shared";
import { eq, sql } from "drizzle-orm";
import request from "supertest";

import { DB } from "src/storage/db/db.providers";
import {
  groupManagerGroups,
  studentCourses,
  studentLearningPaths,
  studentLearningPathCourses,
  learningPathCourses,
  lessons,
  reportsConfigurations,
} from "src/storage/schema";

import { createE2ETest } from "../../../test/create-e2e-test";
import { createChapterFactory } from "../../../test/factory/chapter.factory";
import { createCourseFactory } from "../../../test/factory/course.factory";
import { createGroupFactory } from "../../../test/factory/group.factory";
import { createLearningPathFactory } from "../../../test/factory/learningPath.factory";
import { createSettingsFactory } from "../../../test/factory/settings.factory";
import { createUserFactory } from "../../../test/factory/user.factory";
import { cookieFor } from "../../../test/helpers/test-helpers";
import { REPORT_FAILURE_CODE } from "../constants/reports.constants";
import { REPORT_ERRORS } from "../constants/reports.errors";

import type { UserWithCredentials } from "../../../test/factory/user.factory";
import type { ReportDefinition, ReportsQuery, ReportsResult } from "../schemas/reports.schema";
import type { INestApplication } from "@nestjs/common";
import type { SystemRoleSlug } from "@repo/shared";
import type { DatabasePg } from "src/common";

describe("Reports (e2e)", () => {
  let app: INestApplication;
  let db: DatabasePg;
  let adminCookie: string;
  let managerCookie: string;
  let creatorCookie: string;
  let learnerCookie: string;
  let salesId: string;
  let managersId: string;
  let outsideGroupId: string;
  let managerAuthoredPathId: string;
  let outsideLearnerId: string;
  let learner: UserWithCredentials;
  let safetyId: string;
  let leadershipId: string;
  let pathId: string;
  let defaultTenantId: string;

  const baseDefinition = (): ReportDefinition => ({
    view: "organisation",
    timezone: "Europe/Warsaw",
    groupIds: [salesId],
  });

  const baseQuery = (): ReportsQuery => ({
    ...baseDefinition(),
    language: "en",
    page: 1,
    pageSize: 25,
  });

  const run = async (query: ReportsQuery, cookie = adminCookie): Promise<ReportsResult> => {
    const response = await request(app.getHttpServer())
      .post("/api/report/query")
      .set("Cookie", cookie)
      .send(query);
    if (response.status !== 201)
      throw new Error(`Report query failed: ${JSON.stringify(response.body)}`);
    return response.body.data;
  };

  beforeAll(async () => {
    const context = await createE2ETest();
    app = context.app;
    db = app.get(DB);
    defaultTenantId = context.defaultTenantId;
    const userFactory = createUserFactory(db);
    const makeUser = async (roleSlug: SystemRoleSlug) => {
      const user = await userFactory.withCredentials({ password: "password123" }).create({
        roleSlug,
        tenantId: defaultTenantId,
      });
      await createSettingsFactory(db, user.id, roleSlug === SYSTEM_ROLE_SLUGS.ADMIN).create();
      return user;
    };
    const admin = await makeUser(SYSTEM_ROLE_SLUGS.ADMIN);
    const manager = await makeUser(SYSTEM_ROLE_SLUGS.GROUP_MANAGER);
    const creator = await makeUser(SYSTEM_ROLE_SLUGS.CONTENT_CREATOR);
    learner = await makeUser(SYSTEM_ROLE_SLUGS.STUDENT);
    const outsideLearner = await makeUser(SYSTEM_ROLE_SLUGS.STUDENT);
    outsideLearnerId = outsideLearner.id;
    const groupFactory = createGroupFactory(db);
    salesId = (await groupFactory.withMembers([learner.id]).create({ name: "Sales" })).id;
    managersId = (await groupFactory.withMembers([learner.id]).create({ name: "Managers" })).id;
    outsideGroupId = (
      await groupFactory.withMembers([outsideLearner.id]).create({ name: "Outside" })
    ).id;
    await db.insert(groupManagerGroups).values({ managerUserId: manager.id, groupId: salesId });
    const courseFactory = createCourseFactory(db);
    safetyId = (await courseFactory.create({ title: "Safety", authorId: admin.id })).id;
    leadershipId = (await courseFactory.create({ title: "Leadership", authorId: creator.id })).id;
    const unstartedChapter = await createChapterFactory(db).create({
      courseId: leadershipId,
      authorId: admin.id,
    });
    await db.insert(lessons).values({
      chapterId: unstartedChapter.id,
      type: "article",
      title: { en: "Unstarted lesson" },
    });
    await db.insert(studentCourses).values([
      {
        studentId: learner.id,
        courseId: safetyId,
        status: COURSE_ENROLLMENT.ENROLLED,
        progress: "completed",
        completedAt: "2026-03-29T10:00:00Z",
        enrolledAt: "2026-03-28T23:30:00Z",
      },
      {
        studentId: learner.id,
        courseId: leadershipId,
        status: COURSE_ENROLLMENT.ENROLLED,
        progress: "in_progress",
        enrolledAt: "2026-03-30T10:00:00Z",
      },
      {
        studentId: outsideLearner.id,
        courseId: safetyId,
        status: COURSE_ENROLLMENT.ENROLLED,
        progress: "completed",
        completedAt: "2026-03-29T10:00:00Z",
      },
    ]);
    const path = await createLearningPathFactory(db).create({
      title: { en: "Onboarding" },
      baseLanguage: "en",
      availableLocales: ["en"],
      authorId: admin.id,
    });
    pathId = path.id;
    managerAuthoredPathId = (
      await createLearningPathFactory(db).create({
        title: { en: "Private author path" },
        baseLanguage: "en",
        availableLocales: ["en"],
        authorId: manager.id,
      })
    ).id;
    await db.insert(learningPathCourses).values([
      { learningPathId: pathId, courseId: safetyId, displayOrder: 0 },
      { learningPathId: pathId, courseId: leadershipId, displayOrder: 1 },
    ]);
    await db.insert(studentLearningPaths).values({
      studentId: learner.id,
      learningPathId: pathId,
      progress: "in_progress",
    });
    await db.insert(studentLearningPaths).values({
      studentId: outsideLearner.id,
      learningPathId: managerAuthoredPathId,
      progress: "in_progress",
    });
    await db.insert(studentLearningPathCourses).values([
      { studentId: learner.id, learningPathId: pathId, courseId: safetyId },
      { studentId: learner.id, learningPathId: pathId, courseId: leadershipId },
    ]);
    adminCookie = await cookieFor(admin, app);
    managerCookie = await cookieFor(manager, app);
    creatorCookie = await cookieFor(creator, app);
    learnerCookie = await cookieFor(learner, app);
  }, 120_000);

  afterAll(async () => {
    await app?.close();
  });

  it("deduplicates overlapping groups and includes individually assigned courses", async () => {
    const result = await run({ ...baseQuery(), groupIds: [salesId, managersId] });
    expect(result.total).toBe(2);
    expect(result.metrics.learners).toBe(1);
    expect(result.metrics.courseEnrollments).toBe(2);
    expect(result.metrics.courseCompletions).toBe(1);
    expect(result.metrics.courseCompletionRate).toBe(50);
    expect(result.rows.map((row) => row.course?.id).sort()).toEqual(
      [safetyId, leadershipId].sort(),
    );
    expect(result.rows.find((row) => row.course?.id === leadershipId)?.progress).toBe(0);
  });

  it("keeps OR groups within the selected population and recalculates metrics", async () => {
    const result = await run({
      ...baseQuery(),
      filter: {
        match: "any",
        rules: [
          { field: "status", operator: "eq", value: "completed" },
          {
            match: "all",
            rules: [
              { field: "courseId", operator: "eq", value: leadershipId },
              { field: "status", operator: "eq", value: "completed" },
            ],
          },
        ],
      },
    });
    expect(result.total).toBe(1);
    expect(result.rows[0].learner.id).toBe(learner.id);
    expect(result.metrics.courseCompletionRate).toBe(100);
  });

  it("requires course and status conditions to match the same enrollment", async () => {
    const result = await run({
      ...baseQuery(),
      filter: {
        match: "all",
        rules: [
          { field: "courseId", operator: "eq", value: safetyId },
          { field: "status", operator: "eq", value: "inProgress" },
        ],
      },
    });
    expect(result.total).toBe(0);
    expect(result.metrics.courseCompletionRate).toBeNull();
    expect(result.metrics.averageScore).toBeNull();
  });

  it("uses inclusive calendar dates in the selected timezone across DST", async () => {
    const result = await run({
      ...baseQuery(),
      filter: {
        match: "all",
        rules: [{ field: "enrolledAt", operator: "between", value: ["2026-03-29", "2026-03-29"] }],
      },
    });
    expect(result.total).toBe(1);
    expect(result.rows[0].course?.id).toBe(safetyId);
  });

  it("supports course and learner report subjects without changing the scope", async () => {
    const course = await run({ ...baseQuery(), view: "course", subjectId: safetyId });
    expect(course.total).toBe(1);
    const person = await run({ ...baseQuery(), view: "learner", subjectId: learner.id });
    expect(person.total).toBe(2);
  });

  it("returns one path row per learner with shared course states and course-count progress", async () => {
    const path = await run({ ...baseQuery(), view: "developmentPaths", subjectId: pathId });
    expect(path.total).toBe(1);
    expect(path.rows[0].path?.id).toBe(pathId);
    expect(path.rows[0].status).toBe("inProgress");
    expect(path.rows[0].progress).toBe(50);
    expect(path.rows[0].pathCourses).toHaveLength(2);
    expect(path.metrics.courseCompletionRate).toBe(50);
    expect(path.breakdowns.groups.map(({ id }) => id).sort()).toEqual([salesId, managersId].sort());
    for (const group of path.breakdowns.groups) {
      expect(group).toMatchObject({
        courseEnrollments: 2,
        courseCompletions: 1,
        completionRate: 50,
      });
    }
    const scoped = await run({
      ...baseQuery(),
      filter: { match: "all", rules: [{ field: "pathId", operator: "eq", value: pathId }] },
    });
    expect(scoped.total).toBe(2);
    expect(scoped.breakdowns.paths.some((item) => item.id === pathId)).toBe(true);
  });

  it("enforces reporting access and rejects references outside a manager's scope", async () => {
    await request(app.getHttpServer()).post("/api/report/query").send(baseQuery()).expect(401);
    await request(app.getHttpServer())
      .post("/api/report/query")
      .set("Cookie", learnerCookie)
      .send(baseQuery())
      .expect(403);
    const result = await run({ ...baseQuery(), groupIds: [] }, managerCookie);
    expect(new Set(result.rows.map((row) => row.learner.id))).toEqual(new Set([learner.id]));
    expect(result.rows.every((row) => row.groupIds.every((groupId) => groupId === salesId))).toBe(
      true,
    );
    expect(result.breakdowns.groups.map((group) => group.id)).toEqual([salesId]);
    const options = await request(app.getHttpServer())
      .get("/api/report/options?language=en")
      .set("Cookie", managerCookie)
      .expect(200);
    expect(options.body.data.groups.map((group: { id: string }) => group.id)).toEqual([salesId]);
    const learnerOptionIds = options.body.data.learners.map((option: { id: string }) => option.id);
    expect(learnerOptionIds).toContain(learner.id);
    const selectedLearner = await run(
      {
        ...baseQuery(),
        groupIds: [],
        filter: { match: "all", rules: [{ field: "learner", operator: "eq", value: learner.id }] },
      },
      managerCookie,
    );
    expect(selectedLearner.total).toBe(2);
    expect(selectedLearner.rows.every((row) => row.learner.id === learner.id)).toBe(true);
    const outsideLearnerResponse = await request(app.getHttpServer())
      .post("/api/report/query")
      .set("Cookie", managerCookie)
      .send({
        ...baseQuery(),
        groupIds: [],
        filter: {
          match: "all",
          rules: [{ field: "learner", operator: "eq", value: outsideLearnerId }],
        },
      })
      .expect(403);
    expect(outsideLearnerResponse.body.message).toBe(REPORT_ERRORS.LEARNER_OUTSIDE_SCOPE);
    await request(app.getHttpServer())
      .post("/api/report/query")
      .set("Cookie", managerCookie)
      .send({ ...baseQuery(), groupIds: [outsideGroupId] })
      .expect(403);
    await request(app.getHttpServer())
      .post("/api/report/query")
      .set("Cookie", managerCookie)
      .send({
        ...baseQuery(),
        view: "developmentPaths",
        subjectId: managerAuthoredPathId,
        groupIds: [],
      })
      .expect(403);
  });

  it("limits course authors to groups containing learners enrolled in their own courses", async () => {
    const options = await request(app.getHttpServer())
      .get("/api/report/options?language=en")
      .set("Cookie", creatorCookie)
      .expect(200);
    expect(new Set(options.body.data.groups.map((group: { id: string }) => group.id))).toEqual(
      new Set([salesId, managersId]),
    );

    const result = await run(baseQuery(), creatorCookie);
    expect(result.rows.map((row) => row.course?.id)).toEqual([leadershipId]);

    const outsideGroupQueries: ReportsQuery[] = [
      { ...baseQuery(), groupIds: [outsideGroupId] },
      {
        ...baseQuery(),
        filter: {
          match: "all",
          rules: [{ field: "groupId", operator: "eq", value: outsideGroupId }],
        },
      },
    ];
    for (const query of outsideGroupQueries) {
      const response = await request(app.getHttpServer())
        .post("/api/report/query")
        .set("Cookie", creatorCookie)
        .send(query)
        .expect(403);
      expect(response.body.message).toBe(REPORT_ERRORS.GROUP_OUTSIDE_SCOPE);
    }
  });

  it("validates semantic filter values and date/timezone inputs", async () => {
    const cases = [
      { query: { ...baseQuery(), timezone: "Not/AZone" }, message: REPORT_ERRORS.INVALID_TIMEZONE },
      {
        query: {
          ...baseQuery(),
          filter: { match: "all", rules: [{ field: "score", operator: "gte", value: 101 }] },
        },
        message: REPORT_ERRORS.NUMBER_OUT_OF_RANGE,
      },
      {
        query: {
          ...baseQuery(),
          filter: {
            match: "all",
            rules: [{ field: "enrolledAt", operator: "eq", value: "2026-02-30" }],
          },
        },
        message: REPORT_ERRORS.INVALID_DATE,
      },
    ];
    for (const { query, message } of cases) {
      const response = await request(app.getHttpServer())
        .post("/api/report/query")
        .set("Cookie", adminCookie)
        .send(query)
        .expect(400);
      expect(response.body.message).toBe(message);
    }
  });

  it("persists shared and personal configurations and protects ownership", async () => {
    const personal = await request(app.getHttpServer())
      .post("/api/report/configurations")
      .set("Cookie", adminCookie)
      .send({ name: "My Sales", visibility: "personal", query: baseDefinition() })
      .expect(201);
    const shared = await request(app.getHttpServer())
      .post("/api/report/configurations")
      .set("Cookie", adminCookie)
      .send({ name: "Sales progress", visibility: "shared", query: baseDefinition() })
      .expect(201);
    const list = await request(app.getHttpServer())
      .get("/api/report/configurations")
      .set("Cookie", managerCookie)
      .expect(200);
    expect(list.body.data.map((configuration: { id: string }) => configuration.id)).toContain(
      shared.body.data.id,
    );
    expect(list.body.data.map((configuration: { id: string }) => configuration.id)).not.toContain(
      personal.body.data.id,
    );
    await request(app.getHttpServer())
      .delete(`/api/report/configurations/${shared.body.data.id}`)
      .set("Cookie", managerCookie)
      .expect(403);
    await request(app.getHttpServer())
      .post("/api/report/configurations")
      .set("Cookie", managerCookie)
      .send({ name: "Forbidden shared", visibility: "shared", query: baseDefinition() })
      .expect(403);
    await request(app.getHttpServer())
      .post("/api/report/configurations")
      .set("Cookie", adminCookie)
      .send({ name: "With paging", visibility: "personal", query: baseQuery() })
      .expect(400);
  });

  it("returns saved configuration availability for nested references within the manager scope", async () => {
    const cases: Array<{ name: string; query: ReportDefinition; isAvailable: boolean }> = [
      { name: "Allowed group", query: baseDefinition(), isAvailable: true },
      {
        name: "Allowed uppercase group",
        query: { ...baseDefinition(), groupIds: [salesId.toUpperCase()] },
        isAvailable: true,
      },
      {
        name: "Outside group",
        query: { ...baseDefinition(), groupIds: [outsideGroupId] },
        isAvailable: false,
      },
      {
        name: "Outside path",
        query: {
          ...baseDefinition(),
          filter: {
            match: "all",
            rules: [
              {
                match: "any",
                rules: [{ field: "pathId", operator: "eq", value: managerAuthoredPathId }],
              },
            ],
          },
        },
        isAvailable: false,
      },
      {
        name: "Outside learner",
        query: {
          ...baseDefinition(),
          filter: {
            match: "all",
            rules: [{ field: "learner", operator: "in", value: [outsideLearnerId] }],
          },
        },
        isAvailable: false,
      },
      {
        name: "Outside subject",
        query: { ...baseDefinition(), view: "learner", subjectId: outsideLearnerId },
        isAvailable: false,
      },
    ];
    const expected = new Map<string, boolean>();
    for (const item of cases) {
      const saved = await request(app.getHttpServer())
        .post("/api/report/configurations")
        .set("Cookie", adminCookie)
        .send({ name: item.name, visibility: "shared", query: item.query })
        .expect(201);
      expected.set(saved.body.data.id, item.isAvailable);
      const [stored] = await db
        .select({
          queryType: sql<string>`jsonb_typeof(${reportsConfigurations.query})`,
          query: reportsConfigurations.query,
        })
        .from(reportsConfigurations)
        .where(eq(reportsConfigurations.id, saved.body.data.id));
      expect(stored.queryType).toBe("object");
      expect(stored.query).not.toHaveProperty("page");
      expect(stored.query).not.toHaveProperty("pageSize");
      expect(stored.query).not.toHaveProperty("language");
    }

    const response = await request(app.getHttpServer())
      .get("/api/report/configurations")
      .set("Cookie", managerCookie)
      .expect(200);
    for (const [id, isAvailable] of expected) {
      expect(
        response.body.data.find((configuration: { id: string }) => configuration.id === id),
      ).toMatchObject({
        isAvailable,
        failureCode: isAvailable ? null : REPORT_FAILURE_CODE.INACCESSIBLE_REFERENCE,
      });
    }
  });
});
