import { Readable } from "node:stream";

import { NATIVE_ARCHIVE_JOB_ACTION } from "../../native-archive.constants";
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
    );

    await service.removeExpiredArchives();

    expect(storage.deleteFile).toHaveBeenCalledTimes(1);
    expect(storage.deleteFile).toHaveBeenCalledWith(keys[0]);
    jobs.forEach((job) => expect(job.remove).toHaveBeenCalledTimes(1));
  });
});
