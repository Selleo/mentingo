import { SUPPORTED_LANGUAGES } from "@repo/shared";
import { eq } from "drizzle-orm";
import request from "supertest";
import { match } from "ts-pattern";

import { setJsonbField } from "src/common/helpers/sqlHelpers";
import { DB } from "src/storage/db/db.providers";
import { courses } from "src/storage/schema";

import { createE2ETest } from "../../../test/create-e2e-test";
import { createChapterFactory } from "../../../test/factory/chapter.factory";
import { createCourseFactory } from "../../../test/factory/course.factory";
import { createSettingsFactory } from "../../../test/factory/settings.factory";
import { prepareSharingTenants } from "../../../test/helpers/course-sharing";
import { issueIntegrationKey } from "../../../test/helpers/integration-keys";
import { truncateAllTables } from "../../../test/helpers/test-helpers";

import {
  CATALOG_ACCESS_CASES,
  CATALOG_COURSES,
  KEY_KINDS,
  KEYWORD_SEARCH_CASES,
  POLISH_TITLE,
} from "./integration-courses.scenarios";

import type { KeyKind } from "./integration-courses.scenarios";
import type { RunAsTenant, SharingTenant } from "../../../test/helpers/course-sharing";
import type { INestApplication } from "@nestjs/common";
import type { DatabasePg, UUIDType } from "src/common";

describe("Integration course catalog (e2e)", () => {
  let app: INestApplication;
  let db: DatabasePg;
  let tenantDb: DatabasePg;
  let dbAdmin: DatabasePg;
  let runAsTenant: RunAsTenant;
  let managingTenant: SharingTenant;
  let contentTenant: SharingTenant;

  beforeAll(async () => {
    const e2e = await createE2ETest({ useDbProxy: true });

    app = e2e.app;
    db = e2e.db;
    tenantDb = app.get(DB);
    dbAdmin = e2e.dbAdmin;
    runAsTenant = e2e.runAsTenant;
    ({ source: managingTenant, target: contentTenant } = await prepareSharingTenants(
      dbAdmin,
      e2e.defaultTenantId,
    ));
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await truncateAllTables(dbAdmin, db);
    await createSettingsFactory(dbAdmin).create({ userId: null });
  });

  afterEach(async () => {
    await truncateAllTables(dbAdmin, db);
  });

  /** Creates a course with chapters in the content tenant; lesson counts are per chapter. */
  const arrangeContentCourse = (
    course: { title: string; thumbnailS3Key: string | null; isArchived?: boolean },
    chapterLessonCounts: number[] = [1],
  ) =>
    runAsTenant(contentTenant.id, async () => {
      const created = await createCourseFactory(tenantDb).create({
        ...course,
        chapterCount: chapterLessonCounts.length,
      });

      for (const [index, lessonCount] of chapterLessonCounts.entries())
        await createChapterFactory(tenantDb).create({
          courseId: created.id,
          authorId: created.authorId,
          displayOrder: index + 1,
          lessonCount,
        });

      return created;
    });

  const issueKey = (keyKind: KeyKind) =>
    issueIntegrationKey({
      app,
      dbAdmin,
      isManaging: match(keyKind)
        .with(KEY_KINDS.MANAGING, () => true)
        .with(KEY_KINDS.NOT_MANAGING, () => false)
        .exhaustive(),
    });

  const listCourses = (
    apiKey: string,
    tenantId: UUIDType,
    query: Record<string, string | number> = {},
  ) =>
    request(app.getHttpServer())
      .get("/api/integration/courses")
      .set("X-API-Key", apiKey)
      .set("X-Tenant-Id", tenantId)
      .query(query);

  it("lists the selected tenant's courses with languages, counts and thumbnails", async () => {
    const { apiKey } = await issueKey(KEY_KINDS.MANAGING);
    const algebra = await arrangeContentCourse(CATALOG_COURSES.ALGEBRA, [3, 2]);
    await arrangeContentCourse(CATALOG_COURSES.BIOLOGY, []);

    const response = await listCourses(apiKey, contentTenant.id).expect(200);

    expect(response.body).toEqual({
      data: [
        {
          id: algebra.id,
          title: CATALOG_COURSES.ALGEBRA.title,
          description: algebra.description,
          baseLanguage: SUPPORTED_LANGUAGES.EN,
          availableLocales: [SUPPORTED_LANGUAGES.EN],
          thumbnailUrl: CATALOG_COURSES.ALGEBRA.thumbnailS3Key,
          status: algebra.status,
          originType: algebra.originType,
          chapterCount: 2,
          lessonCount: 5,
          updatedAt: expect.any(String),
        },
        expect.objectContaining({
          title: CATALOG_COURSES.BIOLOGY.title,
          thumbnailUrl: null,
          chapterCount: 0,
          lessonCount: 0,
        }),
      ],
      pagination: { totalItems: 2, page: 1, perPage: 20 },
    });
  });

  it("leaves out archived courses", async () => {
    const { apiKey } = await issueKey(KEY_KINDS.MANAGING);
    await arrangeContentCourse(CATALOG_COURSES.ALGEBRA);
    await arrangeContentCourse({ ...CATALOG_COURSES.BIOLOGY, isArchived: true });

    const response = await listCourses(apiKey, contentTenant.id).expect(200);

    expect(response.body.data.map((course: { title: string }) => course.title)).toEqual([
      CATALOG_COURSES.ALGEBRA.title,
    ]);
  });

  it("never returns courses of another tenant", async () => {
    const { apiKey } = await issueKey(KEY_KINDS.MANAGING);
    await runAsTenant(managingTenant.id, () =>
      createCourseFactory(tenantDb).create(CATALOG_COURSES.CHEMISTRY),
    );

    const response = await listCourses(apiKey, contentTenant.id).expect(200);

    expect(response.body).toMatchObject({ data: [], pagination: { totalItems: 0 } });
  });

  it.each(KEYWORD_SEARCH_CASES)(
    "finds $titles for the keyword '$keyword'",
    async ({ keyword, titles }) => {
      const { apiKey } = await issueKey(KEY_KINDS.MANAGING);
      for (const course of Object.values(CATALOG_COURSES)) await arrangeContentCourse(course);

      const response = await listCourses(apiKey, contentTenant.id, { keyword }).expect(200);

      expect(response.body.data.map((course: { title: string }) => course.title)).toEqual(titles);
    },
  );

  it("pages through courses in title order", async () => {
    const { apiKey } = await issueKey(KEY_KINDS.MANAGING);
    for (const course of Object.values(CATALOG_COURSES)) await arrangeContentCourse(course);

    const response = await listCourses(apiKey, contentTenant.id, { page: 2, perPage: 1 }).expect(
      200,
    );

    expect(response.body).toMatchObject({
      data: [{ title: CATALOG_COURSES.BIOLOGY.title }],
      pagination: { totalItems: 3, page: 2, perPage: 1 },
    });
  });

  it("returns titles in the requested language and falls back to the base language", async () => {
    const { apiKey } = await issueKey(KEY_KINDS.MANAGING);
    const algebra = await arrangeContentCourse(CATALOG_COURSES.ALGEBRA);
    await arrangeContentCourse(CATALOG_COURSES.BIOLOGY);
    await dbAdmin
      .update(courses)
      .set({
        title: setJsonbField(courses.title, SUPPORTED_LANGUAGES.PL, POLISH_TITLE),
        availableLocales: [SUPPORTED_LANGUAGES.EN, SUPPORTED_LANGUAGES.PL],
      })
      .where(eq(courses.id, algebra.id));

    const response = await listCourses(apiKey, contentTenant.id, {
      language: SUPPORTED_LANGUAGES.PL,
    }).expect(200);

    expect(response.body.data).toEqual([
      expect.objectContaining({ title: CATALOG_COURSES.BIOLOGY.title }),
      expect.objectContaining({
        title: POLISH_TITLE,
        availableLocales: [SUPPORTED_LANGUAGES.EN, SUPPORTED_LANGUAGES.PL],
      }),
    ]);
  });

  it.each(CATALOG_ACCESS_CASES)(
    "answers a $keyKind key with $status",
    async ({ keyKind, status }) => {
      const { apiKey, admin } = await issueKey(keyKind);

      await listCourses(apiKey, admin.tenantId).expect(status);
    },
  );

  it("requires an integration key", async () => {
    await request(app.getHttpServer())
      .get("/api/integration/courses")
      .set("X-Tenant-Id", contentTenant.id)
      .expect(401);
  });
});
