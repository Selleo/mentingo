import { FileGuard } from "src/file/guards/file.guard";

import { NATIVE_ARCHIVE_LIMITS } from "../../native-archive.constants";
import { NativeArchiveTusService } from "../native-archive-tus.service";

import type { CurrentUserType } from "src/common/types/current-user.type";

const ACTOR = {
  userId: "2cf24dba-5fb0-42bb-9af4-eec6990d01a2",
  tenantId: "1c720b6d-390d-4613-aa75-a5cc0b642147",
} as CurrentUserType;

function createTusService() {
  const stored = new Map<string, unknown>();
  const cache = {
    get: jest.fn(async (key: string) => stored.get(key)),
    set: jest.fn(async (key: string, value: unknown) => {
      stored.set(key, structuredClone(value));
    }),
    del: jest.fn(async (key: string) => {
      stored.delete(key);
    }),
  };
  const storage = {
    isConfigured: jest.fn().mockReturnValue(true),
    createMultipartUpload: jest.fn().mockResolvedValue({ uploadId: "multipart-id" }),
    uploadMultipartPart: jest.fn().mockResolvedValue("etag"),
    completeMultipartUpload: jest.fn().mockResolvedValue(undefined),
  };

  return {
    service: new NativeArchiveTusService(storage as never, cache as never),
    storage,
  };
}

describe("NativeArchiveTusService", () => {
  afterEach(() => jest.restoreAllMocks());

  it("checks the first chunk and completes multipart upload with the final chunk", async () => {
    const { service, storage } = createTusService();
    jest.spyOn(FileGuard, "getFileType").mockResolvedValue({ ext: "zip", mime: "application/zip" });

    const session = await service.createImportUploadSession(6, ACTOR);
    const chunk = Buffer.from("123456");
    const first = await service.uploadImportChunk(session.uploadId, 0, chunk, ACTOR);
    const retry = await service.uploadImportChunk(session.uploadId, 0, chunk, ACTOR);
    const key = await service.completeImportUpload(session.uploadId, ACTOR);

    expect(first).toEqual({ offset: 6, conflict: false });
    expect(retry).toEqual({ offset: 6, conflict: true });
    expect(FileGuard.getFileType).toHaveBeenCalledWith(chunk);
    expect(storage.uploadMultipartPart).toHaveBeenCalledTimes(1);
    expect(storage.completeMultipartUpload).toHaveBeenCalledTimes(1);
    expect(key).toContain(`/uploads/${ACTOR.tenantId}/`);
  });

  it("rejects a non-ZIP first chunk before uploading it to S3", async () => {
    const { service, storage } = createTusService();
    jest.spyOn(FileGuard, "getFileType").mockResolvedValue({ ext: "pdf", mime: "application/pdf" });

    const session = await service.createImportUploadSession(6, ACTOR);

    await expect(
      service.uploadImportChunk(session.uploadId, 0, Buffer.from("123456"), ACTOR),
    ).rejects.toThrow("nativeArchive.error.invalidUploadChunk");
    expect(storage.uploadMultipartPart).not.toHaveBeenCalled();
  });

  it("completes multipart upload only after the final chunk", async () => {
    const { service, storage } = createTusService();
    jest.spyOn(FileGuard, "getFileType").mockResolvedValue({ ext: "zip", mime: "application/zip" });

    const firstChunk = Buffer.alloc(NATIVE_ARCHIVE_LIMITS.MIN_PART_BYTES);
    const session = await service.createImportUploadSession(firstChunk.length + 1, ACTOR);

    await service.uploadImportChunk(session.uploadId, 0, firstChunk, ACTOR);
    expect(storage.completeMultipartUpload).not.toHaveBeenCalled();

    await service.uploadImportChunk(session.uploadId, firstChunk.length, Buffer.from("x"), ACTOR);
    expect(storage.completeMultipartUpload).toHaveBeenCalledTimes(1);
    expect(FileGuard.getFileType).toHaveBeenCalledTimes(1);
  });

  it("keeps the final offset so completion can be retried after an S3 failure", async () => {
    const { service, storage } = createTusService();
    jest.spyOn(FileGuard, "getFileType").mockResolvedValue({ ext: "zip", mime: "application/zip" });
    storage.completeMultipartUpload.mockRejectedValueOnce(new Error("S3 unavailable"));

    const session = await service.createImportUploadSession(6, ACTOR);

    await expect(
      service.uploadImportChunk(session.uploadId, 0, Buffer.from("123456"), ACTOR),
    ).rejects.toThrow("S3 unavailable");
    expect((await service.getImportUploadSession(session.uploadId, ACTOR)).offset).toBe(6);

    await expect(service.completeImportUpload(session.uploadId, ACTOR)).resolves.toContain(
      `/uploads/${ACTOR.tenantId}/`,
    );
    expect(storage.uploadMultipartPart).toHaveBeenCalledTimes(1);
    expect(storage.completeMultipartUpload).toHaveBeenCalledTimes(2);
  });
});
