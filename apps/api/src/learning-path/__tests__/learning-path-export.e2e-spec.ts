import { faker } from "@faker-js/faker";
import { SYSTEM_ROLE_SLUGS } from "@repo/shared";
import { and, eq } from "drizzle-orm";
import request from "supertest";

import { FileService } from "src/file/file.service";
import { DB, DB_ADMIN } from "src/storage/db/db.providers";
import { learningPathExports, learningPaths, tenants } from "src/storage/schema";

import { createE2ETest } from "../../../test/create-e2e-test";
import { createCourseFactory } from "../../../test/factory/course.factory";
import { createLearningPathFactory } from "../../../test/factory/learningPath.factory";
import { createSettingsFactory } from "../../../test/factory/settings.factory";
import { createUserFactory } from "../../../test/factory/user.factory";
import { cookieFor, truncateTables } from "../../../test/helpers/test-helpers";

import {
  createLearningPathExportTestUtils,
  ensureCookieArray,
  PASSWORD,
  SOURCE_HOST,
  TABLES_TO_TRUNCATE,
  TARGET_HOST,
  waitFor,
  withTenantHost,
} from "./learning-path-export.e2e-utils";

import type { INestApplication } from "@nestjs/common";
import type { DatabasePg } from "src/common";

describe("LearningPathExportController (e2e)", () => {
  let app: INestApplication;
  let db: DatabasePg;
  let baseDb: DatabasePg;
  let runAsTenant: <T>(tenantId: string, fn: () => Promise<T>) => Promise<T>;
  let sourceTenantId: string;
  let targetTenantId: string;

  let userFactory: ReturnType<typeof createUserFactory>;
  let settingsFactory: ReturnType<typeof createSettingsFactory>;
  let courseFactory: ReturnType<typeof createCourseFactory>;
  let learningPathFactory: ReturnType<typeof createLearningPathFactory>;
  let exportPath: ReturnType<typeof createLearningPathExportTestUtils>["exportPath"];
  let getExportedLearningPath: ReturnType<
    typeof createLearningPathExportTestUtils
  >["getExportedLearningPath"];
  let getLearningPathCourseLinks: ReturnType<
    typeof createLearningPathExportTestUtils
  >["getLearningPathCourseLinks"];

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
    courseFactory = createCourseFactory(db);
    learningPathFactory = createLearningPathFactory(db);

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

    const learningPathExportUtils = createLearningPathExportTestUtils({
      app,
      baseDb,
      targetTenantId,
    });

    exportPath = learningPathExportUtils.exportPath;
    getExportedLearningPath = learningPathExportUtils.getExportedLearningPath;
    getLearningPathCourseLinks = learningPathExportUtils.getLearningPathCourseLinks;
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
    await truncateTables(baseDb, TABLES_TO_TRUNCATE);
  });

  afterAll(async () => {
    await app.close();
  });

  const setupSourcePath = async () => {
    const sourceAdmin = await runAsTenant(sourceTenantId, async () =>
      userFactory
        .withCredentials({ password: PASSWORD })
        .withAdminSettings(db)
        .create({
          email: `admin+source-${faker.string.alphanumeric(8)}@example.com`,
          role: SYSTEM_ROLE_SLUGS.ADMIN,
          tenantId: sourceTenantId,
        }),
    );

    const targetAdmin = await runAsTenant(targetTenantId, async () =>
      userFactory
        .withCredentials({ password: PASSWORD })
        .withAdminSettings(db)
        .create({
          email: `admin+target-${faker.string.alphanumeric(8)}@example.com`,
          role: SYSTEM_ROLE_SLUGS.ADMIN,
          tenantId: targetTenantId,
        }),
    );

    const sourceCookie = ensureCookieArray(await cookieFor(sourceAdmin, app, SOURCE_HOST));
    const targetCookie = ensureCookieArray(await cookieFor(targetAdmin, app, TARGET_HOST));

    const { learningPathId, courseIds } = await runAsTenant(sourceTenantId, async () => {
      const learningPath = await learningPathFactory.create({
        authorId: sourceAdmin.id,
        title: { en: "Source learning path" },
        description: { en: "Source learning path description" },
        baseLanguage: "en",
        availableLocales: ["en"],
        includesCertificate: true,
        sequenceEnabled: true,
      });

      const courseOne = await courseFactory.create({
        title: "Source course one",
        description: "Source course one description",
        authorId: sourceAdmin.id,
      });
      const courseTwo = await courseFactory.create({
        title: "Source course two",
        description: "Source course two description",
        authorId: sourceAdmin.id,
      });

      return {
        learningPathId: learningPath.id,
        courseIds: [courseOne.id, courseTwo.id],
      };
    });

    await withTenantHost(
      request(app.getHttpServer())
        .post(`/api/learning-path/${learningPathId}/courses`)
        .set("Cookie", sourceCookie)
        .send({ courseIds }),
      SOURCE_HOST,
    ).expect(201);

    return {
      learningPathId,
      sourceAdmin,
      targetAdmin,
      sourceCookie,
      targetCookie,
      courseIds,
    };
  };

  it("exports a learning path to a target tenant and syncs the target copy", async () => {
    const { learningPathId, sourceCookie, targetCookie } = await setupSourcePath();

    const exportResponse = await exportPath(learningPathId, sourceCookie, [targetTenantId]);
    const exportId = exportResponse.jobs[0].exportId;

    expect(exportResponse.sourceLearningPathId).toBe(learningPathId);
    expect(exportResponse.jobs).toHaveLength(1);
    expect(exportResponse.jobs[0].queued).toBe(true);
    expect(typeof exportId).toBe("string");

    const exportedLearningPath = await getExportedLearningPath(learningPathId, sourceCookie);

    expect(exportedLearningPath).toEqual(
      expect.objectContaining({
        sourceLearningPathId: learningPathId,
        targetTenantId,
        targetLearningPathId: expect.any(String),
        lastSyncedAt: expect.any(String),
      }),
    );

    const candidatesResponse = await withTenantHost(
      request(app.getHttpServer())
        .get(`/api/learning-path/master/${learningPathId}/export-candidates`)
        .set("Cookie", sourceCookie),
      SOURCE_HOST,
    ).expect(200);

    const targetCandidate = candidatesResponse.body.data.tenants.find(
      (tenant: { id: string }) => tenant.id === targetTenantId,
    );

    expect(targetCandidate).toBeDefined();
    expect(targetCandidate.isExported).toBe(true);
    expect(
      candidatesResponse.body.data.tenants.some(
        (tenant: { id: string }) => tenant.id === sourceTenantId,
      ),
    ).toBe(false);
    expect(candidatesResponse.body.data.summary.totalTenants).toBe(
      candidatesResponse.body.data.tenants.length,
    );
    expect(candidatesResponse.body.data.summary.exportedCount).toBe(1);
    expect(candidatesResponse.body.data.summary.remainingCount).toBe(
      candidatesResponse.body.data.tenants.length - 1,
    );

    const targetLearningPathId = exportedLearningPath.targetLearningPathId as string;

    const [targetLearningPath] = await baseDb
      .select()
      .from(learningPaths)
      .where(eq(learningPaths.id, targetLearningPathId))
      .limit(1);

    expect(targetLearningPath).toBeDefined();
    expect(targetLearningPath?.tenantId).toBe(targetTenantId);
    expect(targetLearningPath?.originType).toBe("exported");
    expect(targetLearningPath?.sourceTenantId).toBe(sourceTenantId);
    expect(targetLearningPath?.sourceLearningPathId).toBe(learningPathId);
    expect(targetLearningPath?.title).toEqual(
      expect.objectContaining({ en: "Source learning path" }),
    );
    expect(targetLearningPath?.description).toEqual(
      expect.objectContaining({ en: "Source learning path description" }),
    );

    const targetCourseLinks = await getLearningPathCourseLinks(targetLearningPathId);

    expect(targetCourseLinks).toHaveLength(2);
    expect(targetCourseLinks.map(({ displayOrder }) => displayOrder)).toEqual([1, 2]);

    for (const { courseId } of targetCourseLinks) {
      const targetCourseResponse = await withTenantHost(
        request(app.getHttpServer())
          .get("/api/course/beta-course-by-id")
          .query({ id: courseId, language: "en" })
          .set("Cookie", targetCookie),
        TARGET_HOST,
      ).expect(200);

      expect(targetCourseResponse.body.data.id).toBe(courseId);
      expect(targetCourseResponse.body.data.originType).toBe("exported");
      expect(targetCourseResponse.body.data.sourceTenantId).toBe(sourceTenantId);
    }
  });

  it("syncs target learning path metadata after the source path is updated", async () => {
    const { learningPathId, sourceCookie } = await setupSourcePath();
    await exportPath(learningPathId, sourceCookie, [targetTenantId]);

    const exportedLearningPath = await getExportedLearningPath(learningPathId, sourceCookie);
    const targetLearningPathId = exportedLearningPath.targetLearningPathId as string;

    await withTenantHost(
      request(app.getHttpServer())
        .patch(`/api/learning-path/${learningPathId}`)
        .set("Cookie", sourceCookie)
        .send({
          language: "en",
          title: "Updated exported path",
          description: "Updated exported path description",
          sequenceEnabled: false,
        }),
      SOURCE_HOST,
    ).expect(200);

    const targetLearningPath = await waitFor(
      async () => {
        const [path] = await baseDb
          .select({
            title: learningPaths.title,
            description: learningPaths.description,
            sequenceEnabled: learningPaths.sequenceEnabled,
          })
          .from(learningPaths)
          .where(eq(learningPaths.id, targetLearningPathId))
          .limit(1);

        return path;
      },
      (path) =>
        path?.title?.en === "Updated exported path" &&
        path?.description?.en === "Updated exported path description" &&
        path?.sequenceEnabled === false,
      20000,
    );

    expect(targetLearningPath.title).toEqual(
      expect.objectContaining({ en: "Updated exported path" }),
    );
    expect(targetLearningPath.description).toEqual(
      expect.objectContaining({ en: "Updated exported path description" }),
    );
    expect(targetLearningPath.sequenceEnabled).toBe(false);
  });

  it("syncs target course order after source learning path courses are reordered", async () => {
    const { learningPathId, sourceCookie, courseIds } = await setupSourcePath();
    await exportPath(learningPathId, sourceCookie, [targetTenantId]);

    const exportedLearningPath = await getExportedLearningPath(learningPathId, sourceCookie);
    const targetLearningPathId = exportedLearningPath.targetLearningPathId as string;
    const initialTargetCourseLinks = await getLearningPathCourseLinks(targetLearningPathId);

    await withTenantHost(
      request(app.getHttpServer())
        .patch(`/api/learning-path/${learningPathId}/courses/reorder`)
        .set("Cookie", sourceCookie)
        .send({ courseIds: [...courseIds].reverse() }),
      SOURCE_HOST,
    ).expect(200);

    const reorderedTargetCourseLinks = await waitFor(
      () => getLearningPathCourseLinks(targetLearningPathId),
      (courseLinks) =>
        courseLinks.length === 2 &&
        courseLinks[0].courseId === initialTargetCourseLinks[1].courseId &&
        courseLinks[1].courseId === initialTargetCourseLinks[0].courseId,
      20000,
    );

    expect(reorderedTargetCourseLinks.map(({ displayOrder }) => displayOrder)).toEqual([1, 2]);
  });

  it("reuses an existing exported course when exporting a learning path", async () => {
    const { learningPathId, sourceCookie, targetCookie, courseIds } = await setupSourcePath();

    const courseExportResponse = await withTenantHost(
      request(app.getHttpServer())
        .post(`/api/course/master/${courseIds[0]}/export`)
        .set("Cookie", sourceCookie)
        .send({ targetTenantIds: [targetTenantId] }),
      SOURCE_HOST,
    ).expect(201);

    const courseExportJobId = courseExportResponse.body.data.jobs[0].reason as string;

    await waitFor(
      async () => {
        const response = await withTenantHost(
          request(app.getHttpServer())
            .get(`/api/course/master/export-jobs/${courseExportJobId}`)
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
          throw new Error(`Course export job failed: ${job.failedReason ?? "unknown reason"}`);
        }

        return job.state === "completed";
      },
    );

    const courseExportsResponse = await withTenantHost(
      request(app.getHttpServer())
        .get(`/api/course/master/${courseIds[0]}/exports`)
        .set("Cookie", sourceCookie),
      SOURCE_HOST,
    ).expect(200);

    const reusedTargetCourseId = courseExportsResponse.body.data[0].targetCourseId as string;

    await exportPath(learningPathId, sourceCookie, [targetTenantId]);

    const exportedLearningPath = await getExportedLearningPath(learningPathId, sourceCookie);
    const targetCourseLinks = await getLearningPathCourseLinks(
      exportedLearningPath.targetLearningPathId as string,
    );

    expect(targetCourseLinks.map(({ courseId }) => courseId)).toContain(reusedTargetCourseId);

    const reusedCourseResponse = await withTenantHost(
      request(app.getHttpServer())
        .get("/api/course/beta-course-by-id")
        .query({ id: reusedTargetCourseId, language: "en" })
        .set("Cookie", targetCookie),
      TARGET_HOST,
    ).expect(200);

    expect(reusedCourseResponse.body.data.id).toBe(reusedTargetCourseId);
    expect(reusedCourseResponse.body.data.sourceCourseId).toBe(courseIds[0]);
  });

  it("reuses the same export link when exporting the same learning path twice", async () => {
    const { learningPathId, sourceCookie } = await setupSourcePath();

    const firstExportResponse = await exportPath(learningPathId, sourceCookie, [targetTenantId]);
    const firstExportId = firstExportResponse.jobs[0].exportId;

    const secondExportResponse = await withTenantHost(
      request(app.getHttpServer())
        .post(`/api/learning-path/master/${learningPathId}/export`)
        .set("Cookie", sourceCookie)
        .send({ targetTenantIds: [targetTenantId] }),
      SOURCE_HOST,
    ).expect(201);

    expect(secondExportResponse.body.data.jobs).toHaveLength(1);
    expect(secondExportResponse.body.data.jobs[0].queued).toBe(true);
    expect(secondExportResponse.body.data.jobs[0].exportId).toBe(firstExportId);

    await waitFor(
      async () => {
        const response = await withTenantHost(
          request(app.getHttpServer())
            .get(`/api/learning-path/master/${learningPathId}/exports`)
            .set("Cookie", sourceCookie),
          SOURCE_HOST,
        ).expect(200);

        return response.body.data as Array<{
          sourceLearningPathId: string;
          targetTenantId: string;
          targetLearningPathId: string | null;
          lastSyncedAt: string | null;
        }>;
      },
      (exportsList) =>
        exportsList.length === 1 &&
        exportsList[0].targetTenantId === targetTenantId &&
        Boolean(exportsList[0].targetLearningPathId) &&
        Boolean(exportsList[0].lastSyncedAt),
    );

    const exportRows = await baseDb
      .select({ id: learningPathExports.id })
      .from(learningPathExports)
      .where(
        and(
          eq(learningPathExports.sourceTenantId, sourceTenantId),
          eq(learningPathExports.sourceLearningPathId, learningPathId),
          eq(learningPathExports.targetTenantId, targetTenantId),
        ),
      );

    expect(exportRows).toHaveLength(1);
  });
});
