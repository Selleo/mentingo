import { randomUUID } from "node:crypto";
import { Readable } from "node:stream";

import { ENTITY_TYPES } from "@repo/shared";
import { eq } from "drizzle-orm";
import { match } from "ts-pattern";

import { BunnyStreamService } from "src/bunny/bunnyStream.service";
import { S3Service } from "src/s3/s3.service";
import { DB, DB_ADMIN } from "src/storage/db/db.providers";
import { courses, lessons } from "src/storage/schema";

import { createE2ETest } from "../../../test/create-e2e-test";
import { createResourceFactory } from "../../../test/factory/resource.factory";
import {
  COURSE_SHARING_TABLES,
  createCourseTransferDriver,
  createGlobalSettingsForTenants,
  createSourceCourse,
  prepareSharingTenants,
  requestCourseExport,
  signInAsTenantAdmin,
} from "../../../test/helpers/course-sharing";
import { truncateTables } from "../../../test/helpers/test-helpers";
import { waitForOutbox } from "../../../test/helpers/wait-for-outbox";

import {
  DUPLICATION_AUTHORITY_CASES,
  KEY_OWNERS,
  SHARING_AUTHORITY_CASES,
  SOURCE_ASSET_EXTENSIONS,
  SOURCE_ASSET_FIELDS,
} from "./course-transfer-asset-authority.scenarios";

import type { KeyOwner, SourceAssetField } from "./course-transfer-asset-authority.scenarios";
import type { UserWithCredentials } from "../../../test/factory/user.factory";
import type {
  RunAsTenant,
  SharingTenant,
  SourceCourse,
  TenantHttpClient,
} from "../../../test/helpers/course-sharing";
import type { INestApplication } from "@nestjs/common";
import type { DatabasePg, UUIDType } from "src/common";

const s3ServiceMock = {
  copyFile: jest.fn(),
  deleteFile: jest.fn(),
  getFileContentType: jest.fn(),
  getFileExists: jest.fn(),
  getFileStream: jest.fn(),
  getSignedUrl: jest.fn(),
  isConfigured: jest.fn(),
  listFileKeysByPrefix: jest.fn(),
  uploadStreamMultipart: jest.fn(),
};

const bunnyStreamServiceMock = {
  getMediaConfigurationSignature: jest.fn(),
  getUrl: jest.fn(),
  isConfigured: jest.fn(),
};

describe("Course transfer asset authority (e2e)", () => {
  let app: INestApplication;
  let db: DatabasePg;
  let dbAdmin: DatabasePg;
  let runAsTenant: RunAsTenant;
  let source: SharingTenant;
  let target: SharingTenant;
  let sourceAdmin: UserWithCredentials;
  let sourceHttp: TenantHttpClient;
  let transferDriver: ReturnType<typeof createCourseTransferDriver>;

  beforeAll(async () => {
    const e2e = await createE2ETest({
      useDbProxy: true,
      customProviders: [
        { provide: S3Service, useValue: s3ServiceMock },
        { provide: BunnyStreamService, useValue: bunnyStreamServiceMock },
        {
          provide: "CACHE_MANAGER",
          useValue: { get: jest.fn().mockResolvedValue(""), set: jest.fn() },
        },
      ],
    });

    app = e2e.app;
    db = app.get(DB);
    dbAdmin = app.get(DB_ADMIN);
    runAsTenant = e2e.runAsTenant;
    ({ source, target } = await prepareSharingTenants(dbAdmin, e2e.defaultTenantId));
    transferDriver = createCourseTransferDriver(app, dbAdmin);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await truncateTables(dbAdmin, COURSE_SHARING_TABLES);
    restoreProviderDoubles();

    await createGlobalSettingsForTenants(db, runAsTenant, [source, target]);
    ({ admin: sourceAdmin, http: sourceHttp } = await signInAsTenantAdmin({
      app,
      db,
      runAsTenant,
      tenant: source,
    }));
    await signInAsTenantAdmin({ app, db, runAsTenant, tenant: target });
  });

  afterEach(async () => {
    await truncateTables(dbAdmin, COURSE_SHARING_TABLES);
  });

  const restoreProviderDoubles = () => {
    Object.values(s3ServiceMock).forEach((mock) => mock.mockReset());
    Object.values(bunnyStreamServiceMock).forEach((mock) => mock.mockReset());

    s3ServiceMock.isConfigured.mockReturnValue(true);
    // Every source object exists, so only application authority can stop a copy.
    s3ServiceMock.getFileExists.mockImplementation(
      async (key: string) => !key.includes("/master-course/"),
    );
    s3ServiceMock.getFileStream.mockImplementation(async () => ({
      stream: Readable.from(Buffer.from("bytes")),
      contentType: "application/octet-stream",
    }));
    s3ServiceMock.getSignedUrl.mockImplementation(
      async (key: string) => `https://storage.example.com/${key}`,
    );
    s3ServiceMock.listFileKeysByPrefix.mockResolvedValue([]);
    bunnyStreamServiceMock.isConfigured.mockResolvedValue(false);
    bunnyStreamServiceMock.getMediaConfigurationSignature.mockResolvedValue("");
  };

  const buildKeyOwnedBy = (owner: KeyOwner, extension: string) =>
    match(owner)
      .with(KEY_OWNERS.SOURCE_TENANT, () => `${source.id}/lesson/${randomUUID()}${extension}`)
      .with(KEY_OWNERS.NO_TENANT, () => `lesson/${randomUUID()}${extension}`)
      .with(KEY_OWNERS.OTHER_TENANT, () => `${target.id}/lesson/${randomUUID()}${extension}`)
      .exhaustive();

  const placeAsset = (field: SourceAssetField, { courseId, lessonId }: SourceCourse, key: string) =>
    runAsTenant(source.id, () =>
      match(field)
        .with(SOURCE_ASSET_FIELDS.LESSON_VIDEO, async () => {
          await db
            .update(lessons)
            .set({ fileS3Key: key, fileType: "mp4" })
            .where(eq(lessons.id, lessonId));
        })
        .with(SOURCE_ASSET_FIELDS.COURSE_THUMBNAIL, async () => {
          await db.update(courses).set({ thumbnailS3Key: key }).where(eq(courses.id, courseId));
        })
        .with(SOURCE_ASSET_FIELDS.LESSON_ATTACHMENT, async () => {
          await createResourceFactory(db)
            .linkedTo({ entityId: lessonId, entityType: ENTITY_TYPES.LESSON })
            .create({ reference: key, contentType: "application/pdf" });
        })
        .exhaustive(),
    );

  const createCourse = () =>
    createSourceCourse({ db, runAsTenant, tenant: source, authorId: sourceAdmin.id });

  const findCopyDestination = (sourceKey: string) =>
    s3ServiceMock.copyFile.mock.calls.find(([copiedKey]) => copiedKey === sourceKey)?.[1];

  const findCalledSourceKeys = () => [
    ...s3ServiceMock.copyFile.mock.calls.map(([sourceKey]) => sourceKey),
    ...s3ServiceMock.getFileStream.mock.calls.map(([sourceKey]) => sourceKey),
  ];

  describe("sharing a course", () => {
    it.each(SHARING_AUTHORITY_CASES)("a $field key owned by $owner", async ({ field, owner }) => {
      const key = buildKeyOwnedBy(owner, SOURCE_ASSET_EXTENSIONS[field]);
      const sourceCourse = await createCourse();
      await placeAsset(field, sourceCourse, key);
      const operationId = await requestCourseExport(sourceHttp, sourceCourse.courseId, [target.id]);

      const transfer = transferDriver.transferOperation(operationId);

      await match(owner)
        .with(KEY_OWNERS.OTHER_TENANT, async () => {
          await expect(transfer).rejects.toMatchObject({
            message: "masterCourse.error.foreignSourceAsset",
          });
          expect(findCalledSourceKeys()).not.toContain(key);
        })
        .with(KEY_OWNERS.SOURCE_TENANT, KEY_OWNERS.NO_TENANT, async () => {
          await expect(transfer).resolves.toEqual(expect.any(String));
          expect(findCopyDestination(key)).toContain(`${target.id}/master-course/`);
        })
        .exhaustive();
    });

    it("keeps a recipient reference to a missing foreign key without copying anything", async () => {
      const missingForeignKey = buildKeyOwnedBy(KEY_OWNERS.OTHER_TENANT, ".png");
      s3ServiceMock.getFileExists.mockImplementation(
        async (key: string) => key !== missingForeignKey,
      );
      const sourceCourse = await createCourse();
      await placeAsset(SOURCE_ASSET_FIELDS.COURSE_THUMBNAIL, sourceCourse, missingForeignKey);
      const operationId = await requestCourseExport(sourceHttp, sourceCourse.courseId, [target.id]);

      await expect(transferDriver.transferOperation(operationId)).resolves.toEqual(
        expect.any(String),
      );
      expect(findCalledSourceKeys()).not.toContain(missingForeignKey);
    });
  });

  describe("duplicating a course", () => {
    const duplicateCourse = async (courseId: UUIDType) => {
      const response = await sourceHttp.post(`/api/course/${courseId}/duplicate`).expect(201);
      const { jobId } = response.body.data as { jobId: string };

      return waitForOutbox(
        app,
        async () => {
          const jobResponse = await sourceHttp
            .get(`/api/course/duplication-jobs/${jobId}`)
            .expect(200);
          return jobResponse.body.data as { state: string; failedReason: string | null };
        },
        (job) => job.state === "completed" || job.state === "failed",
      );
    };

    it.each(DUPLICATION_AUTHORITY_CASES)(
      "duplicating a course whose lesson video belongs to $owner ends $state",
      async ({ owner, state, failedReason }) => {
        const key = buildKeyOwnedBy(owner, ".mp4");
        const sourceCourse = await createCourse();
        await placeAsset(SOURCE_ASSET_FIELDS.LESSON_VIDEO, sourceCourse, key);

        const job = await duplicateCourse(sourceCourse.courseId);

        expect(job).toMatchObject({ state, failedReason });
      },
    );
  });
});
