import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { COURSE_ORIGIN_TYPES, SYSTEM_ROLE_SLUGS } from "@repo/shared";
import { eq, inArray } from "drizzle-orm";
import { v5 as uuidv5 } from "uuid";

import { DB } from "src/storage/db/db.providers";
import {
  chapters,
  courses,
  lessons,
  nativeArchiveEntityMap,
  studentLessonProgress,
} from "src/storage/schema";

import { createE2ETest } from "../../../../test/create-e2e-test";
import { createUserFactory } from "../../../../test/factory/user.factory";
import { NATIVE_ARCHIVE_IMPORT_MODES, NATIVE_ARCHIVE_KIND } from "../../native-archive.constants";
import { NativeArchiveAssetsService } from "../native-archive-assets.service";
import { NativeArchiveImportService } from "../native-archive-import.service";

import {
  createNativeArchiveCourseSnapshot,
  createNativeArchiveImportInput,
  createNativeArchiveLearningPathSnapshot,
  writeNativeArchiveZip,
} from "./native-archive-import.e2e-utils";

import type { INestApplication } from "@nestjs/common";
import type { DatabasePg, UUIDType } from "src/common";
import type { CurrentUserType } from "src/common/types/current-user.type";

/** A newer version of the archive course: the first lesson is renamed and a second one added. */
function createUpdatedCourseSnapshot(sourceCourseId: UUIDType, addedLessonId: UUIDType) {
  const snapshot = createNativeArchiveCourseSnapshot(sourceCourseId, { withContent: true });
  const [chapter] = snapshot.chapters;
  const [lesson] = snapshot.lessons;

  return {
    ...snapshot,
    course: { ...snapshot.course, title: { en: "Archive course, second edition" } },
    chapters: [{ ...chapter, lessonCount: 2 }],
    lessons: [
      { ...lesson, title: { en: "Archive content lesson, revised" } },
      { ...lesson, id: addedLessonId, title: { en: "Archive added lesson" }, displayOrder: 1 },
    ],
  };
}

describe("Native archive shared course import (e2e)", () => {
  let app: INestApplication;
  let db: DatabasePg;
  let importer: NativeArchiveImportService;
  let actor: CurrentUserType;
  let temporaryDirectory: string;
  let runAsTenant: <T>(tenantId: string, fn: () => Promise<T>) => Promise<T>;

  beforeAll(async () => {
    const testContext = await createE2ETest();
    app = testContext.app;
    db = app.get(DB);
    importer = app.get(NativeArchiveImportService);
    runAsTenant = testContext.runAsTenant;
    temporaryDirectory = await mkdtemp(path.join(tmpdir(), "native-archive-shared-import-e2e-"));

    const user = await createUserFactory(db)
      .withAdminSettings(db)
      .create({ role: SYSTEM_ROLE_SLUGS.ADMIN });
    actor = { userId: user.id, tenantId: testContext.defaultTenantId } as CurrentUserType;
  });

  beforeEach(() => {
    jest
      .spyOn(app.get(NativeArchiveAssetsService), "stageArchiveAssets")
      .mockImplementation(async (_archive, _actor, snapshots) => ({
        snapshots,
        uploadedResourceIdsByFileKey: new Map(),
        rewriteReference: (reference) => reference,
        rewriteValue: (value) => value,
        deleteStaged: async () => undefined,
      }));
  });

  afterEach(() => jest.restoreAllMocks());

  afterAll(async () => {
    await rm(temporaryDirectory, { recursive: true, force: true });
    await app.close();
  });

  const writeCourseArchive = (snapshot: ReturnType<typeof createUpdatedCourseSnapshot>) =>
    writeNativeArchiveZip(
      {
        kind: NATIVE_ARCHIVE_KIND.COURSE,
        rootId: snapshot.course.id,
        courses: { [snapshot.course.id]: snapshot },
        files: [],
      },
      temporaryDirectory,
    );

  const importArchive = (
    zipPath: string,
    importMode: (typeof NATIVE_ARCHIVE_IMPORT_MODES)[keyof typeof NATIVE_ARCHIVE_IMPORT_MODES],
  ) => runAsTenant(actor.tenantId, () => importer.importArchive(zipPath, actor, importMode));

  const findCourseLessons = async (courseId: UUIDType) => {
    const courseChapters = await db.select().from(chapters).where(eq(chapters.courseId, courseId));

    return db
      .select()
      .from(lessons)
      .where(
        inArray(
          lessons.chapterId,
          courseChapters.map((chapter) => chapter.id),
        ),
      );
  };

  it("imports a course as a shared course that remembers where its entities came from", async () => {
    const sourceCourseId = randomUUID();
    const targetCourseId = uuidv5(`native-archive:${sourceCourseId}`, actor.tenantId);

    const result = await importArchive(
      await writeCourseArchive(
        createNativeArchiveCourseSnapshot(sourceCourseId, { withContent: true }),
      ),
      NATIVE_ARCHIVE_IMPORT_MODES.SYNC,
    );

    const [savedCourse] = await db.select().from(courses).where(eq(courses.id, targetCourseId));
    const mappings = await db
      .select()
      .from(nativeArchiveEntityMap)
      .where(eq(nativeArchiveEntityMap.courseId, targetCourseId));

    expect(result).toMatchObject({
      rootId: targetCourseId,
      alreadyExists: false,
      createdCourseIds: [targetCourseId],
    });
    expect(savedCourse).toMatchObject({
      originType: COURSE_ORIGIN_TYPES.EXPORTED,
      originalId: sourceCourseId,
      sourceCourseId: null,
      sourceTenantId: null,
    });
    expect(await findCourseLessons(targetCourseId)).toHaveLength(1);
    expect(mappings.map((mapping) => mapping.entityType).sort()).toEqual(["chapter", "lesson"]);
  });

  it("updates the shared course in place when a newer archive is imported, keeping progress", async () => {
    const sourceCourseId = randomUUID();
    const addedLessonId = randomUUID();
    const targetCourseId = uuidv5(`native-archive:${sourceCourseId}`, actor.tenantId);
    await importArchive(
      await writeCourseArchive(
        createNativeArchiveCourseSnapshot(sourceCourseId, { withContent: true }),
      ),
      NATIVE_ARCHIVE_IMPORT_MODES.SYNC,
    );
    const [originalLesson] = await findCourseLessons(targetCourseId);
    await db.insert(studentLessonProgress).values({
      studentId: actor.userId,
      chapterId: originalLesson.chapterId,
      lessonId: originalLesson.id,
      completedAt: new Date().toISOString(),
    });

    const result = await importArchive(
      await writeCourseArchive(createUpdatedCourseSnapshot(sourceCourseId, addedLessonId)),
      NATIVE_ARCHIVE_IMPORT_MODES.SYNC,
    );

    const [savedCourse] = await db.select().from(courses).where(eq(courses.id, targetCourseId));
    const syncedLessons = await findCourseLessons(targetCourseId);
    const progress = await db
      .select()
      .from(studentLessonProgress)
      .where(eq(studentLessonProgress.lessonId, originalLesson.id));

    expect(result).toMatchObject({ rootId: targetCourseId, alreadyExists: true });
    expect(savedCourse.title).toEqual({ en: "Archive course, second edition" });
    expect(syncedLessons).toHaveLength(2);
    expect(syncedLessons).toContainEqual(
      expect.objectContaining({
        id: originalLesson.id,
        title: { en: "Archive content lesson, revised" },
      }),
    );
    expect(syncedLessons).toContainEqual(
      expect.objectContaining({ title: { en: "Archive added lesson" } }),
    );
    expect(progress).toHaveLength(1);
  });

  it("removes lessons the newer archive no longer contains", async () => {
    const sourceCourseId = randomUUID();
    const addedLessonId = randomUUID();
    const targetCourseId = uuidv5(`native-archive:${sourceCourseId}`, actor.tenantId);
    await importArchive(
      await writeCourseArchive(createUpdatedCourseSnapshot(sourceCourseId, addedLessonId)),
      NATIVE_ARCHIVE_IMPORT_MODES.SYNC,
    );

    await importArchive(
      await writeCourseArchive(
        createNativeArchiveCourseSnapshot(sourceCourseId, { withContent: true }),
      ),
      NATIVE_ARCHIVE_IMPORT_MODES.SYNC,
    );

    expect(await findCourseLessons(targetCourseId)).toEqual([
      expect.objectContaining({ title: { en: "Archive content lesson" } }),
    ]);
  });

  it("refuses to sync a course that was imported as an editable copy", async () => {
    const zipPath = await writeCourseArchive(createNativeArchiveCourseSnapshot(randomUUID()));
    await importArchive(zipPath, NATIVE_ARCHIVE_IMPORT_MODES.COPY);

    await expect(importArchive(zipPath, NATIVE_ARCHIVE_IMPORT_MODES.SYNC)).rejects.toThrow(
      "nativeArchive.error.courseNotSyncable",
    );
  });

  it("refuses to import a learning path as a shared course", async () => {
    const courseSnapshot = createNativeArchiveCourseSnapshot(randomUUID());
    const zipPath = await writeNativeArchiveZip(
      createNativeArchiveImportInput(
        NATIVE_ARCHIVE_KIND.LEARNING_PATH,
        [courseSnapshot],
        createNativeArchiveLearningPathSnapshot([courseSnapshot.course.id], randomUUID()),
      ),
      temporaryDirectory,
    );

    await expect(importArchive(zipPath, NATIVE_ARCHIVE_IMPORT_MODES.SYNC)).rejects.toThrow(
      "nativeArchive.error.invalidArchive",
    );
  });
});
