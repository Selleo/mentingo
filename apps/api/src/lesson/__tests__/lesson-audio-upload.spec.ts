import { execFileSync } from "node:child_process";
import { access, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { Test } from "@nestjs/testing";
import request from "supertest";

import { FeaturesGuard } from "src/common/guards/features.guard";

jest.mock("../services/adminLesson.service", () => ({ AdminLessonService: class {} }));
jest.mock("../services/lesson.service", () => ({ LessonService: class {} }));

import { LessonController } from "../lesson.controller";
import { AdminLessonService } from "../services/adminLesson.service";
import { LessonService } from "../services/lesson.service";

import type { INestApplication } from "@nestjs/common";

describe("lesson audio multipart upload", () => {
  let app: INestApplication;
  let directory: string;
  let upload: jest.Mock;
  beforeAll(async () => {
    directory = await mkdtemp(path.join(tmpdir(), "lesson-audio-http-test-"));
    execFileSync("ffmpeg", [
      "-v",
      "error",
      "-f",
      "lavfi",
      "-i",
      "sine=duration=0.1",
      path.join(directory, "audio.wav"),
    ]);
    upload = jest.fn(async (_user, file: Express.Multer.File) => {
      expect(file.buffer).toBeUndefined();
      expect(file.mimetype).toBe("audio/wav");
      expect(await readFile(file.path)).toEqual(await readFile(path.join(directory, "audio.wav")));
      return { resourceId: "11111111-1111-4111-8111-111111111111" };
    });
    const module = await Test.createTestingModule({
      controllers: [LessonController],
      providers: [
        { provide: AdminLessonService, useValue: { uploadFileToLesson: upload } },
        { provide: LessonService, useValue: {} },
      ],
    })
      .overrideGuard(FeaturesGuard)
      .useValue({ canActivate: () => true })
      .compile();
    app = module.createNestApplication();
    await app.init();
  });
  afterAll(async () => {
    await app?.close();
    await rm(directory, { recursive: true, force: true });
  });

  it("accepts canonicalizable audio and cleans up its temporary file after delivery", async () => {
    const response = await request(app.getHttpServer())
      .post("/lesson/upload-files-to-lesson")
      .field("language", "en")
      .field("title", "Podcast")
      .field("description", "Episode")
      .attach("file", path.join(directory, "audio.wav"), { contentType: "audio/x-wav" })
      .expect(201);
    expect(response.body.data.resourceId).toBe("11111111-1111-4111-8111-111111111111");
    const file = upload.mock.calls[0][1] as Express.Multer.File;
    // Cleanup is awaited before the success response is completed.
    await expect(access(file.path)).rejects.toThrow();
  });
});
