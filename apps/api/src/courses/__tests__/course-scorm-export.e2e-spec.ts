import { Readable } from "node:stream";

import { faker } from "@faker-js/faker";
import { ENTITY_TYPES, LESSON_TYPES, SUPPORTED_LANGUAGES, SYSTEM_ROLE_SLUGS } from "@repo/shared";
import request from "supertest";
import { match } from "ts-pattern";

import { FileService } from "src/file/file.service";
import { DB, DB_ADMIN } from "src/storage/db/db.providers";

import { createE2ETest } from "../../../test/create-e2e-test";
import { createChapterFactory } from "../../../test/factory/chapter.factory";
import { createLessonFactory } from "../../../test/factory/lesson.factory";
import { createResourceFactory } from "../../../test/factory/resource.factory";
import {
  COURSE_AUTHORING_TABLES,
  createCourseAuthoringHelpers,
} from "../../../test/helpers/course-authoring";
import { createCourseEnrollmentHelpers } from "../../../test/helpers/course-enrollment";
import { truncateTables } from "../../../test/helpers/test-helpers";

import { exportCourseAsScormPackage } from "./course-scorm-export.e2e-utils";
import {
  RICH_TEXT_ASSET_KINDS,
  RICH_TEXT_ASSETS,
  SHARED_IMAGE_REFERENCE,
} from "./course-scorm-export.scenarios";

import type { INestApplication } from "@nestjs/common";
import type AdmZip from "adm-zip";
import type { DatabasePg, UUIDType } from "src/common";

const fileServiceMock = {
  assertImageReference: jest.fn(),
  getFileUrl: jest.fn(),
  getResourcesForEntity: jest.fn(),
  getRawFileBuffer: jest.fn(),
  getFileStream: jest.fn(),
  isBunnyConfigured: jest.fn(),
  uploadFile: jest.fn(),
};

const cacheManagerMock = { get: jest.fn(), set: jest.fn() };

describe("Course SCORM export (e2e)", () => {
  let app: INestApplication;
  let db: DatabasePg;
  let dbAdmin: DatabasePg;
  let runInTenant: <T>(fn: () => Promise<T>) => Promise<T>;
  let enrollmentHelpers: ReturnType<typeof createCourseEnrollmentHelpers>;
  let authoringHelpers: ReturnType<typeof createCourseAuthoringHelpers>;

  beforeAll(async () => {
    const e2e = await createE2ETest({
      useDbProxy: true,
      customProviders: [
        { provide: FileService, useValue: fileServiceMock },
        { provide: "CACHE_MANAGER", useValue: cacheManagerMock },
      ],
    });

    app = e2e.app;
    db = app.get(DB);
    dbAdmin = app.get(DB_ADMIN);
    runInTenant = (fn) => e2e.runAsTenant(e2e.defaultTenantId, fn);
    enrollmentHelpers = createCourseEnrollmentHelpers({ app, db, runInTenant });
    authoringHelpers = createCourseAuthoringHelpers({ db, runInTenant });
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await truncateTables(dbAdmin, COURSE_AUTHORING_TABLES);

    Object.values(fileServiceMock).forEach((mock) => mock.mockReset());
    Object.values(cacheManagerMock).forEach((mock) => mock.mockReset());
    fileServiceMock.assertImageReference.mockResolvedValue(undefined);
    fileServiceMock.getFileUrl.mockResolvedValue("https://storage.example.com/file");
    fileServiceMock.getResourcesForEntity.mockResolvedValue([]);
    fileServiceMock.getRawFileBuffer.mockResolvedValue(Buffer.from("file-content"));
    fileServiceMock.getFileStream.mockImplementation(async (reference: string) => ({
      stream: Readable.from([Buffer.from(`file:${reference}`)]),
    }));
    fileServiceMock.isBunnyConfigured.mockResolvedValue(false);
    cacheManagerMock.get.mockResolvedValue("");
    cacheManagerMock.set.mockResolvedValue("");

    await enrollmentHelpers.arrangeGlobalSettings();
  });

  afterEach(async () => {
    await truncateTables(dbAdmin, COURSE_AUTHORING_TABLES);
  });

  const lessonResourceUrl = (resourceId: UUIDType) => `/api/lesson/lesson-resource/${resourceId}`;

  const richTextAssetHtml = (asset: (typeof RICH_TEXT_ASSETS)[number], resourceId: UUIDType) =>
    match(asset.kind)
      .with(
        RICH_TEXT_ASSET_KINDS.VIDEO,
        () => `<div data-node-type="video" data-src="${lessonResourceUrl(resourceId)}"></div>`,
      )
      .with(
        RICH_TEXT_ASSET_KINDS.DOWNLOADABLE_FILE,
        () =>
          `<div data-node-type="downloadable-file" data-src="${lessonResourceUrl(
            resourceId,
          )}" data-name="${asset.fileName}"></div>`,
      )
      .with(
        RICH_TEXT_ASSET_KINDS.PDF_PREVIEW,
        () =>
          `<div data-node-type="pdf-preview" data-src="${lessonResourceUrl(
            resourceId,
          )}?preview=pdf" data-name="${asset.fileName}"></div>`,
      )
      .exhaustive();

  const arrangeExportableCourse = async () => {
    const admin = await enrollmentHelpers.arrangeSignedInUser(SYSTEM_ROLE_SLUGS.ADMIN);
    const course = await authoringHelpers.arrangeCourse({
      authorId: admin.user.id,
      chapterCount: 1,
    });
    const chapter = await runInTenant(() =>
      createChapterFactory(db).create({
        authorId: admin.user.id,
        courseId: course.id,
        displayOrder: 1,
        lessonCount: 2,
      }),
    );

    return { admin, course, chapter };
  };

  const arrangeContentLesson = (chapterId: UUIDType, displayOrder: number, html: string) =>
    runInTenant(() =>
      createLessonFactory(db).create({
        chapterId,
        type: LESSON_TYPES.CONTENT,
        displayOrder,
        description: { [SUPPORTED_LANGUAGES.EN]: html },
      }),
    );

  const arrangeLessonResource = ({
    resourceId,
    lessonId,
    reference,
    contentType,
    uploadedBy,
  }: {
    resourceId: UUIDType;
    lessonId: UUIDType;
    reference: string;
    contentType: string;
    uploadedBy: UUIDType;
  }) =>
    runInTenant(() =>
      createResourceFactory(db)
        .linkedTo({ entityId: lessonId, entityType: ENTITY_TYPES.LESSON })
        .create({ id: resourceId, reference, contentType, uploadedBy }),
    );

  const readCourseJson = (zip: AdmZip) =>
    JSON.parse(zip.readAsText("data/course.json")) as {
      lessons: Record<UUIDType, { html: string }>;
    };

  describe("POST /api/course/:courseId/scorm-export", () => {
    it("packages an asset reused by several lessons once", async () => {
      const { admin, course, chapter } = await arrangeExportableCourse();
      const [firstResourceId, secondResourceId] = [faker.string.uuid(), faker.string.uuid()];
      const firstLesson = await arrangeContentLesson(
        chapter.id,
        1,
        `<p><img src="${lessonResourceUrl(firstResourceId)}" /></p>`,
      );
      const secondLesson = await arrangeContentLesson(
        chapter.id,
        2,
        `<p><img src="${lessonResourceUrl(secondResourceId)}" /></p>`,
      );
      for (const [resourceId, lessonId] of [
        [firstResourceId, firstLesson.id],
        [secondResourceId, secondLesson.id],
      ]) {
        await arrangeLessonResource({
          resourceId,
          lessonId,
          reference: SHARED_IMAGE_REFERENCE,
          contentType: "image/png",
          uploadedBy: admin.user.id,
        });
      }

      const zip = await exportCourseAsScormPackage(app, course.id, admin.cookies);
      const courseJson = readCourseJson(zip);
      const packagedAssetPath = `assets/lessons/${firstLesson.id}/shared-image.png`;

      expect({
        packagedAsset: zip.getEntry(packagedAssetPath) !== null,
        duplicatedAsset: zip.getEntry(`assets/lessons/${secondLesson.id}/shared-image.png`),
        manifest: zip.readAsText("imsmanifest.xml"),
        firstLessonHtml: courseJson.lessons[firstLesson.id].html,
        secondLessonHtml: courseJson.lessons[secondLesson.id].html,
      }).toEqual({
        packagedAsset: true,
        duplicatedAsset: null,
        manifest: expect.stringContaining(packagedAssetPath),
        firstLessonHtml: expect.stringContaining(`../${packagedAssetPath}`),
        secondLessonHtml: expect.stringContaining(`../${packagedAssetPath}`),
      });
    });

    it("packages rich-text video, download and preview assets without preview query params", async () => {
      const { admin, course, chapter } = await arrangeExportableCourse();
      const assetsWithIds = RICH_TEXT_ASSETS.map((asset) => ({
        asset,
        resourceId: faker.string.uuid(),
      }));
      const lesson = await arrangeContentLesson(
        chapter.id,
        1,
        assetsWithIds.map(({ asset, resourceId }) => richTextAssetHtml(asset, resourceId)).join(""),
      );
      const lessonWithResources = await arrangeContentLesson(chapter.id, 2, "");
      for (const { asset, resourceId } of assetsWithIds) {
        await arrangeLessonResource({
          resourceId,
          lessonId: lessonWithResources.id,
          reference: asset.reference,
          contentType: asset.contentType,
          uploadedBy: admin.user.id,
        });
      }

      const zip = await exportCourseAsScormPackage(app, course.id, admin.cookies);
      const exportedHtml = readCourseJson(zip).lessons[lesson.id].html;

      expect(exportedHtml).not.toContain("?preview=pdf");
      for (const { fileName } of RICH_TEXT_ASSETS) {
        const assetPath = `assets/lessons/${lesson.id}/${fileName}`;

        expect({
          html: exportedHtml,
          packaged: zip.getEntry(assetPath) !== null,
        }).toEqual({
          html: expect.stringContaining(`data-src="../${assetPath}"`),
          packaged: true,
        });
      }
    });

    it("rejects a course that does not exist", async () => {
      const admin = await enrollmentHelpers.arrangeSignedInUser(SYSTEM_ROLE_SLUGS.ADMIN);

      const response = await request(app.getHttpServer())
        .post(`/api/course/${faker.string.uuid()}/scorm-export?language=en`)
        .set("Cookie", admin.cookies)
        .expect(404);

      expect(response.body.message).toBe("adminCourseView.scormExport.error.courseNotFound");
    });

    it("forbids exporting another author's course", async () => {
      const { course } = await arrangeExportableCourse();
      const contentCreator = await enrollmentHelpers.arrangeSignedInUser(
        SYSTEM_ROLE_SLUGS.CONTENT_CREATOR,
      );

      const response = await request(app.getHttpServer())
        .post(`/api/course/${course.id}/scorm-export?language=en`)
        .set("Cookie", contentCreator.cookies)
        .expect(403);

      expect(response.body.message).toBe("adminCourseView.scormExport.error.accessDenied");
    });
  });
});
