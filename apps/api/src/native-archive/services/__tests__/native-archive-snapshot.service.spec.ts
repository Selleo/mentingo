import { Readable } from "node:stream";

import { LESSON_TYPES } from "@repo/shared";

import { NativeArchiveSnapshotService } from "../native-archive-snapshot.service";

import type { NativeArchiveLiveTrainingLessonSnapshot } from "../../native-archive.types";
import type { UUIDType } from "src/common";
import type { CurrentUserType } from "src/common/types/current-user.type";
import type { SourceSnapshot } from "src/courses/types/master-course.types";

const COURSE_ID = "f594d687-096b-4599-84bf-1f296afdb1e1" as UUIDType;
const TRAINING_ID = "95287b72-b41d-4eb5-9f77-40c55fc6fc97" as UUIDType;
const EVENT_ID = "758038ba-58b9-4ecf-9bf9-ae45c45b2193" as UUIDType;
const LESSON_IDS = [
  "e34f6427-4be4-4b65-b7f7-cdd610d9bb78",
  "cd788e30-3eb7-4614-923d-e659a4964792",
] as UUIDType[];
const ACTOR = {
  userId: "2cf24dba-5fb0-42bb-9af4-eec6990d01a2",
  tenantId: "1c720b6d-390d-4613-aa75-a5cc0b642147",
} as CurrentUserType;

const course = {
  id: COURSE_ID,
  authorId: ACTOR.userId,
  authorMetadata: { authorId: ACTOR.userId },
  thumbnailS3Key: null,
  settings: { certificateSignature: null },
};

const sourceSnapshot = {
  course,
  lessons: LESSON_IDS.map((id) => ({ id, type: LESSON_TYPES.LIVE_TRAINING, fileS3Key: null })),
  questions: [],
  aiMentors: [],
  lessonContentResources: [],
  lessonResources: [],
  questionResources: [],
  courseResources: [],
  scormPackages: [],
} as unknown as SourceSnapshot;

describe("NativeArchiveSnapshotService", () => {
  it("exports only the learning-path archive fields and keeps localized maps", async () => {
    const pathId = "bdbf4909-d74e-43d6-96d8-c07c1d91400d" as UUIDType;
    const pathCourseId = COURSE_ID;
    const archiveRepository = {
      findLearningPathById: jest.fn().mockResolvedValue({
        id: pathId,
        title: { en: "Path", de: "Pfad" },
        description: { en: "Description", de: "Beschreibung" },
        thumbnailReference: null,
        status: "published",
        includesCertificate: true,
        settings: { certificateSignature: null, certificateFontColor: "#000000" },
        sequenceEnabled: true,
        authorId: ACTOR.userId,
        originType: "regular",
        baseLanguage: "en",
        availableLocales: ["en", "de"],
      }),
      findUserManagePermissions: jest.fn().mockResolvedValue({ global: true, own: false }),
      findLearningPathCourses: jest
        .fn()
        .mockResolvedValue([{ courseId: pathCourseId, displayOrder: 0 }]),
    };
    const pathCourseSnapshot = {
      ...sourceSnapshot,
      lessons: [],
    } as unknown as SourceSnapshot;
    const service = new NativeArchiveSnapshotService(
      archiveRepository as never,
      { getCourseById: jest.fn().mockResolvedValue(course) } as never,
      { buildSourceSnapshot: jest.fn().mockResolvedValue(pathCourseSnapshot) } as never,
      { listFileKeysByPrefix: jest.fn().mockResolvedValue([]) } as never,
      {} as never,
    );

    const result = await service.buildLearningPathExportSnapshot(pathId, ACTOR);

    expect(result.learningPath).toEqual({
      id: pathId,
      title: { en: "Path", de: "Pfad" },
      description: { en: "Description", de: "Beschreibung" },
      thumbnailReference: null,
      status: "published",
      includesCertificate: true,
      settings: { certificateSignature: null, certificateFontColor: "#000000" },
      sequenceEnabled: true,
      originType: "regular",
      baseLanguage: "en",
      availableLocales: ["en", "de"],
      courseLinks: [{ courseId: pathCourseId, displayOrder: 0 }],
    });
    expect(archiveRepository.findLearningPathCourses).toHaveBeenCalledWith(pathId);
  });

  it("attaches shared training metadata and materials to each live lesson", async () => {
    const archiveRepository = {
      findUserManagePermissions: jest.fn().mockResolvedValue({ global: true, own: false }),
      findLiveLessons: jest
        .fn()
        .mockResolvedValue(
          LESSON_IDS.map((lessonId) => ({ lessonId, liveTrainingId: TRAINING_ID, language: "en" })),
        ),
      findLiveTrainings: jest.fn().mockResolvedValue([
        {
          id: TRAINING_ID,
          calendarEventId: EVENT_ID,
          tenantId: ACTOR.tenantId,
          createdAt: "2025-01-02T03:04:05.000Z",
        },
      ]),
      findCalendarEvents: jest.fn().mockResolvedValue([
        {
          id: EVENT_ID,
          title: { en: "Workshop", de: "Workshop auf Deutsch" },
          tenantId: ACTOR.tenantId,
        },
      ]),
      findTrainingMaterials: jest.fn().mockResolvedValue([
        {
          trainingId: TRAINING_ID,
          relationshipType: "material",
          resource: { reference: "training/handout.pdf" },
        },
      ]),
    };
    const masterCourseRepository = { getCourseById: jest.fn().mockResolvedValue(course) };
    const masterCourseSnapshotService = {
      buildSourceSnapshot: jest.fn().mockResolvedValue(sourceSnapshot),
    };
    const service = new NativeArchiveSnapshotService(
      archiveRepository as never,
      masterCourseRepository as never,
      masterCourseSnapshotService as never,
      {} as never,
      {} as never,
    );

    const result = await service.buildCourseExportSnapshot(COURSE_ID, ACTOR);
    const lessons = result.courses[COURSE_ID]
      .liveTrainingLessons as NativeArchiveLiveTrainingLessonSnapshot[];

    expect(lessons.map((lesson) => lesson.lessonId)).toEqual(LESSON_IDS);
    expect(lessons[0].training).toEqual({
      id: TRAINING_ID,
      calendarEventId: EVENT_ID,
    });
    expect(lessons[0].event).toEqual({
      id: EVENT_ID,
      title: { en: "Workshop", de: "Workshop auf Deutsch" },
    });
    expect(lessons.every((lesson) => lesson.materials.length === 1)).toBe(true);
    expect(result.files.map((file) => file.sourceReference)).toEqual(["training/handout.pdf"]);
    expect(archiveRepository.findLiveTrainings).toHaveBeenCalledTimes(1);
    expect(archiveRepository.findTrainingMaterials).toHaveBeenCalledTimes(1);
  });

  it("exports local files and available image variants without remote references", async () => {
    const variantBase = "course/variants/cover.webp";
    const variantKey = "course/variants/cover-320w.webp";
    const snapshot = {
      ...sourceSnapshot,
      course: { ...course, thumbnailS3Key: variantBase },
      lessons: [],
      lessonContentResources: [
        { reference: "https://example.com/external.pdf" },
        { reference: "course/material.pdf" },
      ],
    } as unknown as SourceSnapshot;
    const storage = {
      getFileExists: jest.fn().mockImplementation(async (key: string) => key === variantKey),
    };
    const service = new NativeArchiveSnapshotService(
      { findUserManagePermissions: jest.fn().mockResolvedValue({ global: true }) } as never,
      { getCourseById: jest.fn().mockResolvedValue(course) } as never,
      { buildSourceSnapshot: jest.fn().mockResolvedValue(snapshot) } as never,
      storage as never,
      {} as never,
    );

    const result = await service.buildCourseExportSnapshot(COURSE_ID, ACTOR);

    expect(result.files.map((file) => file.sourceReference)).toEqual([
      "course/material.pdf",
      variantKey,
    ]);
    expect(storage.getFileExists).toHaveBeenCalled();
  });

  it("uses the stored tenant host when downloading a Bunny video", async () => {
    const tenantHost = "https://tenant1.lms.localhost";
    const snapshot = {
      ...sourceSnapshot,
      lessons: sourceSnapshot.lessons.map((lesson) => ({
        ...lesson,
        type: LESSON_TYPES.CONTENT,
        fileS3Key: "bunny-video-id",
      })),
    };
    const masterCourseRepository = {
      getCourseById: jest.fn().mockResolvedValue(course),
      getTenantHost: jest.fn().mockResolvedValue(tenantHost),
    };
    const bunnyStreamService = {
      downloadMp4Fallback: jest.fn().mockResolvedValue({ stream: Readable.from([]) }),
    };
    const service = new NativeArchiveSnapshotService(
      { findUserManagePermissions: jest.fn().mockResolvedValue({ global: true }) } as never,
      masterCourseRepository as never,
      { buildSourceSnapshot: jest.fn().mockResolvedValue(snapshot) } as never,
      {} as never,
      bunnyStreamService as never,
    );

    const result = await service.buildCourseExportSnapshot(COURSE_ID, ACTOR);
    await result.files[0]?.open();

    expect(masterCourseRepository.getTenantHost).toHaveBeenCalledWith(ACTOR.tenantId);
    expect(bunnyStreamService.downloadMp4Fallback).toHaveBeenCalledWith(
      "video-id",
      720,
      tenantHost,
    );
  });
});
