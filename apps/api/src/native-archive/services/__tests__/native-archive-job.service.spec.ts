import { Readable } from "node:stream";

import express from "express";
import request from "supertest";

import { NATIVE_ARCHIVE_DOWNLOAD_FILENAME } from "../../native-archive.constants";
import { streamNativeArchiveDownload } from "../../utils/native-archive-download.utils";
import { NativeArchiveJobService } from "../native-archive-job.service";

import type { CurrentUserType } from "src/common/types/current-user.type";

const ACTOR = {
  userId: "2cf24dba-5fb0-42bb-9af4-eec6990d01a2",
  tenantId: "1c720b6d-390d-4613-aa75-a5cc0b642147",
} as CurrentUserType;

describe("NativeArchiveJobService", () => {
  it("queues imports only from the actor's tenant storage prefix", async () => {
    const queueService = {
      getConnection: jest.fn().mockReturnValue({}),
      enqueue: jest.fn().mockResolvedValue({ id: "import-job" }),
    };
    const service = new NativeArchiveJobService(queueService as never, {} as never);
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
    );

    await service.removeExpiredArchives();

    expect(storage.deleteFile).toHaveBeenCalledTimes(1);
    expect(storage.deleteFile).toHaveBeenCalledWith(keys[0]);
    jobs.forEach((job) => expect(job.remove).toHaveBeenCalledTimes(1));
  });

  function createServiceForCompletedExport(returnvalue: Record<string, unknown>) {
    const job = {
      data: { actor: ACTOR },
      getState: jest.fn().mockResolvedValue("completed"),
      returnvalue,
    };
    const storage = {
      getFileStream: jest.fn().mockResolvedValue({ stream: Readable.from([]) }),
      getSignedUrl: jest.fn().mockResolvedValue("https://storage.example/signed"),
    };
    const service = new NativeArchiveJobService(
      {
        getConnection: jest.fn().mockReturnValue({}),
        getQueue: jest.fn().mockReturnValue({ getJob: jest.fn().mockResolvedValue(job) }),
      } as never,
      storage as never,
    );

    return { service, storage };
  }

  const EXPORT_KEY = `${ACTOR.tenantId}/native-archive/exports/package.zip`;

  it.each([
    {
      case: "an export named after its content",
      returnvalue: { key: EXPORT_KEY, filename: "sales-basics.zip" },
      expectedFilename: "sales-basics.zip",
    },
    {
      case: "an export finished before packages were named",
      returnvalue: { key: EXPORT_KEY },
      expectedFilename: NATIVE_ARCHIVE_DOWNLOAD_FILENAME,
    },
  ])("names the download of $case", async ({ returnvalue, expectedFilename }) => {
    const { service } = createServiceForCompletedExport(returnvalue);

    await expect(service.getArchiveDownloadStream("export-job", ACTOR)).resolves.toMatchObject({
      filename: expectedFilename,
    });
  });

  it("signs a short-lived download URL that saves the export under its name", async () => {
    const { service, storage } = createServiceForCompletedExport({
      key: EXPORT_KEY,
      filename: "sales-basics.zip",
    });

    await expect(service.getArchiveDownloadUrl("export-job", ACTOR)).resolves.toEqual({
      url: "https://storage.example/signed",
      expiresInSeconds: 300,
    });
    expect(storage.getSignedUrl).toHaveBeenCalledWith(EXPORT_KEY, 300, {
      downloadFilename: "sales-basics.zip",
    });
  });

  it("refuses a download URL for another tenant's export", async () => {
    const { service, storage } = createServiceForCompletedExport({
      key: "0180960e-af5b-4f4b-81ba-a1a9f3b85600/native-archive/exports/package.zip",
    });

    await expect(service.getArchiveDownloadUrl("export-job", ACTOR)).rejects.toThrow(
      "nativeArchive.error.notReady",
    );
    expect(storage.getSignedUrl).not.toHaveBeenCalled();
  });

  it("hides the storage key and download name from the job status", async () => {
    const { service } = createServiceForCompletedExport({
      key: EXPORT_KEY,
      filename: "sales-basics.zip",
      kind: "course",
    });

    await expect(service.getArchiveJobStatus("export-job", ACTOR)).resolves.toMatchObject({
      result: { kind: "course" },
    });
    const { result } = await service.getArchiveJobStatus("export-job", ACTOR);
    expect(result).not.toHaveProperty("key");
    expect(result).not.toHaveProperty("filename");
  });

  it.each([
    {
      case: "a reported stage",
      progress: { stage: "uploading-files", percent: 45 },
      expected: { stage: "uploading-files", percent: 45 },
    },
    { case: "nothing reported yet", progress: 0, expected: null },
    { case: "an unknown stage", progress: { stage: "teleporting", percent: 10 }, expected: null },
  ])("shows $case as the job progress", async ({ progress, expected }) => {
    const job = {
      data: { actor: ACTOR },
      returnvalue: null,
      failedReason: null,
      progress,
      getState: jest.fn().mockResolvedValue("active"),
    };
    const service = new NativeArchiveJobService(
      {
        getConnection: jest.fn().mockReturnValue({}),
        getQueue: jest.fn().mockReturnValue({ getJob: jest.fn().mockResolvedValue(job) }),
      } as never,
      {} as never,
    );

    await expect(service.getArchiveJobStatus("job-id", ACTOR)).resolves.toMatchObject({
      progress: expected,
    });
  });

  it("serves a named export with its name in the download header", async () => {
    const { service } = createServiceForCompletedExport({
      key: EXPORT_KEY,
      filename: "bezpieczna-praca-zdalna.zip",
    });
    const download = await service.getArchiveDownloadStream("export-job", ACTOR);
    const app = express();
    app.get("/download", (_request, response) => streamNativeArchiveDownload(download, response));

    const response = await request(app).get("/download").expect(200);

    expect(response.headers["content-disposition"]).toBe(
      'attachment; filename="bezpieczna-praca-zdalna.zip"',
    );
    expect(response.headers["content-type"]).toContain("application/zip");
  });
});
