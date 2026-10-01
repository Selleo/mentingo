import { SYSTEM_ROLE_SLUGS } from "@repo/shared";
import request from "supertest";

import { DB } from "src/storage/db/db.providers";

import { createE2ETest } from "../../../../test/create-e2e-test";
import { createUserFactory } from "../../../../test/factory/user.factory";
import { cookieFor } from "../../../../test/helpers/test-helpers";

import {
  createNativeArchiveUploadE2EDoubles,
  NATIVE_ARCHIVE_ZIP_FIXTURE,
} from "./native-archive-upload.e2e-utils";

import type { INestApplication } from "@nestjs/common";
import type { DatabasePg } from "src/common";

jest.mock("load-esm", () => ({
  loadEsm: jest.fn(async () => ({
    fileTypeFromBuffer: async (buffer: Buffer) =>
      buffer.subarray(0, 2).toString("utf8") === "PK"
        ? { mime: "application/zip", ext: "zip" }
        : undefined,
  })),
}));

const PASSWORD = "password123";

describe("NativeArchiveController upload boundary (e2e)", () => {
  let app: INestApplication;
  let db: DatabasePg;
  let userFactory: ReturnType<typeof createUserFactory>;
  let doubles: ReturnType<typeof createNativeArchiveUploadE2EDoubles>;

  beforeAll(async () => {
    doubles = createNativeArchiveUploadE2EDoubles();

    const e2e = await createE2ETest({
      customProviders: doubles.providers,
    });
    app = e2e.app;
    db = app.get(DB);
    userFactory = createUserFactory(db);
  }, 30000);

  beforeEach(() => {
    doubles.clear();
  });

  afterAll(async () => app.close());

  const createAdmin = async () => {
    const user = await userFactory
      .withCredentials({ password: PASSWORD })
      .withAdminSettings(db)
      .create({ role: SYSTEM_ROLE_SLUGS.ADMIN });
    return { user, cookie: await cookieFor(user, app) };
  };

  const createStudent = async () => {
    const user = await userFactory
      .withCredentials({ password: PASSWORD })
      .withUserSettings(db)
      .create({ role: SYSTEM_ROLE_SLUGS.STUDENT });
    return { user, cookie: await cookieFor(user, app) };
  };

  it("accepts a multipart archive and returns a queued import receipt", async () => {
    const { user, cookie } = await createAdmin();
    const response = await request(app.getHttpServer())
      .post("/api/native-archives/import")
      .set("Cookie", cookie)
      .attach("file", NATIVE_ARCHIVE_ZIP_FIXTURE, {
        filename: "course.zip",
        contentType: "application/zip",
      })
      .expect(201);

    expect(response.body.data.jobId).toMatch(/^native-archive-/);
    expect(doubles.jobService.enqueueArchiveImportFromFile).toHaveBeenCalledTimes(1);
    expect(doubles.jobService.enqueueArchiveImportFromFile.mock.calls[0][0].originalname).toBe(
      "course.zip",
    );
    expect(doubles.uploadCalls).toEqual([
      expect.objectContaining({
        bytes: NATIVE_ARCHIVE_ZIP_FIXTURE,
        key: expect.stringMatching(new RegExp(`^${user.tenantId}/native-archive/uploads/`)),
        contentType: "application/zip",
      }),
    ]);
  });

  it("requires a file and the course-create permission for multipart import", async () => {
    const { cookie } = await createAdmin();
    await request(app.getHttpServer())
      .post("/api/native-archives/import")
      .set("Cookie", cookie)
      .expect(400);

    const student = await createStudent();
    await request(app.getHttpServer())
      .post("/api/native-archives/import")
      .set("Cookie", student.cookie)
      .attach("file", NATIVE_ARCHIVE_ZIP_FIXTURE, {
        filename: "course.zip",
        contentType: "application/zip",
      })
      .expect(403);
  });

  it("creates a tenant-scoped TUS session, reports offset, rejects bad chunks, and queues completion", async () => {
    const { user, cookie } = await createAdmin();
    const init = await request(app.getHttpServer())
      .post("/api/native-archives/tus/init")
      .set("Cookie", cookie)
      .send({ sizeBytes: NATIVE_ARCHIVE_ZIP_FIXTURE.length })
      .expect(201);
    const uploadId = init.body.data.uploadId as string;
    expect(init.body.data.tusEndpoint).toBe("/api/native-archives/tus");

    const metadata = Buffer.from(uploadId).toString("base64");
    await request(app.getHttpServer())
      .post("/api/native-archives/tus")
      .set("Cookie", cookie)
      .set("Tus-Resumable", "1.0.0")
      .set("Upload-Length", String(NATIVE_ARCHIVE_ZIP_FIXTURE.length + 1))
      .set("Upload-Metadata", `uploadId ${metadata}`)
      .expect(400);

    await request(app.getHttpServer())
      .post("/api/native-archives/tus")
      .set("Cookie", cookie)
      .set("Tus-Resumable", "1.0.0")
      .set("Upload-Length", String(NATIVE_ARCHIVE_ZIP_FIXTURE.length))
      .set("Upload-Metadata", `uploadId ${metadata}`)
      .expect(201)
      .expect("Location", `/api/native-archives/tus/${uploadId}`);

    await request(app.getHttpServer())
      .head(`/api/native-archives/tus/${uploadId}`)
      .set("Cookie", cookie)
      .set("Tus-Resumable", "1.0.0")
      .expect(200)
      .expect("Upload-Offset", "0")
      .expect("Upload-Length", String(NATIVE_ARCHIVE_ZIP_FIXTURE.length));

    await request(app.getHttpServer())
      .patch(`/api/native-archives/tus/${uploadId}`)
      .set("Cookie", cookie)
      .set("Tus-Resumable", "1.0.0")
      .set("Upload-Offset", "1")
      .set("Content-Type", "application/offset+octet-stream")
      .send(NATIVE_ARCHIVE_ZIP_FIXTURE)
      .expect(409)
      .expect("Upload-Offset", "0");

    await request(app.getHttpServer())
      .patch(`/api/native-archives/tus/${uploadId}`)
      .set("Cookie", cookie)
      .set("Tus-Resumable", "1.0.0")
      .set("Upload-Offset", "0")
      .set("Content-Type", "application/offset+octet-stream")
      .send(Buffer.from("not-a-zip"))
      .expect(400);

    const patch = await request(app.getHttpServer())
      .patch(`/api/native-archives/tus/${uploadId}`)
      .set("Cookie", cookie)
      .set("Tus-Resumable", "1.0.0")
      .set("Upload-Offset", "0")
      .set("Content-Type", "application/offset+octet-stream")
      .send(NATIVE_ARCHIVE_ZIP_FIXTURE)
      .expect(204)
      .expect("Upload-Offset", String(NATIVE_ARCHIVE_ZIP_FIXTURE.length));
    expect(patch.status).toBe(204);
    expect(doubles.multipartParts).toEqual([NATIVE_ARCHIVE_ZIP_FIXTURE]);
    expect(doubles.s3Service.completeMultipartUpload).toHaveBeenCalledTimes(1);

    const complete = await request(app.getHttpServer())
      .post(`/api/native-archives/tus/${uploadId}/complete`)
      .set("Cookie", cookie)
      .expect(201);
    expect(doubles.jobService.enqueueArchiveImportFromStorageKey).toHaveBeenCalledWith(
      expect.stringMatching(new RegExp(`^${user.tenantId}/native-archive/uploads/`)),
      expect.objectContaining({ userId: user.id, tenantId: user.tenantId }),
    );
    expect(complete.body.data.jobId).toBeDefined();

    await request(app.getHttpServer())
      .head(`/api/native-archives/tus/${uploadId}`)
      .set("Cookie", cookie)
      .set("Tus-Resumable", "1.0.0")
      .expect(400);
  });

  it("restricts TUS session ownership and job status/download to the creating user", async () => {
    const owner = await createAdmin();
    const other = await createAdmin();
    const created = await request(app.getHttpServer())
      .post("/api/native-archives/import")
      .set("Cookie", owner.cookie)
      .attach("file", NATIVE_ARCHIVE_ZIP_FIXTURE, {
        filename: "course.zip",
        contentType: "application/zip",
      })
      .expect(201);
    const jobId = created.body.data.jobId as string;

    await request(app.getHttpServer())
      .get(`/api/native-archives/jobs/${jobId}`)
      .set("Cookie", owner.cookie)
      .expect(200);
    await request(app.getHttpServer())
      .get(`/api/native-archives/jobs/${jobId}`)
      .set("Cookie", other.cookie)
      .expect(403);
    doubles.jobs.set(jobId, {
      actor: { userId: owner.user.id, tenantId: owner.user.tenantId },
      state: "completed",
      result: { key: `${owner.user.tenantId}/native-archive/exports/result.zip`, kind: "course" },
    });
    await request(app.getHttpServer())
      .get(`/api/native-archives/jobs/${jobId}/download`)
      .set("Cookie", owner.cookie)
      .expect(200)
      .expect("Content-Type", "application/zip")
      .expect("Content-Length", "7")
      .expect("Cache-Control", "private, no-store");
    await request(app.getHttpServer())
      .get(`/api/native-archives/jobs/${jobId}/download`)
      .set("Cookie", other.cookie)
      .expect(403);

    const init = await request(app.getHttpServer())
      .post("/api/native-archives/tus/init")
      .set("Cookie", owner.cookie)
      .send({ sizeBytes: NATIVE_ARCHIVE_ZIP_FIXTURE.length })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/native-archives/tus/${init.body.data.uploadId}/complete`)
      .set("Cookie", owner.cookie)
      .expect(400);
    await request(app.getHttpServer())
      .head(`/api/native-archives/tus/${init.body.data.uploadId}`)
      .set("Cookie", other.cookie)
      .set("Tus-Resumable", "1.0.0")
      .expect(403);
  });

  it("rejects invalid TUS lengths, unsupported versions, and malformed upload identifiers", async () => {
    const { cookie } = await createAdmin();
    await request(app.getHttpServer())
      .post("/api/native-archives/tus/init")
      .set("Cookie", cookie)
      .send({ sizeBytes: 0 })
      .expect(400);
    await request(app.getHttpServer())
      .post("/api/native-archives/tus")
      .set("Cookie", cookie)
      .set("Tus-Resumable", "0.2.2")
      .expect(400);
    await request(app.getHttpServer())
      .head("/api/native-archives/tus/not-a-uuid")
      .set("Cookie", cookie)
      .set("Tus-Resumable", "1.0.0")
      .expect(400);
    await request(app.getHttpServer())
      .post("/api/native-archives/tus")
      .set("Cookie", cookie)
      .set("Tus-Resumable", "1.0.0")
      .set("Upload-Length", "1")
      .set("Upload-Metadata", `uploadId ${Buffer.from("not-a-uuid").toString("base64")}`)
      .expect(400);
  });
});
