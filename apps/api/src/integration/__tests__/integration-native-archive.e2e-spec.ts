import request from "supertest";
import { match } from "ts-pattern";

import { getNativeArchiveExportPrefix } from "src/native-archive/native-archive-storage-paths";
import { NATIVE_ARCHIVE_JOB_STATE } from "src/native-archive/native-archive.constants";
import {
  createNativeArchiveExportStorage,
  readNativeArchiveBytes,
} from "src/native-archive/services/__tests__/native-archive-export.e2e-utils";
import { DB } from "src/storage/db/db.providers";

import { createE2ETest } from "../../../test/create-e2e-test";
import { createChapterFactory } from "../../../test/factory/chapter.factory";
import { createCourseFactory } from "../../../test/factory/course.factory";
import { prepareSharingTenants } from "../../../test/helpers/course-sharing";
import { issueIntegrationKey } from "../../../test/helpers/integration-keys";
import { truncateAllTables } from "../../../test/helpers/test-helpers";

import { KEY_KINDS } from "./integration-courses.scenarios";
import {
  ARCHIVED_COURSE,
  EXPORT_ACCESS_CASES,
  FOREIGN_TENANT_JOB_CASES,
  JOB_ENDPOINTS,
  UNKNOWN_JOB_ID,
} from "./integration-native-archive.scenarios";

import type { KeyKind } from "./integration-courses.scenarios";
import type { JobEndpoint } from "./integration-native-archive.scenarios";
import type { RunAsTenant, SharingTenant } from "../../../test/helpers/course-sharing";
import type { INestApplication } from "@nestjs/common";
import type { DatabasePg, UUIDType } from "src/common";
import type { NativeArchiveJobStatus } from "src/native-archive/native-archive.types";

const JOB_POLL_ATTEMPTS = 80;
const JOB_POLL_INTERVAL_MS = 100;

describe("Integration native archive export (e2e)", () => {
  let app: INestApplication;
  let db: DatabasePg;
  let tenantDb: DatabasePg;
  let dbAdmin: DatabasePg;
  let runAsTenant: RunAsTenant;
  let managingTenant: SharingTenant;
  let contentTenant: SharingTenant;
  const storage = createNativeArchiveExportStorage();

  beforeAll(async () => {
    const e2e = await createE2ETest({ customProviders: [storage.provider], useDbProxy: true });

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
    storage.clear();
    await truncateAllTables(dbAdmin, db);
  });

  afterEach(async () => {
    await truncateAllTables(dbAdmin, db);
  });

  const arrangeCourseIn = (tenantId: UUIDType) =>
    runAsTenant(tenantId, async () => {
      const course = await createCourseFactory(tenantDb).create({
        ...ARCHIVED_COURSE,
        chapterCount: 1,
      });

      await createChapterFactory(tenantDb).create({
        courseId: course.id,
        authorId: course.authorId,
        displayOrder: 1,
        lessonCount: 0,
      });

      return course;
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

  const startExport = (apiKey: string, tenantId: UUIDType, courseId: UUIDType) =>
    request(app.getHttpServer())
      .post(`/api/integration/courses/${courseId}/native-archive`)
      .set("X-API-Key", apiKey)
      .set("X-Tenant-Id", tenantId);

  const getJobStatus = (apiKey: string, tenantId: UUIDType, jobId: string) =>
    request(app.getHttpServer())
      .get(`/api/integration/native-archive/jobs/${jobId}`)
      .set("X-API-Key", apiKey)
      .set("X-Tenant-Id", tenantId);

  const requestArchiveDownload = (apiKey: string, tenantId: UUIDType, jobId: string) =>
    request(app.getHttpServer())
      .get(`/api/integration/native-archive/jobs/${jobId}/download`)
      .set("X-API-Key", apiKey)
      .set("X-Tenant-Id", tenantId);

  const downloadArchive = (apiKey: string, tenantId: UUIDType, jobId: string) =>
    requestArchiveDownload(apiKey, tenantId, jobId)
      .buffer(true)
      .parse((response, callback) => {
        const chunks: Buffer[] = [];
        response.on("data", (chunk: Buffer | string) =>
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)),
        );
        response.on("end", () => callback(null, Buffer.concat(chunks)));
        response.on("error", (error) => callback(error, undefined));
      });

  const requestJobEndpoint = (
    endpoint: JobEndpoint,
    apiKey: string,
    tenantId: UUIDType,
    jobId: string,
  ) =>
    match(endpoint)
      .with(JOB_ENDPOINTS.STATUS, () => getJobStatus(apiKey, tenantId, jobId))
      .with(JOB_ENDPOINTS.DOWNLOAD, () => requestArchiveDownload(apiKey, tenantId, jobId))
      .exhaustive();

  const waitForFinishedJob = async (
    apiKey: string,
    tenantId: UUIDType,
    jobId: string,
  ): Promise<NativeArchiveJobStatus> => {
    for (let attempt = 0; attempt < JOB_POLL_ATTEMPTS; attempt += 1) {
      const response = await getJobStatus(apiKey, tenantId, jobId).expect(200);
      const status = response.body.data as NativeArchiveJobStatus;

      if (
        status.state === NATIVE_ARCHIVE_JOB_STATE.COMPLETED ||
        status.state === NATIVE_ARCHIVE_JOB_STATE.FAILED
      )
        return status;

      await new Promise((resolve) => setTimeout(resolve, JOB_POLL_INTERVAL_MS));
    }

    throw new Error(`Native archive job ${jobId} did not finish`);
  };

  const arrangeStartedExport = async () => {
    const { apiKey } = await issueKey(KEY_KINDS.MANAGING);
    const course = await arrangeCourseIn(contentTenant.id);
    const started = await startExport(apiKey, contentTenant.id, course.id).expect(201);

    return { apiKey, course, jobId: started.body.data.jobId as string };
  };

  it("exports a course of the selected tenant and streams its archive", async () => {
    const { apiKey, course, jobId } = await arrangeStartedExport();

    const status = await waitForFinishedJob(apiKey, contentTenant.id, jobId);
    const downloaded = await downloadArchive(apiKey, contentTenant.id, jobId).expect(200);
    const archive = await readNativeArchiveBytes(downloaded.body as Buffer);

    expect(status).toEqual({
      jobId,
      state: NATIVE_ARCHIVE_JOB_STATE.COMPLETED,
      result: { kind: "course", rootId: course.id },
      failedReason: null,
    });
    expect(downloaded.headers).toMatchObject({
      "content-type": expect.stringContaining("application/zip"),
      "content-disposition": 'attachment; filename="mentingo-package.zip"',
    });
    expect(archive.manifest).toMatchObject({
      format: "mentingo-package",
      kind: "course",
      rootId: course.id,
      courseIds: [course.id],
    });
    expect(storage.uploadedKeys).toEqual([
      expect.stringMatching(new RegExp(`^${getNativeArchiveExportPrefix(contentTenant.id)}`)),
    ]);
  });

  it("fails the export of a course that belongs to another tenant", async () => {
    const { apiKey } = await issueKey(KEY_KINDS.MANAGING);
    const course = await arrangeCourseIn(managingTenant.id);

    const started = await startExport(apiKey, contentTenant.id, course.id).expect(201);
    const status = await waitForFinishedJob(apiKey, contentTenant.id, started.body.data.jobId);

    expect(status).toMatchObject({
      state: NATIVE_ARCHIVE_JOB_STATE.FAILED,
      failedReason: "nativeArchive.error.courseNotFound",
    });
    expect(storage.uploadedKeys).toEqual([]);
  });

  it.each(EXPORT_ACCESS_CASES)(
    "answers an export started with a $keyKind key with $status",
    async ({ keyKind, status }) => {
      const { apiKey, admin } = await issueKey(keyKind);
      const course = await arrangeCourseIn(admin.tenantId);

      await startExport(apiKey, admin.tenantId, course.id).expect(status);
    },
  );

  it.each(FOREIGN_TENANT_JOB_CASES)(
    "hides the job $endpoint from another selected tenant",
    async ({ endpoint }) => {
      const { apiKey, jobId } = await arrangeStartedExport();

      const response = await requestJobEndpoint(endpoint, apiKey, managingTenant.id, jobId).expect(
        403,
      );

      expect(response.body).toMatchObject({ message: "nativeArchive.error.accessDenied" });
    },
  );

  it("answers an unknown job with 404", async () => {
    const { apiKey } = await issueKey(KEY_KINDS.MANAGING);

    const response = await getJobStatus(apiKey, contentTenant.id, UNKNOWN_JOB_ID).expect(404);

    expect(response.body).toMatchObject({ message: "nativeArchive.error.jobNotFound" });
  });

  it("requires an integration key", async () => {
    const course = await arrangeCourseIn(contentTenant.id);

    await request(app.getHttpServer())
      .post(`/api/integration/courses/${course.id}/native-archive`)
      .set("X-Tenant-Id", contentTenant.id)
      .expect(401);
  });
});
