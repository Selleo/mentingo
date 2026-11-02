import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { FileService } from "../file.service";

import type { UUIDType } from "src/common";

describe("FileService audio storage", () => {
  it("preserves an unsatisfiable storage range as HTTP 416", async () => {
    const service = Object.assign(Object.create(FileService.prototype), {
      logger: { error: jest.fn() },
      s3Service: {
        getFileStream: jest
          .fn()
          .mockRejectedValue({ name: "InvalidRange", $metadata: { httpStatusCode: 416 } }),
      },
    }) as FileService;
    await expect(service.getFileStream("tenant/audio.mp3", "bytes=999999-")).rejects.toMatchObject({
      status: 416,
    });
  });

  it("stores validated audio from memory without image/video processing", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "audio-storage-test-"));
    try {
      const filePath = path.join(directory, "audio.wav");
      execFileSync("ffmpeg", ["-v", "error", "-f", "lavfi", "-i", "sine=duration=0.1", filePath]);
      const buffer = await readFile(filePath);
      const uploadFile = jest.fn();
      const createVariants = jest.fn();
      const service = Object.assign(Object.create(FileService.prototype), {
        logger: { error: jest.fn() },
        s3Service: { uploadFile, getSignedUrl: jest.fn(async () => "signed") },
        imageVariantService: { createVariants },
      }) as FileService;
      const file = {
        buffer,
        originalname: "audio.wav",
        mimetype: "audio/x-wav",
        size: buffer.length,
      } as Express.Multer.File;
      const result = await service.uploadFile(
        file,
        "lessons/lesson-content",
        "11111111-1111-4111-8111-111111111111" as UUIDType,
      );
      expect(result).toMatchObject({ contentType: "audio/wav", fileUrl: "signed" });
      expect(result.fileKey).toMatch(
        /^11111111-1111-4111-8111-111111111111\/lessons\/lesson-content\/.+\.wav$/,
      );
      expect(uploadFile).toHaveBeenCalledWith(buffer, result.fileKey, "audio/wav");
      expect(createVariants).not.toHaveBeenCalled();
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("logs a storage failure and reports a translatable upload error", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "audio-storage-test-"));
    try {
      const filePath = path.join(directory, "audio.wav");
      execFileSync("ffmpeg", ["-v", "error", "-f", "lavfi", "-i", "sine=duration=0.1", filePath]);
      const buffer = await readFile(filePath);
      const logger = { error: jest.fn() };
      const service = Object.assign(Object.create(FileService.prototype), {
        logger,
        s3Service: { uploadFile: jest.fn().mockRejectedValue(new Error("storage down")) },
      }) as FileService;
      await expect(
        service.uploadFile(
          {
            buffer,
            originalname: "audio.wav",
            mimetype: "audio/wav",
            size: buffer.length,
          } as Express.Multer.File,
          "lessons/lesson-content",
          "11111111-1111-4111-8111-111111111111" as UUIDType,
        ),
      ).rejects.toMatchObject({ status: 409, message: "richText.audio.uploadFailed" });
      expect(logger.error).toHaveBeenCalled();
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
