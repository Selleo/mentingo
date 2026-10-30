import { execFileSync } from "node:child_process";
import { mkdtemp, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { Readable } from "node:stream";

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

  it("streams validated disk audio to tenant storage without image/video processing", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "audio-storage-test-"));
    try {
      const filePath = path.join(directory, "audio.wav");
      execFileSync("ffmpeg", ["-v", "error", "-f", "lavfi", "-i", "sine=duration=0.1", filePath]);
      const uploadFile = jest.fn(async (stream: Readable) => {
        expect(stream).toBeInstanceOf(Readable);
        let bytes = 0;
        for await (const chunk of stream) bytes += chunk.length;
        expect(bytes).toBe((await stat(filePath)).size);
      });
      const createVariants = jest.fn();
      const service = Object.assign(Object.create(FileService.prototype), {
        logger: { error: jest.fn() },
        s3Service: { uploadFile, getSignedUrl: jest.fn(async () => "signed") },
        imageVariantService: { createVariants },
      }) as FileService;
      const file = {
        path: filePath,
        originalname: "audio.wav",
        mimetype: "audio/x-wav",
        size: (await stat(filePath)).size,
      } as Express.Multer.File;
      const result = await service.uploadFile(
        file,
        "lessons/lesson-content",
        "11111111-1111-4111-8111-111111111111" as UUIDType,
      );
      expect(result.contentType).toBe("audio/wav");
      expect(result.fileKey).toMatch(
        /^11111111-1111-4111-8111-111111111111\/lessons\/lesson-content\//,
      );
      expect(uploadFile).toHaveBeenCalledWith(
        expect.any(Readable),
        result.fileKey,
        "audio/wav",
        file.size,
      );
      expect(createVariants).not.toHaveBeenCalled();
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
