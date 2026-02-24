import { faker } from "@faker-js/faker";
import { and, eq } from "drizzle-orm";
import request from "supertest";

import { buildJsonbField } from "src/common/helpers/sqlHelpers";
import { FileService } from "src/file/file.service";
import { DB, DB_ADMIN } from "src/storage/db/db.providers";
import { chapters, courses, lessons, masterCourseExports, tenants } from "src/storage/schema";
import { USER_ROLES } from "src/user/schemas/userRoles";

import { createE2ETest } from "../../../test/create-e2e-test";
import { createCategoryFactory } from "../../../test/factory/category.factory";
import { createChapterFactory } from "../../../test/factory/chapter.factory";
import { createCourseFactory } from "../../../test/factory/course.factory";
import { createSettingsFactory } from "../../../test/factory/settings.factory";
import { createUserFactory } from "../../../test/factory/user.factory";
import { DEFAULT_TEST_TENANT_HOST } from "../../../test/helpers/tenant-helpers";
import { cookieFor, truncateTables } from "../../../test/helpers/test-helpers";

import type { INestApplication } from "@nestjs/common";
import type { DatabasePg } from "src/common";
import type { UserWithCredentials } from "test/factory/user.factory";

const SOURCE_HOST = DEFAULT_TEST_TENANT_HOST;
const TARGET_HOST = "https://tenant-2.local";
const PASSWORD = "Password123@";

type ExportSetup = {
  sourceAdmin: UserWithCredentials;
  targetAdmin: UserWithCredentials;
  sourceCourseId: string;
  sourceChapterId: string;
  sourceLessonId: string;
};

const withTenantHost = (req: request.Test, host: string) =>
  req.set("Referer", host.endsWith("/") ? host : `${host}/`);
const ensureCookieArray = (cookies: string | string[]) =>
  Array.isArray(cookies) ? cookies : [cookies];

const sleep = async (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitFor<T>(
  fetcher: () => Promise<T>,
  predicate: (value: T) => boolean,
  timeoutMs = 15000,
  intervalMs = 250,
): Promise<T> {
  const start = Date.now();
  let lastValue = await fetcher();

  while (!predicate(lastValue)) {
    if (Date.now() - start >= timeoutMs) {
      throw new Error("Timed out waiting for condition");
    }

    await sleep(intervalMs);
    lastValue = await fetcher();
  }

  return lastValue;
}

describe("Master course export and sync (e2e)", () => {
  let app: INestApplication;
  let db: DatabasePg;
  let baseDb: DatabasePg;
  let runAsTenant: <T>(tenantId: string, fn: () => Promise<T>) => Promise<T>;
  let sourceTenantId: string;
  let targetTenantId: string;

  let userFactory: ReturnType<typeof createUserFactory>;
  let settingsFactory: ReturnType<typeof createSettingsFactory>;
  let categoryFactory: ReturnType<typeof createCategoryFactory>;
  let courseFactory: ReturnType<typeof createCourseFactory>;
  let chapterFactory: ReturnType<typeof createChapterFactory>;

  beforeAll(async () => {
    const mockFileService = {
      getFileUrl: jest.fn().mockResolvedValue("http://example.com/file"),
      uploadFile: jest.fn(),
      deleteFileByPath: jest.fn(),
    };

    const mockCacheManager = {
      get: jest.fn().mockResolvedValue(""),
      set: jest.fn().mockResolvedValue(""),
    };

    const e2e = await createE2ETest([
      {
        provide: FileService,
        useValue: mockFileService,
      },
      {
        provide: "CACHE_MANAGER",
        useValue: mockCacheManager,
      },
    ]);

    app = e2e.app;
    db = app.get(DB);
    baseDb = app.get(DB_ADMIN);
    runAsTenant = e2e.runAsTenant;
    sourceTenantId = e2e.defaultTenantId;

    userFactory = createUserFactory(db);
    settingsFactory = createSettingsFactory(db);
    categoryFactory = createCategoryFactory(db);
    courseFactory = createCourseFactory(db);
    chapterFactory = createChapterFactory(db);

    await baseDb
      .update(tenants)
      .set({
        name: "Source Managing Tenant",
        host: SOURCE_HOST,
        isManaging: true,
      })
      .where(eq(tenants.id, sourceTenantId));

    const [existingTargetTenant] = await baseDb
      .select({ id: tenants.id })
      .from(tenants)
      .where(eq(tenants.host, TARGET_HOST))
      .limit(1);

    if (existingTargetTenant) {
      targetTenantId = existingTargetTenant.id;
      await baseDb
        .update(tenants)
        .set({ isManaging: false, name: "Target Tenant" })
        .where(eq(tenants.id, targetTenantId));
    } else {
      const [createdTargetTenant] = await baseDb
        .insert(tenants)
        .values({
          name: "Target Tenant",
          host: TARGET_HOST,
          isManaging: false,
        })
        .returning({ id: tenants.id });

      targetTenantId = createdTargetTenant.id;
    }
  });

  beforeEach(async () => {
    await runAsTenant(sourceTenantId, async () => {
      await settingsFactory.create({ userId: null });
    });

    await runAsTenant(targetTenantId, async () => {
      await settingsFactory.create({ userId: null });
    });
  });

  afterEach(async () => {
    await truncateTables(baseDb, [
      "master_course_entity_map",
      "master_course_exports",
      "resource_entity",
      "resources",
      "question_answer_options",
      "questions",
      "ai_mentor_lessons",
      "lessons",
      "chapters",
      "courses_summary_stats",
      "courses",
      "categories",
      "credentials",
      "user_onboarding",
      "users",
      "settings",
    ]);
  });

  afterAll(async () => {
    await app.close();
  });

  const setupAndExport = async (): Promise<
    ExportSetup & {
      sourceCookie: string[];
      targetCookie: string[];
      targetCourseId: string;
    }
  > => {
    const sourceAdmin = await runAsTenant(sourceTenantId, async () =>
      userFactory
        .withCredentials({ password: PASSWORD })
        .withAdminSettings(db)
        .create({
          email: `admin+source-${faker.string.alphanumeric(8)}@example.com`,
          role: USER_ROLES.ADMIN,
          tenantId: sourceTenantId,
        }),
    );

    const targetAdmin = await runAsTenant(targetTenantId, async () =>
      userFactory
        .withCredentials({ password: PASSWORD })
        .withAdminSettings(db)
        .create({
          email: `admin+target-${faker.string.alphanumeric(8)}@example.com`,
          role: USER_ROLES.ADMIN,
          tenantId: targetTenantId,
        }),
    );

    const sourceData = await runAsTenant(sourceTenantId, async () => {
      const category = await categoryFactory.create({ title: "Export category" });
      const sourceCourse = await courseFactory.create({
        title: "Master Source Course",
        description: "Master Source Description",
        status: "published",
        authorId: sourceAdmin.id,
        categoryId: category.id,
        chapterCount: 1,
      });

      const sourceChapter = await chapterFactory.create({
        title: "Master Source Chapter",
        courseId: sourceCourse.id,
        authorId: sourceAdmin.id,
        displayOrder: 1,
        lessonCount: 1,
      });

      const [sourceLesson] = await db
        .insert(lessons)
        .values({
          id: faker.string.uuid(),
          chapterId: sourceChapter.id,
          type: "content",
          title: buildJsonbField("en", "Master Source Lesson"),
          description: buildJsonbField("en", "Master Source Lesson Description"),
          displayOrder: 1,
        })
        .returning({ id: lessons.id });

      return {
        sourceCourseId: sourceCourse.id,
        sourceChapterId: sourceChapter.id,
        sourceLessonId: sourceLesson.id,
      };
    });

    const sourceCookie = ensureCookieArray(await cookieFor(sourceAdmin, app, SOURCE_HOST));
    const targetCookie = ensureCookieArray(await cookieFor(targetAdmin, app, TARGET_HOST));

    const exportResponse = await withTenantHost(
      request(app.getHttpServer())
        .post(`/api/course/master/${sourceData.sourceCourseId}/export`)
        .set("Cookie", sourceCookie)
        .send({ targetTenantIds: [targetTenantId] }),
      SOURCE_HOST,
    ).expect(201);

    expect(exportResponse.body.data.jobs).toHaveLength(1);
    expect(exportResponse.body.data.jobs[0].queued).toBe(true);

    const exportJobId = exportResponse.body.data.jobs[0].reason;
    expect(typeof exportJobId).toBe("string");

    await waitFor(
      async () => {
        const response = await withTenantHost(
          request(app.getHttpServer())
            .get(`/api/course/master/export-jobs/${exportJobId}`)
            .set("Cookie", sourceCookie),
          SOURCE_HOST,
        ).expect(200);

        return response.body.data as {
          state: string;
          failedReason: string | null;
        };
      },
      (job) => {
        if (job.state === "failed") {
          throw new Error(`Export job failed: ${job.failedReason ?? "unknown reason"}`);
        }

        return job.state === "completed";
      },
    );

    const exportsData = await waitFor(
      async () => {
        const response = await withTenantHost(
          request(app.getHttpServer())
            .get(`/api/course/master/${sourceData.sourceCourseId}/exports`)
            .set("Cookie", sourceCookie),
          SOURCE_HOST,
        ).expect(200);

        return response.body.data as Array<{
          targetCourseId: string;
          lastSyncedAt: string | null;
          targetTenantId: string;
        }>;
      },
      (exportsList) =>
        exportsList.length === 1 &&
        exportsList[0].targetTenantId === targetTenantId &&
        exportsList[0].targetCourseId !== sourceData.sourceCourseId &&
        Boolean(exportsList[0].lastSyncedAt),
    );

    return {
      ...sourceData,
      sourceAdmin,
      targetAdmin,
      sourceCookie,
      targetCookie,
      targetCourseId: exportsData[0].targetCourseId,
    };
  };

  it("forbids export when caller is not a managing-tenant admin", async () => {
    const targetAdmin = await runAsTenant(targetTenantId, async () =>
      userFactory
        .withCredentials({ password: PASSWORD })
        .withAdminSettings(db)
        .create({
          email: `admin+non-managing-${faker.string.alphanumeric(8)}@example.com`,
          role: USER_ROLES.ADMIN,
          tenantId: targetTenantId,
        }),
    );

    const { courseId } = await runAsTenant(targetTenantId, async () => {
      const category = await categoryFactory.create({ title: "Non-managing category" });
      const createdCourse = await courseFactory.create({
        title: "Non-managing source",
        description: "Should not be exportable by this tenant",
        authorId: targetAdmin.id,
        categoryId: category.id,
      });

      return { courseId: createdCourse.id };
    });

    const targetCookie = ensureCookieArray(await cookieFor(targetAdmin, app, TARGET_HOST));

    await withTenantHost(
      request(app.getHttpServer())
        .post(`/api/course/master/${courseId}/export`)
        .set("Cookie", targetCookie)
        .send({ targetTenantIds: [sourceTenantId] }),
      TARGET_HOST,
    ).expect(403);
  });

  it("returns export candidates excluding source tenant with export summary", async () => {
    const { sourceCourseId, sourceCookie } = await setupAndExport();

    const response = await withTenantHost(
      request(app.getHttpServer())
        .get(`/api/course/master/${sourceCourseId}/export-candidates`)
        .set("Cookie", sourceCookie),
      SOURCE_HOST,
    ).expect(200);

    const candidateTenants = response.body.data.tenants as Array<{
      id: string;
      isExported: boolean;
    }>;

    const targetTenantCandidate = candidateTenants.find((tenant) => tenant.id === targetTenantId);

    expect(targetTenantCandidate).toBeDefined();
    expect(targetTenantCandidate?.isExported).toBe(true);
    expect(candidateTenants.some((tenant) => tenant.id === sourceTenantId)).toBe(false);
    expect(response.body.data.summary.totalTenants).toBe(candidateTenants.length);
    expect(response.body.data.summary.exportedCount).toBe(1);
    expect(response.body.data.summary.remainingCount).toBe(candidateTenants.length - 1);
  });

  it("exports source course to target tenant and keeps exported copy readonly", async () => {
    const { sourceCourseId, sourceChapterId, sourceLessonId, targetCourseId, targetCookie } =
      await setupAndExport();

    const targetCourseResponse = await withTenantHost(
      request(app.getHttpServer())
        .get("/api/course/beta-course-by-id")
        .query({ id: targetCourseId, language: "en" })
        .set("Cookie", targetCookie),
      TARGET_HOST,
    ).expect(200);

    expect(targetCourseResponse.body.data.id).toBe(targetCourseId);
    expect(targetCourseResponse.body.data.originType).toBe("exported");
    expect(targetCourseResponse.body.data.isContentReadonly).toBe(true);
    expect(targetCourseResponse.body.data.sourceCourseId).toBe(sourceCourseId);
    expect(targetCourseResponse.body.data.sourceTenantId).toBe(sourceTenantId);
    expect(targetCourseResponse.body.data.title).toBe("Master Source Course");
    expect(targetCourseResponse.body.data.description).toBe("Master Source Description");
    expect(targetCourseResponse.body.data.chapters[0].title).toBe("Master Source Chapter");
    expect(targetCourseResponse.body.data.chapters[0].lessons[0].title).toBe(
      "Master Source Lesson",
    );

    await withTenantHost(
      request(app.getHttpServer())
        .patch(`/api/course/${targetCourseId}`)
        .set("Cookie", targetCookie)
        .send({ title: "Should be blocked", language: "en" }),
      TARGET_HOST,
    ).expect(403);

    const targetLessonId = targetCourseResponse.body.data.chapters[0].lessons[0].id as string;

    await withTenantHost(
      request(app.getHttpServer())
        .patch("/api/lesson/beta-update-lesson")
        .query({ id: targetLessonId })
        .set("Cookie", targetCookie)
        .send({ title: "Blocked lesson update", language: "en" }),
      TARGET_HOST,
    ).expect(403);

    await runAsTenant(sourceTenantId, async () => {
      const [sourceCourse] = await db
        .select({ id: courses.id })
        .from(courses)
        .where(eq(courses.id, sourceCourseId))
        .limit(1);

      const [sourceChapter] = await db
        .select({ id: chapters.id })
        .from(chapters)
        .where(eq(chapters.id, sourceChapterId))
        .limit(1);

      const [sourceLesson] = await db
        .select({ id: lessons.id })
        .from(lessons)
        .where(eq(lessons.id, sourceLessonId))
        .limit(1);

      expect(sourceCourse).toBeDefined();
      expect(sourceChapter).toBeDefined();
      expect(sourceLesson).toBeDefined();
    });
  });

  it("propagates source course updates to exported target course", async () => {
    const { sourceCourseId, sourceLessonId, sourceCookie, targetCookie, targetCourseId } =
      await setupAndExport();

    await withTenantHost(
      request(app.getHttpServer())
        .patch(`/api/course/${sourceCourseId}`)
        .set("Cookie", sourceCookie)
        .send({
          title: "Master Updated Title",
          description: "Master Updated Description",
          language: "en",
        }),
      SOURCE_HOST,
    ).expect(200);

    const createChapterResponse = await withTenantHost(
      request(app.getHttpServer())
        .post("/api/chapter/beta-create-chapter")
        .set("Cookie", sourceCookie)
        .send({
          title: "Master New Chapter",
          courseId: sourceCourseId,
          isFreemium: false,
        }),
      SOURCE_HOST,
    ).expect(201);

    const newChapterId = createChapterResponse.body.data.id as string;

    await withTenantHost(
      request(app.getHttpServer())
        .post("/api/lesson/beta-create-lesson")
        .set("Cookie", sourceCookie)
        .send({
          title: "Master New Lesson",
          description: "Master New Lesson Description",
          chapterId: newChapterId,
          type: "content",
        }),
      SOURCE_HOST,
    ).expect(201);

    await withTenantHost(
      request(app.getHttpServer())
        .patch("/api/lesson/beta-update-lesson")
        .query({ id: sourceLessonId })
        .set("Cookie", sourceCookie)
        .send({
          title: "Master Updated Lesson",
          language: "en",
        }),
      SOURCE_HOST,
    ).expect(200);

    const syncedTargetCourse = await waitFor(
      async () => {
        const response = await withTenantHost(
          request(app.getHttpServer())
            .get("/api/course/beta-course-by-id")
            .query({ id: targetCourseId, language: "en" })
            .set("Cookie", targetCookie),
          TARGET_HOST,
        ).expect(200);

        return response.body.data as {
          title: string;
          description: string;
          chapters: Array<{ title: string; lessons: Array<{ title: string }> }>;
        };
      },
      (data) => {
        const hasNewChapter = data.chapters.some(
          (chapter) => chapter.title === "Master New Chapter",
        );
        const hasNewLesson = data.chapters.some((chapter) =>
          chapter.lessons.some((lesson) => lesson.title === "Master New Lesson"),
        );
        const hasUpdatedLesson = data.chapters.some((chapter) =>
          chapter.lessons.some((lesson) => lesson.title === "Master Updated Lesson"),
        );

        return (
          data.title === "Master Updated Title" &&
          data.description === "Master Updated Description" &&
          hasNewChapter &&
          hasNewLesson &&
          hasUpdatedLesson
        );
      },
      20000,
      300,
    );

    expect(syncedTargetCourse.title).toBe("Master Updated Title");
    expect(syncedTargetCourse.description).toBe("Master Updated Description");

    const [exportLink] = await baseDb
      .select({
        targetCourseId: masterCourseExports.targetCourseId,
        lastSyncedAt: masterCourseExports.lastSyncedAt,
      })
      .from(masterCourseExports)
      .where(
        and(
          eq(masterCourseExports.sourceTenantId, sourceTenantId),
          eq(masterCourseExports.sourceCourseId, sourceCourseId),
          eq(masterCourseExports.targetTenantId, targetTenantId),
        ),
      )
      .limit(1);

    expect(exportLink).toBeDefined();
    expect(exportLink.targetCourseId).toBe(targetCourseId);
    expect(exportLink.lastSyncedAt).toBeTruthy();
  });

  it("returns already-linked and keeps single export link when exporting same course twice", async () => {
    const { sourceCourseId, sourceCookie } = await setupAndExport();

    const secondExportResponse = await withTenantHost(
      request(app.getHttpServer())
        .post(`/api/course/master/${sourceCourseId}/export`)
        .set("Cookie", sourceCookie)
        .send({ targetTenantIds: [targetTenantId] }),
      SOURCE_HOST,
    ).expect(201);

    expect(secondExportResponse.body.data.jobs).toHaveLength(1);
    expect(secondExportResponse.body.data.jobs[0].queued).toBe(false);
    expect(secondExportResponse.body.data.jobs[0].reason).toBe("already-linked");

    const links = await baseDb
      .select({ id: masterCourseExports.id })
      .from(masterCourseExports)
      .where(
        and(
          eq(masterCourseExports.sourceTenantId, sourceTenantId),
          eq(masterCourseExports.sourceCourseId, sourceCourseId),
          eq(masterCourseExports.targetTenantId, targetTenantId),
        ),
      );

    expect(links).toHaveLength(1);
  });

  it("propagates lesson deletion from source tenant to exported target course", async () => {
    const { sourceLessonId, sourceCookie, targetCookie, targetCourseId } = await setupAndExport();

    await withTenantHost(
      request(app.getHttpServer())
        .delete("/api/lesson")
        .query({ lessonId: sourceLessonId })
        .set("Cookie", sourceCookie),
      SOURCE_HOST,
    ).expect(200);

    const syncedTargetCourse = await waitFor(
      async () => {
        const response = await withTenantHost(
          request(app.getHttpServer())
            .get("/api/course/beta-course-by-id")
            .query({ id: targetCourseId, language: "en" })
            .set("Cookie", targetCookie),
          TARGET_HOST,
        ).expect(200);

        return response.body.data as {
          chapters: Array<{ lessons: Array<{ title: string }> }>;
        };
      },
      (data) =>
        data.chapters.every((chapter) =>
          chapter.lessons.every((lesson) => lesson.title !== "Master Source Lesson"),
        ),
      20000,
      300,
    );

    expect(
      syncedTargetCourse.chapters.some((chapter) =>
        chapter.lessons.some((lesson) => lesson.title === "Master Source Lesson"),
      ),
    ).toBe(false);
  });
});
