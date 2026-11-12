import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { PgDialect } from "drizzle-orm/pg-core";

import { RESOURCE_CATEGORIES } from "src/file/file.constants";
import { FileService } from "src/file/file.service";
import { AdminLessonRepository } from "src/lesson/repositories/adminLesson.repository";
import { AdminLessonService } from "src/lesson/services/adminLesson.service";

import type { SQL } from "drizzle-orm";
import type { UUIDType } from "src/common";
import type { CurrentUserType } from "src/common/types/current-user.type";

const tenantId = "11111111-1111-4111-8111-111111111111" as UUIDType;
const lessonId = "22222222-2222-4222-8222-222222222222" as UUIDType;
const resourceId = "33333333-3333-4333-8333-333333333333" as UUIDType;

describe("lesson audio duration metadata storage", () => {
  let directory: string;
  let file: Express.Multer.File;
  let storedMetadata: SQL[];
  let fileService: FileService;
  let adminLessonService: AdminLessonService;

  beforeAll(async () => {
    directory = await mkdtemp(path.join(tmpdir(), "lesson-audio-duration-"));
    const filePath = path.join(directory, "episode.wav");
    execFileSync("ffmpeg", ["-v", "error", "-f", "lavfi", "-i", "sine=duration=1.25", filePath]);
    const buffer = await readFile(filePath);
    file = {
      buffer,
      size: buffer.length,
      originalname: "episode.wav",
      mimetype: "audio/x-wav",
    } as Express.Multer.File;
  });

  afterAll(async () => rm(directory, { recursive: true, force: true }));

  beforeEach(() => {
    storedMetadata = [];
    const transaction = {
      insert: jest.fn(() => ({
        values: (values: { metadata?: SQL } | { metadata?: SQL }[]) => {
          for (const value of Array.isArray(values) ? values : [values]) {
            if (value.metadata) storedMetadata.push(value.metadata);
          }
          return { returning: async () => [{ id: resourceId }] };
        },
      })),
    };
    const db = {
      transaction: async (callback: (trx: unknown) => unknown) => callback(transaction),
    };
    fileService = Object.assign(Object.create(FileService.prototype), {
      db,
      s3Service: { uploadFile: jest.fn(), getSignedUrl: async () => "signed" },
      getFileUrl: async () => "signed",
    }) as FileService;
    const adminLessonRepository = Object.assign(Object.create(AdminLessonRepository.prototype), {
      db,
    });
    adminLessonService = Object.assign(Object.create(AdminLessonService.prototype), {
      fileService,
      adminLessonRepository,
      masterCourseService: { assertCourseContentEditableByLessonId: jest.fn() },
      courseFeaturePolicyService: { assertCourseFeatureEnabledByLessonId: jest.fn() },
      searchIndexService: { refreshLesson: jest.fn() },
      buildMulterFileFromSignedUrl: async () => file,
    }) as AdminLessonService;
  });

  const expectStoredDuration = () => {
    expect(storedMetadata).toHaveLength(1);
    const query = new PgDialect().sqlToQuery(storedMetadata[0]);
    expect(query.params).toEqual(
      expect.arrayContaining(["originalFilename", "episode.wav", "durationSeconds", 2]),
    );
    const durationKeyIndex = query.params.indexOf("durationSeconds");
    expect(query.params[durationKeyIndex + 1]).toBe(2);
    expect(query.sql).toContain("::numeric");
  };

  it("includes canonical duration in the resource insert for multipart lesson authoring", async () => {
    await adminLessonService.uploadFileToLesson(
      { tenantId, userId: tenantId } as CurrentUserType,
      file,
      "en",
      "Episode",
      "Description",
    );
    expectStoredDuration();
  });

  it("includes canonical duration in the resource insert for signed URL lesson authoring", async () => {
    await adminLessonService.uploadFileToLessonFromSignedUrl(
      { tenantId, userId: tenantId } as CurrentUserType,
      lessonId,
      "https://storage.example/episode.wav",
    );
    expectStoredDuration();
  });

  it("omits duration for uploads without audio metadata", async () => {
    jest.spyOn(fileService, "uploadFile").mockResolvedValue({
      fileKey: "document.pdf",
      fileUrl: "signed",
      contentType: "application/pdf",
    });
    await fileService.uploadResource({
      file,
      folder: "lesson-content",
      resource: RESOURCE_CATEGORIES.LESSON,
      currentUser: { tenantId } as CurrentUserType,
    });
    const query = new PgDialect().sqlToQuery(storedMetadata[0]);
    expect(query.params).not.toContain("durationSeconds");
  });
});
