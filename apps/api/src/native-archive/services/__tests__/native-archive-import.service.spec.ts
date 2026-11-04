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
      openAsset: jest.fn(),
      extractAsset: jest.fn(),
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
    const courseTransferGraphRepository = {
      findCategoryByBaseTitle: jest.fn().mockResolvedValue({ id: "category-id" }),
      ensureCourseSummaryStats: jest.fn(),
    };
    const courseTransferService = {
      copyCourseIntoExistingCourse: jest.fn().mockResolvedValue({ chapterMap: new Map() }),
    };
    const assetsService = {
      stageArchiveAssets: jest.fn().mockResolvedValue({
        snapshots: [snapshot],
        uploadedResourceIdsByFileKey: new Map(),
        rewriteReference: (reference: string | null) => reference,
        rewriteValue: (value: unknown) => value,
        deleteStaged: jest.fn(),
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
      courseTransferGraphRepository as never,
      courseTransferService as never,
      assetsService as never,
      validationService as never,
      liveTrainingService as never,
      {} as never,
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
    expect(courseTransferService.copyCourseIntoExistingCourse).toHaveBeenCalledWith(
      expect.objectContaining({
        source: { tenantId: ACTOR.tenantId, snapshot },
        destination: { tenantId: ACTOR.tenantId, courseId: targetCourseId },
      }),
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
      openAsset: jest.fn(),
      extractAsset: jest.fn(),
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
      openAsset: jest.fn(),
      extractAsset: jest.fn(),
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
      openAsset: jest.fn(),
      extractAsset: jest.fn(),
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
      unusedDependency,
    );

    await expect(service.importArchive("archive.zip", ACTOR)).rejects.toThrow(
      "nativeArchive.error.invalidCourseSnapshot",
    );
    expect(assetsService.stageArchiveAssets).not.toHaveBeenCalled();
    expect(cleanup).toHaveBeenCalledTimes(1);
  });
});

describe("NativeArchiveImportService category identity", () => {
  const snapshot = {
    category: {
      title: { pl: "Shared category" },
      baseLanguage: "pl",
      availableLocales: ["pl"],
    },
  };

  function resolver() {
    const courseTransferGraphRepository = {
      findCategoryByBaseTitle: jest.fn().mockResolvedValue(undefined),
      findCategoryByStoredBaseTitle: jest.fn().mockResolvedValue(undefined),
      createCategoryFromSource: jest.fn().mockResolvedValue({ id: "created-category" }),
    };
    const service = new NativeArchiveImportService(
      {} as never,
      {} as never,
      courseTransferGraphRepository as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );
    return { courseTransferGraphRepository, service };
  }

  it("keeps the existing localized category without creating or rewriting it", async () => {
    const { service, courseTransferGraphRepository } = resolver();
    courseTransferGraphRepository.findCategoryByBaseTitle.mockResolvedValue({ id: "localized" });

    await expect(service["resolveImportedCategoryId"](snapshot as never)).resolves.toBe(
      "localized",
    );
    expect(courseTransferGraphRepository.findCategoryByStoredBaseTitle).not.toHaveBeenCalled();
    expect(courseTransferGraphRepository.createCategoryFromSource).not.toHaveBeenCalled();
  });

  it("reuses a different-locale category with the same indexed base title", async () => {
    const { service, courseTransferGraphRepository } = resolver();
    courseTransferGraphRepository.findCategoryByStoredBaseTitle.mockResolvedValue({
      id: "english",
    });

    await expect(service["resolveImportedCategoryId"](snapshot as never)).resolves.toBe("english");
    expect(courseTransferGraphRepository.findCategoryByBaseTitle).toHaveBeenCalledWith(
      "Shared category",
      "pl",
    );
    expect(courseTransferGraphRepository.findCategoryByStoredBaseTitle).toHaveBeenCalledWith(
      "Shared category",
    );
    expect(courseTransferGraphRepository.createCategoryFromSource).not.toHaveBeenCalled();
  });

  it("creates a genuinely new category with the authored locales", async () => {
    const { service, courseTransferGraphRepository } = resolver();

    await expect(service["resolveImportedCategoryId"](snapshot as never)).resolves.toBe(
      "created-category",
    );
    expect(courseTransferGraphRepository.createCategoryFromSource).toHaveBeenCalledWith(
      expect.objectContaining({ baseLanguage: "pl", availableLocales: ["pl"] }),
    );
    expect(courseTransferGraphRepository.findCategoryByStoredBaseTitle).toHaveBeenCalledTimes(1);
  });

  it("uses the winner when a concurrent insert returns no row", async () => {
    const { service, courseTransferGraphRepository } = resolver();
    courseTransferGraphRepository.findCategoryByStoredBaseTitle
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce({ id: "concurrent-winner" });
    courseTransferGraphRepository.createCategoryFromSource.mockResolvedValue(undefined);

    await expect(service["resolveImportedCategoryId"](snapshot as never)).resolves.toBe(
      "concurrent-winner",
    );
    expect(courseTransferGraphRepository.createCategoryFromSource).toHaveBeenCalledTimes(1);
    expect(courseTransferGraphRepository.findCategoryByStoredBaseTitle).toHaveBeenCalledTimes(2);
  });

  it("still rejects when creation and the conflict lookup produce no category", async () => {
    const { service, courseTransferGraphRepository } = resolver();
    courseTransferGraphRepository.createCategoryFromSource.mockResolvedValue(undefined);

    await expect(service["resolveImportedCategoryId"](snapshot as never)).rejects.toThrow(
      "nativeArchive.error.categoryCreationFailed",
    );
  });

  it("rejects a missing base-language title before accessing the repository", async () => {
    const { service, courseTransferGraphRepository } = resolver();

    await expect(
      service["resolveImportedCategoryId"]({
        category: { title: {}, baseLanguage: "pl" },
      } as never),
    ).rejects.toThrow("nativeArchive.error.invalidCategory");
    expect(courseTransferGraphRepository.findCategoryByBaseTitle).not.toHaveBeenCalled();
    expect(courseTransferGraphRepository.findCategoryByStoredBaseTitle).not.toHaveBeenCalled();
    expect(courseTransferGraphRepository.createCategoryFromSource).not.toHaveBeenCalled();
  });
});
