import { createWriteStream } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { Transform } from "node:stream";
import { pipeline } from "node:stream/promises";

import { BadRequestException } from "@nestjs/common";
import { AUDIO_UPLOAD_MAX_BYTES, isAudioFile } from "@repo/shared";
import { memoryStorage } from "multer";

import type { StorageEngine } from "multer";

const memory = memoryStorage();

/** Only audio is disk-backed; other uploads retain their existing validation/storage contract. */
export const lessonUploadStorage: StorageEngine = {
  _handleFile(req, file, callback) {
    const audioCandidate = isAudioFile({ type: file.mimetype, name: file.originalname });
    if (file.mimetype.toLowerCase().startsWith("audio/") && !audioCandidate) {
      callback(new BadRequestException("files.toast.invalidFileType"));
      return;
    }
    if (!audioCandidate && !/\.(mp3|m4a|wav|ogg|oga|opus|aac)$/i.test(file.originalname)) {
      memory._handleFile(req, file, callback);
      return;
    }
    void (async () => {
      const directory = await mkdtemp(path.join(tmpdir(), "lesson-audio-"));
      const filePath = path.join(directory, "upload");
      let size = 0;
      const limiter = new Transform({
        transform(chunk: Buffer, _encoding, done) {
          size += chunk.length;
          if (size > AUDIO_UPLOAD_MAX_BYTES) {
            done(new BadRequestException("files.toast.audioFileTooLarge"));
            return;
          }
          done(null, chunk);
        },
      });
      try {
        await pipeline(
          file.stream,
          limiter,
          createWriteStream(filePath, { flags: "wx", mode: 0o600 }),
        );
        callback(null, { destination: directory, filename: "upload", path: filePath, size });
      } catch (error) {
        await rm(directory, { recursive: true, force: true });
        callback(error);
      }
    })().catch(callback);
  },
  _removeFile(req, file, callback) {
    if (!file.path) {
      memory._removeFile(req, file, callback);
      return;
    }
    rm(file.destination, { recursive: true, force: true }).then(() => callback(null), callback);
  },
};
