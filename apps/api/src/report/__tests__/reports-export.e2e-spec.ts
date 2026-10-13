import { Readable } from "node:stream";

import { COURSE_ENROLLMENT, SYSTEM_ROLE_SLUGS } from "@repo/shared";
import { and, eq } from "drizzle-orm";
import readXlsxFile from "read-excel-file/node";
import request from "supertest";

import { QueueService } from "src/queue";
import { ReportsExportWorker } from "src/report/reports-export.worker";
import { ReportsExportsCron } from "src/report/reports-exports.cron";
import { ReportsExportsService } from "src/report/reports-exports.service";
import { S3Service } from "src/s3/s3.service";
import { DB } from "src/storage/db/db.providers";
import {
  groupManagerGroups,
  groupUsers,
  learningPathCourses,
  reportsExports,
  studentCourses,
  studentLearningPathCourses,
  studentLearningPaths,
} from "src/storage/schema";

import { createE2ETest } from "../../../test/create-e2e-test";
import { createCourseFactory } from "../../../test/factory/course.factory";
import { createGroupFactory } from "../../../test/factory/group.factory";
import { createLearningPathFactory } from "../../../test/factory/learningPath.factory";
import { createSettingsFactory } from "../../../test/factory/settings.factory";
import { createUserFactory } from "../../../test/factory/user.factory";
import { cookieFor } from "../../../test/helpers/test-helpers";

import type { UserWithCredentials } from "../../../test/factory/user.factory";
import type { INestApplication, Provider } from "@nestjs/common";
import type { Job } from "bullmq";
import type { DatabasePg } from "src/common";
import type { ReportExportJobData } from "src/queue/queue.types";

describe("Report exports (e2e)", () => {
  let app: INestApplication;
  let db: DatabasePg;
  let admin: UserWithCredentials;
  let manager: UserWithCredentials;
  let learner: UserWithCredentials;
  let adminCookie: string;
  let managerCookie: string;
  let groupId: string;
  let courseIds: string[];
  let jobs: ReportExportJobData[];
  let artifacts: Map<string, Buffer>;
  let queueEnqueue: jest.SpyInstance;
  let tenantId: string;
  let beforeUploadCompletes: ((key: string) => Promise<void>) | undefined;

  const baseQuery = (groups: string[], pageSize = 1) => ({
    view: "organisation",
    language: "en",
    timezone: "Europe/Warsaw",
    groupIds: groups,
    page: 1,
    pageSize,
  });

  beforeAll(async () => {
    jobs = [];
    artifacts = new Map();
    const s3Mock = {
      isConfigured: () => true,
      uploadFile: async (buffer: Buffer, key: string) => artifacts.set(key, Buffer.from(buffer)),
      uploadStreamMultipart: async (stream: NodeJS.ReadableStream, key: string) => {
        const chunks: Buffer[] = [];
        for await (const chunk of stream)
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        artifacts.set(key, Buffer.concat(chunks));
        await beforeUploadCompletes?.(key);
      },
      getFileStream: async (key: string) => {
        const artifact = artifacts.get(key);
        if (!artifact) throw new Error("missing in-memory report artifact");
        return { stream: Readable.from(artifact) };
      },
      deleteFile: async (key: string) => {
        artifacts.delete(key);
      },
    };
    const customProviders: Provider[] = [
      { provide: ReportsExportWorker, useValue: {} },
      { provide: S3Service, useValue: s3Mock },
    ];
    const context = await createE2ETest({ customProviders });
    app = context.app;
    db = app.get(DB);
    tenantId = context.defaultTenantId;
    const userFactory = createUserFactory(db);
    const createUser = async (
      roleSlug: (typeof SYSTEM_ROLE_SLUGS)[keyof typeof SYSTEM_ROLE_SLUGS],
    ) => {
      const user = await userFactory.withCredentials({ password: "password123" }).create({
        roleSlug,
        tenantId,
      });
      await createSettingsFactory(db, user.id, roleSlug === SYSTEM_ROLE_SLUGS.ADMIN).create();
      return user;
    };
    admin = await createUser(SYSTEM_ROLE_SLUGS.ADMIN);
    manager = await createUser(SYSTEM_ROLE_SLUGS.GROUP_MANAGER);
    learner = await createUser(SYSTEM_ROLE_SLUGS.STUDENT);
    const group = await createGroupFactory(db)
      .withMembers([learner.id])
      .create({ name: "Export team" });
    groupId = group.id;
    await db.insert(groupManagerGroups).values({ managerUserId: manager.id, groupId });

    courseIds = [];
    const courseFactory = createCourseFactory(db);
    for (let index = 0; index < 3; index += 1) {
      const course = await courseFactory.create({
        title: `Export course ${index + 1}`,
        authorId: admin.id,
      });
      courseIds.push(course.id);
      await db.insert(studentCourses).values({
        studentId: learner.id,
        courseId: course.id,
        status: COURSE_ENROLLMENT.ENROLLED,
        progress: index === 0 ? "completed" : "in_progress",
        enrolledAt: `2026-02-0${index + 1}T10:00:00.000Z`,
        ...(index === 0 ? { completedAt: "2026-02-04T10:00:00.000Z" } : {}),
      });
    }

    adminCookie = await cookieFor(admin, app);
    managerCookie = await cookieFor(manager, app);
    queueEnqueue = jest
      .spyOn(app.get(QueueService), "enqueue")
      .mockImplementation(async (_queueName, _jobName, data) => {
        jobs.push(data as ReportExportJobData);
        return { id: (data as ReportExportJobData).exportId } as Job;
      });
  }, 120_000);

  afterAll(async () => {
    queueEnqueue?.mockRestore();
    await app?.close();
  });

  it("captures all filtered pages in a background XLSX and exposes status/download", async () => {
    const created = await request(app.getHttpServer())
      .post("/api/report/exports")
      .set("Cookie", adminCookie)
      .send({ format: "xlsx", language: "en", query: baseQuery([groupId], 1) })
      .expect(201);
    const exportId = created.body.data.id as string;
    expect(created.body.data.status).toBe("pending");
    expect(jobs).toHaveLength(1);

    await app.get(ReportsExportsService).processExportGenerationJob(jobs[0]);

    const status = await request(app.getHttpServer())
      .get(`/api/report/exports/${exportId}`)
      .set("Cookie", adminCookie)
      .expect(200);
    expect(status.body.data).toMatchObject({
      id: exportId,
      status: "completed",
      expiresAt: expect.any(String),
    });

    const download = await request(app.getHttpServer())
      .get(`/api/report/exports/${exportId}/download`)
      .set("Cookie", adminCookie)
      .buffer(true)
      .parse((response, callback) => {
        const chunks: Buffer[] = [];
        response.on("data", (chunk: Buffer) => chunks.push(chunk));
        response.on("end", () => callback(null, Buffer.concat(chunks)));
      })
      .expect(200);
    expect(download.headers["content-type"]).toContain("spreadsheetml.sheet");
    const summary = (await readXlsxFile(download.body as Buffer, { sheet: 1 })).flat().map(String);
    const records = (await readXlsxFile(download.body as Buffer, { sheet: 2 }))
      .flat()
      .map((cell) => String(cell ?? ""));
    expect(records.filter((cell) => cell === learner.email)).toHaveLength(courseIds.length);
    courseIds.forEach((_, index) => expect(records).toContain(`Export course ${index + 1}`));
    expect(summary).toContain("Learning report");
  });

  it("revokes a path export when its last managed learner is unenrolled", async () => {
    const path = await createLearningPathFactory(db).create({
      authorId: admin.id,
      title: { en: "Revoked path" },
      baseLanguage: "en",
      availableLocales: ["en"],
    });
    await db
      .insert(learningPathCourses)
      .values({ learningPathId: path.id, courseId: courseIds[0], displayOrder: 0 });
    await db
      .insert(studentLearningPaths)
      .values({ studentId: learner.id, learningPathId: path.id, progress: "in_progress" });
    await db
      .insert(studentLearningPathCourses)
      .values({ studentId: learner.id, learningPathId: path.id, courseId: courseIds[0] });
    const query = { ...baseQuery([groupId]), view: "developmentPaths", subjectId: path.id };
    const created = await request(app.getHttpServer())
      .post("/api/report/exports")
      .set("Cookie", managerCookie)
      .send({ format: "xlsx", language: "en", query })
      .expect(201);
    await app.get(ReportsExportsService).processExportGenerationJob(jobs[jobs.length - 1]);
    await request(app.getHttpServer())
      .get(`/api/report/exports/${created.body.data.id}/download`)
      .set("Cookie", managerCookie)
      .expect(200);

    await db
      .delete(studentLearningPathCourses)
      .where(
        and(
          eq(studentLearningPathCourses.studentId, learner.id),
          eq(studentLearningPathCourses.learningPathId, path.id),
        ),
      );
    await db
      .delete(studentLearningPaths)
      .where(
        and(
          eq(studentLearningPaths.studentId, learner.id),
          eq(studentLearningPaths.learningPathId, path.id),
        ),
      );

    await request(app.getHttpServer())
      .post("/api/report/query")
      .set("Cookie", managerCookie)
      .send(query)
      .expect(403);
    await request(app.getHttpServer())
      .get(`/api/report/exports/${created.body.data.id}/download`)
      .set("Cookie", managerCookie)
      .expect(403);
    await request(app.getHttpServer())
      .get(`/api/report/exports/${created.body.data.id}`)
      .set("Cookie", managerCookie)
      .expect(403);
  });

  it.each([false, true])(
    "keeps polling possible between retries, final failure=%s",
    async (failAgain) => {
      const created = await request(app.getHttpServer())
        .post("/api/report/exports")
        .set("Cookie", adminCookie)
        .send({ format: "xlsx", language: "en", query: baseQuery([groupId]) })
        .expect(201);
      const job = jobs[jobs.length - 1];
      const service = app.get(ReportsExportsService);
      beforeUploadCompletes = async () => {
        throw new Error("temporary upload failure");
      };
      try {
        await expect(service.processExportGenerationJob(job, false)).rejects.toThrow(
          "temporary upload failure",
        );
        const pending = await request(app.getHttpServer())
          .get(`/api/report/exports/${created.body.data.id}`)
          .set("Cookie", adminCookie)
          .expect(200);
        expect(pending.body.data).toMatchObject({ status: "pending", failureCode: null });
        expect([...artifacts.keys()].some((key) => key.includes(job.exportId))).toBe(false);

        if (failAgain) {
          await expect(service.processExportGenerationJob(job, true)).rejects.toThrow(
            "temporary upload failure",
          );
        } else {
          beforeUploadCompletes = undefined;
          await service.processExportGenerationJob(job, true);
        }
        const terminal = await request(app.getHttpServer())
          .get(`/api/report/exports/${created.body.data.id}`)
          .set("Cookie", adminCookie)
          .expect(200);
        expect(terminal.body.data.status).toBe(failAgain ? "failed" : "completed");
      } finally {
        beforeUploadCompletes = undefined;
      }
    },
  );

  it("denies a manager's completed export after their group membership scope narrows", async () => {
    const created = await request(app.getHttpServer())
      .post("/api/report/exports")
      .set("Cookie", managerCookie)
      .send({ format: "pdf", language: "en", query: baseQuery([groupId]) })
      .expect(201);
    const job = jobs[jobs.length - 1];
    await app.get(ReportsExportsService).processExportGenerationJob(job);

    // The manager remains assigned to the group; only the report population changes.
    await db.delete(groupUsers).where(eq(groupUsers.userId, learner.id));

    await request(app.getHttpServer())
      .get(`/api/report/exports/${created.body.data.id}/download`)
      .set("Cookie", managerCookie)
      .expect(403);
  });

  it("fences a stale processor so it cannot replace a newer completed artifact", async () => {
    const created = await request(app.getHttpServer())
      .post("/api/report/exports")
      .set("Cookie", adminCookie)
      .send({ format: "xlsx", language: "en", query: baseQuery([groupId]) })
      .expect(201);
    const exportId = created.body.data.id as string;
    const winnerKey = `reports/exports/${tenantId}/${exportId}-newer.xlsx`;
    beforeUploadCompletes = async (staleKey) => {
      await db
        .update(reportsExports)
        .set({ status: "completed", processingToken: null, artifactKey: winnerKey })
        .where(eq(reportsExports.id, exportId));
      artifacts.set(winnerKey, Buffer.from("winner"));
      expect(staleKey).not.toBe(winnerKey);
    };

    try {
      await app.get(ReportsExportsService).processExportGenerationJob(jobs[jobs.length - 1]);
    } finally {
      beforeUploadCompletes = undefined;
    }

    const [record] = await db
      .select({ status: reportsExports.status, artifactKey: reportsExports.artifactKey })
      .from(reportsExports)
      .where(eq(reportsExports.id, exportId));
    expect(record).toEqual({ status: "completed", artifactKey: winnerKey });
    expect(artifacts.has(winnerKey)).toBe(true);
    expect([...artifacts.keys()].filter((key) => key.includes(exportId))).toEqual([winnerKey]);
  });

  it("rejects download after retention expires and removes the stored artifact", async () => {
    const created = await request(app.getHttpServer())
      .post("/api/report/exports")
      .set("Cookie", adminCookie)
      .send({ format: "xlsx", language: "en", query: baseQuery([]) })
      .expect(201);
    const job = jobs[jobs.length - 1];
    await app.get(ReportsExportsService).processExportGenerationJob(job);

    const [record] = await db
      .select({ artifactKey: reportsExports.artifactKey })
      .from(reportsExports)
      .where(eq(reportsExports.id, created.body.data.id));
    expect(record.artifactKey).toBeTruthy();
    await db
      .update(reportsExports)
      .set({ expiresAt: new Date(Date.now() - 1000).toISOString() })
      .where(eq(reportsExports.id, created.body.data.id));

    // Simulate a delayed-queue enqueue failure: the periodic tenant sweep must
    // still remove expired object storage artifacts.
    await app.get(ReportsExportsCron).cleanupExpiredArtifacts();
    expect(artifacts.has(record.artifactKey!)).toBe(false);

    await request(app.getHttpServer())
      .get(`/api/report/exports/${created.body.data.id}/download`)
      .set("Cookie", adminCookie)
      .expect(404);
  });
});
