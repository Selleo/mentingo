import crypto from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import getChecksum from "./getChecksum";

describe("resource checksum", () => {
  it("hashes disk uploads incrementally with the same identity as memory uploads", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "audio-hash-test-"));
    try {
      const filePath = path.join(directory, "upload");
      await writeFile(filePath, "audio bytes");
      const expected = crypto
        .createHash("sha256")
        .update("audio bytes")
        .update("podcast.mp3")
        .digest("hex");
      await expect(
        Promise.resolve().then(() =>
          getChecksum({ path: filePath, originalname: "podcast.mp3" } as Express.Multer.File),
        ),
      ).resolves.toBe(expected);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
