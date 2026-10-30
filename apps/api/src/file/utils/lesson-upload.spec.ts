import { access, readFile } from "node:fs/promises";
import { Readable } from "node:stream";

import { lessonUploadStorage } from "./lesson-upload";

import type { Request } from "express";

describe("lesson upload storage", () => {
  it("rejects unsupported audio MIME before buffering or consuming the upload", async () => {
    const file = {
      originalname: "podcast.aac",
      mimetype: "audio/aac",
      stream: Readable.from([Buffer.from("raw AAC")]),
    } as Express.Multer.File;
    await expect(
      new Promise((resolve, reject) =>
        lessonUploadStorage._handleFile({} as Request, file, (error, result) =>
          error ? reject(error) : resolve(result),
        ),
      ),
    ).rejects.toThrow("files.toast.invalidFileType");
  });

  it("spools an audio upload to a private temporary file without a podcast buffer", async () => {
    const file = {
      originalname: "podcast.mp3",
      mimetype: "audio/mpeg",
      stream: Readable.from([Buffer.from("audio bytes")]),
    } as Express.Multer.File;
    const info = await new Promise<Partial<Express.Multer.File>>((resolve, reject) =>
      lessonUploadStorage._handleFile({} as Request, file, (error, result) =>
        error ? reject(error) : resolve(result!),
      ),
    );
    expect(info.buffer).toBeUndefined();
    expect(info.size).toBe(11);
    expect(await readFile(info.path!, "utf8")).toBe("audio bytes");
    Object.assign(file, info);
    await new Promise<void>((resolve, reject) =>
      lessonUploadStorage._removeFile({} as Request, file, (error) =>
        error ? reject(error) : resolve(),
      ),
    );
    await expect(access(info.path!)).rejects.toThrow();
  });
});
