import { Readable } from "node:stream";

import express from "express";
import request from "supertest";

import { NATIVE_ARCHIVE_JOB_ACTION } from "../../native-archive.constants";
import { streamNativeArchiveDownload } from "../../utils/native-archive-download.utils";
import { NativeArchiveJobService } from "../native-archive-job.service";

import type { CurrentUserType } from "src/common/types/current-user.type";

jest.mock("bullmq", () => ({
  Worker: jest.fn().mockImplementation(() => ({ close: jest.fn() })),
}));

const ACTOR = {
  userId: "2cf24dba-5fb0-42bb-9af4-eec6990d01a2",
  tenantId: "1c720b6d-390d-4613-aa75-a5cc0b642147",
} as CurrentUserType;
const PATH_ID = "b7e3f32d-c1ab-4cb9-95e1-79212698bf54";
const COURSE_ID = "f594d687-096b-4599-84bf-1f296afdb1e1";

describe("NativeArchiveJobService", () => {
  it.each([
    [
      NATIVE_ARCHIVE_JOB_ACTION.EXPORT_COURSE,
      "Bezpieczna praca zdalna",
      "bezpieczna-praca-zdalna.zip",
    ],
    [
      NATIVE_ARCHIVE_JOB_ACTION.EXPORT_COURSE,
      "Zażółć gęślą jaźń ĄĆĘŁŃÓŚŹŻ",
      "zazolc-gesla-jazn-acelnoszz.zip",
    ],
    [NATIVE_ARCHIVE_JOB_ACTION.EXPORT_LEARNING_PATH, "Polska ścieżka", "polska-sciezka.zip"],
    [NATIVE_ARCHIVE_JOB_ACTION.EXPORT_COURSE, ' ../ Kurs: "BHP" / 2026! ', "kurs-bhp-2026.zip"],
    [NATIVE_ARCHIVE_JOB_ACTION.EXPORT_COURSE, "🎓", "mentingo-package.zip"],
  ])("downloads %s named %s as %s", async (action, title, filename) => {
    const snapshot = {
      courses: {
        [COURSE_ID]: {
          course: { id: COURSE_ID, title: { en: "Other title", pl: title }, baseLanguage: "pl" },
        },
      },
      learningPath: { id: PATH_ID, title: { en: "Other path", pl: title }, baseLanguage: "pl" },
      files: [],
    };
    let archiveBytes = Buffer.alloc(0);
    const storage = {
      uploadStreamMultipart: jest.fn(async (stream: Readable) => {
        const chunks: Buffer[] = [];
        for await (const chunk of stream) chunks.push(Buffer.from(chunk));
        archiveBytes = Buffer.concat(chunks);
      }),
      getFileStream: jest.fn(async () => ({
        stream: Readable.from(archiveBytes),
        contentLength: archiveBytes.length,
      })),
    };
    const job = { data: { actor: ACTOR }, returnvalue: {}, getState: async () => "completed" };
    const service = new NativeArchiveJobService(
      { getConnection: () => ({}), getQueue: () => ({ getJob: async () => job }) } as never,
      storage as never,
      {
        runWithTenant: async (_tenantId: string, callback: () => Promise<unknown>) => callback(),
      } as never,
      {
        buildCourseExportSnapshot: async () => snapshot,
        buildLearningPathExportSnapshot: async () => snapshot,
      } as never,
      {} as never,
      {} as never,
    );
    job.returnvalue = await service["processExportJob"](
      action,
      action === NATIVE_ARCHIVE_JOB_ACTION.EXPORT_COURSE ? COURSE_ID : PATH_ID,
      ACTOR,
    );
    const file = await service.getArchiveDownloadStream("export-job", ACTOR);
    const app = express();
    app.get("/download", (_req, response) => streamNativeArchiveDownload(file, response));
    const response = await request(app)
      .get("/download")
      .buffer(true)
      .parse((response, callback) => {
        const chunks: Buffer[] = [];
        response.on("data", (chunk: Buffer) => chunks.push(chunk));
        response.on("end", () => callback(null, Buffer.concat(chunks)));
        response.on("error", (error) => callback(error, undefined));
      })
      .expect(200);
    expect(response.headers["content-disposition"]).toBe(`attachment; filename="${filename}"`);
    expect(response.headers["content-type"]).toContain("application/zip");
    expect(response.body).toEqual(archiveBytes);
    expect(archiveBytes.subarray(0, 2).toString()).toBe("PK");
  });
  it("stages learning path files while the tenant context is active", async () => {
    let tenantContextActive = false;
    const openVideo = jest.fn(async () => {
      expect(tenantContextActive).toBe(true);
      return Readable.from(Buffer.from("video bytes"));
    });
    const tenantDbRunner = {
      runWithTenant: jest.fn(async (_tenantId: string, callback: () => Promise<unknown>) => {
        tenantContextActive = true;
        try {
          return await callback();
        } finally {
          tenantContextActive = false;
        }
      }),
    };
    const snapshotService = {
      buildLearningPathExportSnapshot: jest.fn().mockResolvedValue({
        courses: { [COURSE_ID]: { course: { id: COURSE_ID } } },
        learningPath: { id: PATH_ID },
        files: [
          {
            path: "bunny-video-id",
            sourceReference: "bunny-video-id",
            contentType: "video/mp4",
            open: openVideo,
          },
        ],
      }),
    };
    const storage = {
      uploadStreamMultipart: jest.fn(async (stream: Readable, _key: string) => {
        for await (const _chunk of stream) {
          // Consume the archive as S3 does.
        }
      }),
    };
    const service = new NativeArchiveJobService(
      { getConnection: jest.fn().mockReturnValue({}) } as never,
      storage as never,
      tenantDbRunner as never,
      snapshotService as never,
      {} as never,
      {} as never,
    );

    await service["processExportJob"](
      NATIVE_ARCHIVE_JOB_ACTION.EXPORT_LEARNING_PATH,
      PATH_ID,
      ACTOR,
    );

    expect(tenantDbRunner.runWithTenant).toHaveBeenCalledWith(ACTOR.tenantId, expect.any(Function));
    expect(openVideo).toHaveBeenCalledTimes(1);
    expect(storage.uploadStreamMultipart).toHaveBeenCalledTimes(1);
    expect(storage.uploadStreamMultipart.mock.calls[0]?.[1]).toMatch(
      new RegExp(`^${ACTOR.tenantId}/native-archive/exports/`),
    );
  });

  it("queues imports only from the actor's tenant storage prefix", async () => {
    const queueService = {
      getConnection: jest.fn().mockReturnValue({}),
      enqueue: jest.fn().mockResolvedValue({ id: "import-job" }),
    };
    const service = new NativeArchiveJobService(
      queueService as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );
    const ownKey = `${ACTOR.tenantId}/native-archive/uploads/package.zip`;
    const otherKey = "0180960e-af5b-4f4b-81ba-a1a9f3b85600/native-archive/uploads/package.zip";

    await expect(service.enqueueArchiveImportFromStorageKey(ownKey, ACTOR)).resolves.toEqual({
      jobId: "import-job",
    });
    await expect(service.enqueueArchiveImportFromStorageKey(otherKey, ACTOR)).rejects.toThrow(
      "nativeArchive.error.invalidUpload",
    );
    expect(queueService.enqueue).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["nativeArchive.error.invalidArchive", "nativeArchive.error.invalidArchive"],
    ["nativeArchive.error.storageUnavailable", "nativeArchive.error.storageUnavailable"],
    ["Error: database connection details", "nativeArchive.error.invalidArchive"],
    ["nativeArchive.error.notAnArchiveError", "nativeArchive.error.invalidArchive"],
    [null, null],
  ])("returns a safe failed reason for %s", async (failedReason, expected) => {
    const job = {
      data: { actor: ACTOR },
      returnvalue: null,
      failedReason,
      getState: jest.fn().mockResolvedValue("failed"),
    };
    const service = new NativeArchiveJobService(
      {
        getConnection: jest.fn().mockReturnValue({}),
        getQueue: jest.fn().mockReturnValue({ getJob: jest.fn().mockResolvedValue(job) }),
      } as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );

    await expect(service.getArchiveJobStatus("job-id", ACTOR)).resolves.toMatchObject({
      failedReason: expected,
    });
  });

  it("downloads only exports belonging to the actor's tenant", async () => {
    const job = {
      data: { actor: ACTOR },
      getState: jest.fn().mockResolvedValue("completed"),
      returnvalue: { key: `${ACTOR.tenantId}/native-archive/exports/package.zip` },
    };
    const storage = { getFileStream: jest.fn().mockResolvedValue({ stream: Readable.from([]) }) };
    const service = new NativeArchiveJobService(
      {
        getConnection: jest.fn().mockReturnValue({}),
        getQueue: jest.fn().mockReturnValue({ getJob: jest.fn().mockResolvedValue(job) }),
      } as never,
      storage as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );

    await service.getArchiveDownloadStream("export-job", ACTOR);
    expect(storage.getFileStream).toHaveBeenCalledWith(job.returnvalue.key);

    job.returnvalue.key = "0180960e-af5b-4f4b-81ba-a1a9f3b85600/native-archive/exports/package.zip";
    await expect(service.getArchiveDownloadStream("export-job", ACTOR)).rejects.toThrow(
      "nativeArchive.error.notReady",
    );
    expect(storage.getFileStream).toHaveBeenCalledTimes(1);
  });

  it("cleans up tenant exports without deleting another tenant's file", async () => {
    const keys = [
      `${ACTOR.tenantId}/native-archive/exports/current.zip`,
      "0180960e-af5b-4f4b-81ba-a1a9f3b85600/native-archive/exports/other.zip",
    ];
    const jobs = keys.map((key) => ({
      data: { actor: ACTOR },
      returnvalue: { key },
      finishedOn: 0,
      remove: jest.fn().mockResolvedValue(undefined),
    }));
    const storage = { deleteFile: jest.fn().mockResolvedValue(undefined) };
    const service = new NativeArchiveJobService(
      {
        getConnection: jest.fn().mockReturnValue({}),
        getQueue: jest.fn().mockReturnValue({ getJobs: jest.fn().mockResolvedValue(jobs) }),
      } as never,
      storage as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );

    await service.removeExpiredArchives();

    expect(storage.deleteFile).toHaveBeenCalledTimes(1);
    expect(storage.deleteFile).toHaveBeenCalledWith(keys[0]);
    jobs.forEach((job) => expect(job.remove).toHaveBeenCalledTimes(1));
  });
});
