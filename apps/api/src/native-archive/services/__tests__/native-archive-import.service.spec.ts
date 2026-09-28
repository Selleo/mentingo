import { ForbiddenException } from "@nestjs/common";

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
const ACTOR = {
  userId: "2cf24dba-5fb0-42bb-9af4-eec6990d01a2",
  tenantId: "1c720b6d-390d-4613-aa75-a5cc0b642147",
} as CurrentUserType;

describe("NativeArchiveImportService", () => {
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
      courses: {},
      assetFiles: new Map(),
      cleanup,
    } as ParsedNativeArchive);

    const archiveRepository = {
      findUserPermission: jest.fn().mockResolvedValue({ allowed: true }),
    };
    const courseRepository = {
      findCourseByIdInTenant: jest.fn().mockResolvedValue({ id: COURSE_ID }),
    };
    const assetsService = { stageArchiveAssets: jest.fn() };
    const unusedDependency = {} as never;
    const service = new NativeArchiveImportService(
      archiveRepository as never,
      unusedDependency,
      courseRepository as never,
      unusedDependency,
      assetsService as never,
      unusedDependency,
      unusedDependency,
      unusedDependency,
      unusedDependency,
      unusedDependency,
    );

    const result = await service.importArchive("archive.zip", ACTOR);

    expect(result).toEqual({
      kind: NATIVE_ARCHIVE_KIND.COURSE,
      rootId: COURSE_ID,
      alreadyExists: true,
      createdCourseIds: [],
      reusedCourseIds: [],
    });
    expect(archiveRepository.findUserPermission).toHaveBeenCalled();
    expect(courseRepository.findCourseByIdInTenant).toHaveBeenCalledWith(COURSE_ID);
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
