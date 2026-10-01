import { ForbiddenException } from "@nestjs/common";
import { v5 as uuidv5 } from "uuid";

import {
  NATIVE_ARCHIVE_FORMAT,
  NATIVE_ARCHIVE_KIND,
  NATIVE_ARCHIVE_VERSION,
} from "../../native-archive.constants";
import { NativeArchiveImportService } from "../native-archive-import.service";
import { NativeArchiveValidationService } from "../native-archive-validation.service";
import { readNativeArchive } from "../native-archive-zip.service";

import type { ParsedNativeArchive } from "../../native-archive.types";
import type { CurrentUserType } from "src/common/types/current-user.type";

jest.mock("../native-archive-zip.service", () => ({ readNativeArchive: jest.fn() }));

const COURSE_ID = "f594d687-096b-4599-84bf-1f296afdb1e1";
const PATH_ID = "b7e3f32d-c1ab-4cb9-95e1-79212698bf54";
const ACTOR = {
  userId: "2cf24dba-5fb0-42bb-9af4-eec6990d01a2",
  tenantId: "1c720b6d-390d-4613-aa75-a5cc0b642147",
} as CurrentUserType;

describe("NativeArchiveImportService", () => {
  it("creates destination IDs and links the imported path to its destination course", async () => {
    const snapshot = {
      course: {
        id: COURSE_ID,
        originalId: null,
        title: { en: "Course" },
        description: { en: "Description" },
        courseType: "default",
        settings: {},
        baseLanguage: "en",
        availableLocales: ["en"],
      },
      category: { title: { en: "Category" }, baseLanguage: "en" },
      lessons: [],
      aiMentorDocChunks: [],
      scormPackages: [],
    };
    const learningPath = {
      id: PATH_ID,
      originalId: null,
      title: { en: "Path" },
      description: { en: "Description" },
      thumbnailReference: null,
      settings: { certificateSignature: null, certificateFontColor: null },
      includesCertificate: false,
      sequenceEnabled: false,
      baseLanguage: "en",
      availableLocales: ["en"],
      courseLinks: [{ courseId: COURSE_ID, displayOrder: 0 }],
    };
    const cleanup = jest.fn().mockResolvedValue(undefined);
    jest.mocked(readNativeArchive).mockResolvedValue({
      manifest: {
        format: NATIVE_ARCHIVE_FORMAT,
        version: NATIVE_ARCHIVE_VERSION,
        kind: NATIVE_ARCHIVE_KIND.LEARNING_PATH,
        rootId: PATH_ID,
        courseIds: [COURSE_ID],
        applicationVersion: "test",
        exportedAt: new Date().toISOString(),
        assets: [],
      },
      courses: { [COURSE_ID]: snapshot },
      learningPath,
      assetFiles: new Map(),
      cleanup,
    } as ParsedNativeArchive);

    const archiveRepository = {
      findUserPermission: jest.fn().mockResolvedValue({ allowed: true }),
      findLearningPathByArchiveIdentity: jest.fn().mockResolvedValue(undefined),
      findCourseByArchiveIdentity: jest.fn().mockResolvedValue(undefined),
      createCourse: jest.fn(),
      createLearningPath: jest.fn(),
      createLearningPathCourses: jest.fn(),
    };
    const courseRepository = {
      findCategoryByBaseTitle: jest.fn().mockResolvedValue({ id: "category-id" }),
      ensureCourseSummaryStats: jest.fn(),
    };
    const masterCourseService = {
      duplicateCourseIntoExistingCourse: jest.fn().mockResolvedValue({ chapterMap: new Map() }),
    };
    const assetsService = {
      stageArchiveAssets: jest.fn().mockResolvedValue({
        snapshots: [snapshot],
        uploadedResourceIdsByFileKey: new Map(),
        rewriteReference: (reference: string | null) => reference,
        rewriteValue: (value: unknown) => value,
      }),
    };
    const validationService = {
      validateCourseSnapshot: jest.fn().mockReturnValue(snapshot),
      validateLearningPathSnapshot: jest.fn().mockReturnValue(learningPath),
      assertRequiredAssetsPresent: jest.fn(),
    };
    const liveTrainingService = { restoreLiveTrainingLessons: jest.fn() };
    const tenantRunner = { transaction: jest.fn((action: () => Promise<unknown>) => action()) };
    const service = new NativeArchiveImportService(
      archiveRepository as never,
      tenantRunner as never,
      courseRepository as never,
      masterCourseService as never,
      assetsService as never,
      validationService as never,
      liveTrainingService as never,
      {} as never,
      {} as never,
      {} as never,
    );

    const result = await service.importArchive("archive.zip", ACTOR);
    const targetCourseId = uuidv5(`native-archive:${COURSE_ID}`, ACTOR.tenantId);
    const targetPathId = uuidv5(`native-archive:${PATH_ID}`, ACTOR.tenantId);

    expect(result).toEqual({
      kind: NATIVE_ARCHIVE_KIND.LEARNING_PATH,
      rootId: targetPathId,
      alreadyExists: false,
      createdCourseIds: [targetCourseId],
      reusedCourseIds: [],
    });
    expect(archiveRepository.createCourse).toHaveBeenCalledWith(
      expect.objectContaining({ id: targetCourseId, originalId: COURSE_ID }),
    );
    expect(masterCourseService.duplicateCourseIntoExistingCourse).toHaveBeenCalledWith(
      expect.objectContaining({ sourceCourseId: COURSE_ID, targetCourseId }),
    );
    expect(archiveRepository.createLearningPath).toHaveBeenCalledWith(
      expect.objectContaining({ id: targetPathId, originalId: PATH_ID }),
    );
    expect(archiveRepository.createLearningPathCourses).toHaveBeenCalledWith([
      { learningPathId: targetPathId, courseId: targetCourseId, displayOrder: 0 },
    ]);
    expect(cleanup).toHaveBeenCalledTimes(1);
  });

  it("skips an existing course before staging assets", async () => {
    const cleanup = jest.fn().mockResolvedValue(undefined);
    jest.mocked(readNativeArchive).mockResolvedValue({
      manifest: {
        format: NATIVE_ARCHIVE_FORMAT,
        version: NATIVE_ARCHIVE_VERSION,
        kind: NATIVE_ARCHIVE_KIND.COURSE,
        rootId: COURSE_ID,
        courseIds: [COURSE_ID],
        applicationVersion: "test",
        exportedAt: new Date().toISOString(),
        assets: [],
      },
      courses: { [COURSE_ID]: { course: { id: COURSE_ID, originalId: null } } },
      assetFiles: new Map(),
      cleanup,
    } as ParsedNativeArchive);

    const archiveRepository = {
      findUserPermission: jest.fn().mockResolvedValue({ allowed: true }),
      findCourseByArchiveIdentity: jest.fn().mockResolvedValue({ id: "target-course-id" }),
    };
    const validationService = {
      validateCourseSnapshot: jest.fn((value) => value),
      validateLearningPathSnapshot: jest.fn().mockReturnValue(undefined),
    };
    const assetsService = { stageArchiveAssets: jest.fn() };
    const unusedDependency = {} as never;
    const service = new NativeArchiveImportService(
      archiveRepository as never,
      unusedDependency,
      unusedDependency,
      unusedDependency,
      assetsService as never,
      validationService as never,
      unusedDependency,
      unusedDependency,
      unusedDependency,
      unusedDependency,
    );

    const result = await service.importArchive("archive.zip", ACTOR);

    expect(result).toEqual({
      kind: NATIVE_ARCHIVE_KIND.COURSE,
      rootId: "target-course-id",
      alreadyExists: true,
      createdCourseIds: [],
      reusedCourseIds: [],
    });
    expect(archiveRepository.findUserPermission).toHaveBeenCalled();
    expect(archiveRepository.findCourseByArchiveIdentity).toHaveBeenCalledWith(
      COURSE_ID,
      COURSE_ID,
      ACTOR.tenantId,
    );
    expect(assetsService.stageArchiveAssets).not.toHaveBeenCalled();
    expect(cleanup).toHaveBeenCalledTimes(1);
  });

  it("cleans up the parsed archive when the actor cannot create courses", async () => {
    const cleanup = jest.fn().mockResolvedValue(undefined);
    jest.mocked(readNativeArchive).mockResolvedValue({
      manifest: {
        format: NATIVE_ARCHIVE_FORMAT,
        version: NATIVE_ARCHIVE_VERSION,
        kind: NATIVE_ARCHIVE_KIND.COURSE,
        rootId: COURSE_ID,
        courseIds: [COURSE_ID],
        applicationVersion: "test",
        exportedAt: new Date().toISOString(),
        assets: [],
      },
      courses: {},
      assetFiles: new Map(),
      cleanup,
    } as ParsedNativeArchive);

    const archiveRepository = {
      findUserPermission: jest.fn().mockResolvedValue({ allowed: false }),
    };
    const unusedDependency = {} as never;
    const service = new NativeArchiveImportService(
      archiveRepository as never,
      unusedDependency,
      unusedDependency,
      unusedDependency,
      unusedDependency,
      unusedDependency,
      unusedDependency,
      unusedDependency,
      unusedDependency,
      unusedDependency,
    );

    await expect(service.importArchive("archive.zip", ACTOR)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(cleanup).toHaveBeenCalledTimes(1);
  });

  it("rejects a malformed course snapshot before staging assets", async () => {
    const cleanup = jest.fn().mockResolvedValue(undefined);
    jest.mocked(readNativeArchive).mockResolvedValue({
      manifest: {
        format: NATIVE_ARCHIVE_FORMAT,
        version: NATIVE_ARCHIVE_VERSION,
        kind: NATIVE_ARCHIVE_KIND.COURSE,
        rootId: COURSE_ID,
        courseIds: [COURSE_ID],
        applicationVersion: "test",
        exportedAt: new Date().toISOString(),
        assets: [],
      },
      courses: {
        [COURSE_ID]: {
          course: { id: COURSE_ID, baseLanguage: "en", availableLocales: ["en"] },
        },
      },
      assetFiles: new Map(),
      cleanup,
    } as ParsedNativeArchive);

    const archiveRepository = {
      findUserPermission: jest.fn().mockResolvedValue({ allowed: true }),
    };
    const courseRepository = { findCourseByIdInTenant: jest.fn().mockResolvedValue(undefined) };
    const assetsService = { stageArchiveAssets: jest.fn() };
    const unusedDependency = {} as never;
    const service = new NativeArchiveImportService(
      archiveRepository as never,
      unusedDependency,
      courseRepository as never,
      unusedDependency,
      assetsService as never,
      new NativeArchiveValidationService(),
      unusedDependency,
      unusedDependency,
      unusedDependency,
      unusedDependency,
    );

    await expect(service.importArchive("archive.zip", ACTOR)).rejects.toThrow(
      "nativeArchive.error.invalidCourseSnapshot",
    );
    expect(assetsService.stageArchiveAssets).not.toHaveBeenCalled();
    expect(cleanup).toHaveBeenCalledTimes(1);
  });
});
