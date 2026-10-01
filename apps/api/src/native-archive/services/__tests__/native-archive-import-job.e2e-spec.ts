import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { SYSTEM_ROLE_SLUGS } from "@repo/shared";
import { eq } from "drizzle-orm";
import request from "supertest";
import { v5 as uuidv5 } from "uuid";

import { QUEUE_NAMES, QueueService } from "src/queue";
import { DB } from "src/storage/db/db.providers";
import { courses } from "src/storage/schema";

import { createE2ETest } from "../../../../test/create-e2e-test";
import { createUserFactory } from "../../../../test/factory/user.factory";
import { cookieFor } from "../../../../test/helpers/test-helpers";
import { getNativeArchiveUploadPrefix } from "../../native-archive-storage-paths";
import { NATIVE_ARCHIVE_JOB_STATE, NATIVE_ARCHIVE_KIND } from "../../native-archive.constants";

import {
  createInMemoryNativeArchiveStorage,
  createNativeArchiveCourseSnapshot,
  createNativeArchiveImportInput,
  NATIVE_ARCHIVE_IMPORT_FIXTURE_IDS,
  writeNativeArchiveZip,
} from "./native-archive-import.e2e-utils";

import type { INestApplication } from "@nestjs/common";
import type { DatabasePg } from "src/common";

jest.setTimeout(30_000);

describe("Native archive import job (e2e)", () => {
  let app: INestApplication;
  let db: DatabasePg;
  let queueService: QueueService;
  let memoryStorage: ReturnType<typeof createInMemoryNativeArchiveStorage>;
  let tenantId: string;
  let cookie: string;
  let runAsTenant: <T>(tenantId: string, fn: () => Promise<T>) => Promise<T>;
  let temporaryDirectory: string;

  beforeAll(async () => {
    memoryStorage = createInMemoryNativeArchiveStorage();
    const testContext = await createE2ETest([memoryStorage.provider]);
    app = testContext.app;
    db = app.get(DB);
    queueService = app.get(QueueService);
    tenantId = testContext.defaultTenantId;
    runAsTenant = testContext.runAsTenant;
    temporaryDirectory = await mkdtemp(path.join(tmpdir(), "native-archive-import-job-e2e-"));

    const admin = await createUserFactory(db)
      .withCredentials({ password: "Archive-import-job-e2e-password1!" })
      .withAdminSettings(db)
      .create({ role: SYSTEM_ROLE_SLUGS.ADMIN });
    cookie = await cookieFor(admin, app);
  });

  afterAll(async () => {
    await rm(temporaryDirectory, { recursive: true, force: true });
    await app.close();
  });

  it("imports an uploaded archive in a BullMQ worker and removes the source object", async () => {
    const sourceCourseId = NATIVE_ARCHIVE_IMPORT_FIXTURE_IDS.jobImportCourse;
    const targetCourseId = uuidv5(`native-archive:${sourceCourseId}`, tenantId);
    const zipPath = await writeNativeArchiveZip(
      createNativeArchiveImportInput(NATIVE_ARCHIVE_KIND.COURSE, [
        createNativeArchiveCourseSnapshot(sourceCourseId),
      ]),
      temporaryDirectory,
    );
    const events = queueService.getQueueEvents(QUEUE_NAMES.NATIVE_ARCHIVE);
    await events.waitUntilReady();

    const upload = await request(app.getHttpServer())
      .post("/api/native-archives/import")
      .set("Cookie", cookie)
      .attach("file", zipPath)
      .expect(201);
    const jobId = upload.body.data.jobId as string;
    const uploadKey = memoryStorage.uploadedKeys[0];
    expect(uploadKey).toMatch(new RegExp(`^${getNativeArchiveUploadPrefix(tenantId)}`));

    const queue = queueService.getQueue(QUEUE_NAMES.NATIVE_ARCHIVE);
    const job = await queue.getJob(jobId);
    if (!job) throw new Error(`Native archive import job ${jobId} was not queued`);

    const outcomes = await queueService.waitForJobsCompletion(QUEUE_NAMES.NATIVE_ARCHIVE, [job]);
    const outcome = outcomes[0];
    if (!outcome || outcome.status === "rejected") {
      const failedJob = await queue.getJob(jobId);
      throw new Error(
        `Native archive import job failed: ${String(
          outcome?.status === "rejected" ? outcome.reason : "missing outcome",
        )}; ` + `failedReason=${failedJob?.failedReason ?? "unknown"}`,
      );
    }

    const status = await request(app.getHttpServer())
      .get(`/api/native-archives/jobs/${jobId}`)
      .set("Cookie", cookie)
      .expect(200);
    const [savedCourse] = await runAsTenant(tenantId, () =>
      db.select().from(courses).where(eq(courses.id, targetCourseId)),
    );

    expect(status.body.data).toMatchObject({
      state: NATIVE_ARCHIVE_JOB_STATE.COMPLETED,
      result: {
        kind: NATIVE_ARCHIVE_KIND.COURSE,
        rootId: targetCourseId,
        alreadyExists: false,
        createdCourseIds: [targetCourseId],
      },
      failedReason: null,
    });
    expect(savedCourse).toMatchObject({
      id: targetCourseId,
      originalId: sourceCourseId,
      tenantId,
    });
    expect(memoryStorage.s3ServiceMock.uploadStreamMultipart).toHaveBeenCalledWith(
      expect.anything(),
      uploadKey,
      "application/zip",
    );
    expect(memoryStorage.s3ServiceMock.getFileStream).toHaveBeenCalledWith(uploadKey);
    expect(memoryStorage.s3ServiceMock.deleteFile).toHaveBeenCalledWith(uploadKey);
    expect(memoryStorage.deletedKeys).toContain(uploadKey);
    expect(memoryStorage.has(uploadKey)).toBe(false);
  });
});
