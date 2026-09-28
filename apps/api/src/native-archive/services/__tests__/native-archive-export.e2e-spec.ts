import { createHash } from "node:crypto";

import { faker } from "@faker-js/faker";
import request from "supertest";

import { DB, DB_ADMIN } from "src/storage/db/db.providers";
import { learningPathCourses } from "src/storage/schema";

import { createE2ETest } from "../../../../test/create-e2e-test";
import { createChapterFactory } from "../../../../test/factory/chapter.factory";
import { createCourseFactory } from "../../../../test/factory/course.factory";
import { createLearningPathFactory } from "../../../../test/factory/learningPath.factory";
import { createSettingsFactory } from "../../../../test/factory/settings.factory";
import { createUserFactory } from "../../../../test/factory/user.factory";
import { getNativeArchiveExportPrefix } from "../../native-archive-storage-paths";

import {
  createNativeArchiveCourseContent,
  createNativeArchiveExportStorage,
  createNativeArchiveScormPackage,
  createNativeArchiveTestTenant,
  createNativeArchiveTestUser,
  downloadNativeArchive,
  readNativeArchiveBytes,
  waitForNativeArchiveJob,
} from "./native-archive-export.e2e-utils";

import type { INestApplication } from "@nestjs/common";
import type { DatabasePg } from "src/common";

describe("NativeArchive export (e2e)", () => {
  let app: INestApplication;
  let db: DatabasePg;
  let dbAdmin: DatabasePg;
  let tenantId: string;
  let foreignTenant: Awaited<ReturnType<typeof createNativeArchiveTestTenant>>;
  let runAsTenant: <T>(tenantId: string, fn: () => Promise<T>) => Promise<T>;
  let userFactory: ReturnType<typeof createUserFactory>;
  let courseFactory: ReturnType<typeof createCourseFactory>;
  let chapterFactory: ReturnType<typeof createChapterFactory>;
  let pathFactory: ReturnType<typeof createLearningPathFactory>;
  const storage = createNativeArchiveExportStorage();

  beforeAll(async () => {
    const e2e = await createE2ETest([storage.provider]);
    app = e2e.app;
    db = app.get(DB);
    dbAdmin = app.get(DB_ADMIN);
    tenantId = e2e.defaultTenantId;
    foreignTenant = await createNativeArchiveTestTenant(dbAdmin);
    runAsTenant = e2e.runAsTenant;
    userFactory = createUserFactory(db);
    courseFactory = createCourseFactory(db);
    chapterFactory = createChapterFactory(db);
    pathFactory = createLearningPathFactory(db);
  });

  beforeEach(() => {
    storage.clear();
  });

  afterAll(async () => app.close());

  async function createAdmin() {
    const { user, cookie } = await createNativeArchiveTestUser({
      app,
      db,
      tenantId,
      runAsTenant,
      userFactory,
    });
    return { admin: user, cookie };
  }

  it("exports a course snapshot with a valid manifest and tenant-scoped key", async () => {
    const { admin, cookie } = await createAdmin();
    const assetReference = `native-archive-source/${faker.string.alphanumeric(10)}.pdf`;
    const sourceAssetBytes = Buffer.from("Deterministic lesson document bytes");
    storage.addSourceAsset(assetReference, sourceAssetBytes);
    const { course, content } = await runAsTenant(tenantId, async () => {
      const createdCourse = await courseFactory.create({
        authorId: admin.id,
        title: "Archive course in English",
        description: "Course export description",
        thumbnailS3Key: null,
        baseLanguage: "en",
        availableLocales: ["en", "pl"],
      });
      const createdContent = await createNativeArchiveCourseContent({
        db,
        chapterFactory,
        courseId: createdCourse.id,
        authorId: admin.id,
        assetReference,
      });
      return { course: createdCourse, content: createdContent };
    });

    const queued = await request(app.getHttpServer())
      .post(`/api/native-archives/courses/${course.id}/export`)
      .set("Cookie", cookie)
      .expect(201);
    const jobId = queued.body.data.jobId as string;
    const status = await waitForNativeArchiveJob(app, jobId, cookie);

    expect(status.state).toBe("completed");
    const key = storage.uploadedKeys[0];
    expect(key).toMatch(new RegExp(`^${getNativeArchiveExportPrefix(tenantId)}`));
    expect(status.result).toEqual(expect.objectContaining({ kind: "course", rootId: course.id }));
    expect(status.result).not.toHaveProperty("key");

    const downloaded = await downloadNativeArchive(app, jobId, cookie);
    expect(downloaded.headers["content-type"]).toContain("application/zip");
    expect(downloaded.headers["content-disposition"]).toContain(
      'attachment; filename="mentingo-package.zip"',
    );
    const downloadedArchive = await readNativeArchiveBytes(downloaded.body as Buffer);
    expect(downloadedArchive.manifest).toEqual(
      expect.objectContaining({
        kind: "course",
        rootId: course.id,
      }),
    );

    const archive = await storage.readArchive(key);
    expect(archive.manifest).toEqual(
      expect.objectContaining({
        format: "mentingo-package",
        kind: "course",
        rootId: course.id,
        courseIds: [course.id],
      }),
    );
    expect(archive.manifest.assets).toHaveLength(1);
    const [manifestAsset] = archive.manifest.assets;
    expect(manifestAsset).toEqual(
      expect.objectContaining({
        sourceReference: assetReference,
        byteLength: sourceAssetBytes.length,
        contentType: "application/octet-stream",
        sha256: createHash("sha256").update(sourceAssetBytes).digest("hex"),
      }),
    );
    expect(archive.assetContents.get(manifestAsset.path)).toEqual(sourceAssetBytes);
    expect(archive.courses[course.id].course).toEqual(
      expect.objectContaining({
        id: course.id,
        title: expect.objectContaining({ en: "Archive course in English" }),
      }),
    );
    expect(archive.courses[course.id].chapters).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: content.chapterId,
          title: expect.objectContaining({ en: content.chapterTitle }),
        }),
      ]),
    );
    expect(archive.courses[course.id].lessons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: content.lessonId,
          title: expect.objectContaining({ en: content.lessonTitle }),
          type: "content",
        }),
      ]),
    );
  });

  it("exports a localized learning path with its linked courses in display order", async () => {
    const { admin, cookie } = await createAdmin();
    const { pathId, courseIds } = await runAsTenant(tenantId, async () => {
      const learningPath = await pathFactory.create({
        authorId: admin.id,
        title: { en: "English path", pl: "Polska ścieżka" },
        description: { en: "English description", pl: "Polski opis" },
        baseLanguage: "pl",
        availableLocales: ["pl", "en"],
      });
      const first = await courseFactory.create({
        authorId: admin.id,
        title: "First linked course",
        thumbnailS3Key: null,
      });
      const second = await courseFactory.create({
        authorId: admin.id,
        title: "Second linked course",
        thumbnailS3Key: null,
      });
      await db.insert(learningPathCourses).values([
        { learningPathId: learningPath.id, courseId: second.id, displayOrder: 1 },
        { learningPathId: learningPath.id, courseId: first.id, displayOrder: 0 },
      ]);
      return { pathId: learningPath.id, courseIds: [first.id, second.id] };
    });

    const queued = await request(app.getHttpServer())
      .post(`/api/native-archives/learning-paths/${pathId}/export`)
      .set("Cookie", cookie)
      .expect(201);
    const status = await waitForNativeArchiveJob(app, queued.body.data.jobId, cookie);
    expect(status.state).toBe("completed");

    const key = storage.uploadedKeys[0];
    const archive = await storage.readArchive(key);
    expect(archive.manifest).toEqual(
      expect.objectContaining({
        kind: "learning-path",
        rootId: pathId,
        courseIds,
      }),
    );
    expect(archive.learningPath).toEqual(
      expect.objectContaining({
        id: pathId,
        title: { en: "English path", pl: "Polska ścieżka" },
        description: { en: "English description", pl: "Polski opis" },
        baseLanguage: "pl",
      }),
    );
    expect(archive.learningPath?.courseLinks).toEqual([
      expect.objectContaining({ courseId: courseIds[0], displayOrder: 0 }),
      expect.objectContaining({ courseId: courseIds[1], displayOrder: 1 }),
    ]);
    expect(Object.keys(archive.courses)).toEqual(courseIds);

    const student = await createNativeArchiveTestUser({
      app,
      db,
      tenantId,
      runAsTenant,
      userFactory,
      role: "student",
      emailPrefix: "archive-path-student",
    });
    await request(app.getHttpServer())
      .post(`/api/native-archives/learning-paths/${pathId}/export`)
      .set("Cookie", student.cookie)
      .expect(403);
  });

  it("exports SCORM package metadata, the original package, and extracted package files", async () => {
    const { admin, cookie } = await createAdmin();
    const { course, scorm } = await runAsTenant(tenantId, async () => {
      const createdCourse = await courseFactory.create({
        authorId: admin.id,
        title: "Course with SCORM package",
        thumbnailS3Key: null,
      });
      const content = await createNativeArchiveCourseContent({
        db,
        chapterFactory,
        courseId: createdCourse.id,
        authorId: admin.id,
        lessonType: "scorm",
      });
      const scormPackage = await createNativeArchiveScormPackage({
        db,
        lessonId: content.lessonId,
      });
      return { course: createdCourse, scorm: scormPackage };
    });

    storage.addSourceAsset(scorm.originalFileReference, scorm.originalBytes);
    for (const asset of scorm.extractedFiles) {
      storage.addSourceAsset(asset.reference, asset.bytes);
    }

    const queued = await request(app.getHttpServer())
      .post(`/api/native-archives/courses/${course.id}/export`)
      .set("Cookie", cookie)
      .expect(201);
    const status = await waitForNativeArchiveJob(app, queued.body.data.jobId, cookie);
    expect(status.state).toBe("completed");

    const archive = await storage.readArchive(storage.uploadedKeys[0]);
    const courseDocument = archive.courses[course.id];
    expect(courseDocument.scormPackages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: scorm.packageId,
          entityType: "lesson",
          standard: "scorm_1_2",
          status: "ready",
          originalFileReference: scorm.originalFileReference,
          extractedFilesReference: scorm.extractedFilesReference,
          manifestJson: scorm.manifestJson,
        }),
      ]),
    );
    expect(courseDocument.scormScos).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          packageId: scorm.packageId,
          identifier: "ITEM-EXPORT",
          title: "Exported SCO",
          href: "index.html",
        }),
      ]),
    );

    const expectedAssets = [
      { reference: scorm.originalFileReference, bytes: scorm.originalBytes },
      ...scorm.extractedFiles,
    ];
    expect(archive.manifest.assets).toHaveLength(expectedAssets.length);
    for (const expected of expectedAssets) {
      const manifestAsset = archive.manifest.assets.find(
        (asset) => asset.sourceReference === expected.reference,
      );
      expect(manifestAsset).toBeDefined();
      expect(archive.assetContents.get(manifestAsset!.path)).toEqual(expected.bytes);
    }
  });

  it("rejects access to an export job from another user and reports a missing course as failed", async () => {
    const { admin, cookie } = await createAdmin();
    const other = await createAdmin();
    await runAsTenant(foreignTenant.id, () => createSettingsFactory(db).create({ userId: null }));
    const { cookie: foreignCookie } = await createNativeArchiveTestUser({
      app,
      db,
      tenantId: foreignTenant.id,
      runAsTenant,
      userFactory,
      emailPrefix: "archive-foreign",
      referer: foreignTenant.host,
    });
    const course = await runAsTenant(tenantId, () =>
      courseFactory.create({ authorId: admin.id, thumbnailS3Key: null }),
    );
    const queued = await request(app.getHttpServer())
      .post(`/api/native-archives/courses/${course.id}/export`)
      .set("Cookie", cookie)
      .expect(201);

    const denied = await request(app.getHttpServer())
      .get(`/api/native-archives/jobs/${queued.body.data.jobId}`)
      .set("Cookie", other.cookie)
      .expect(403);
    expect(denied.body.message).toBeDefined();
    await request(app.getHttpServer())
      .get(`/api/native-archives/jobs/${queued.body.data.jobId}/download`)
      .set("Cookie", other.cookie)
      .expect(403);
    await request(app.getHttpServer())
      .get(`/api/native-archives/jobs/${queued.body.data.jobId}`)
      .set("Cookie", foreignCookie)
      .expect(403);

    const student = await createNativeArchiveTestUser({
      app,
      db,
      tenantId,
      runAsTenant,
      userFactory,
      role: "student",
      emailPrefix: "archive-student",
    });
    await request(app.getHttpServer())
      .post(`/api/native-archives/courses/${course.id}/export`)
      .set("Cookie", student.cookie)
      .expect(403);

    const missingId = faker.string.uuid();
    const missing = await request(app.getHttpServer())
      .post(`/api/native-archives/courses/${missingId}/export`)
      .set("Cookie", cookie)
      .expect(201);
    const failedStatus = await waitForNativeArchiveJob(app, missing.body.data.jobId, cookie);
    expect(failedStatus.state).toBe("failed");
  });
});
