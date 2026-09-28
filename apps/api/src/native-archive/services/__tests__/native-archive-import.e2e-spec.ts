import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import {
  ENTITY_TYPES,
  LIVE_TRAINING_LINK_ENTITY_TYPES,
  LIVE_TRAINING_RESOURCE_RELATIONSHIP_TYPES,
  LIVE_TRAINING_STATUSES,
  SYSTEM_ROLE_SLUGS,
} from "@repo/shared";
import { and, eq, isNull } from "drizzle-orm";
import { v5 as uuidv5 } from "uuid";

import { MasterCourseService } from "src/courses/master-course.service";
import { DB } from "src/storage/db/db.providers";
import {
  calendarEvents,
  chapters,
  courses,
  learningPathCourses,
  learningPaths,
  lessons,
  liveLessons,
  liveTrainingLinks,
  liveTrainings,
  resourceEntity,
  resources,
  settings,
} from "src/storage/schema";
import { settingsToJSONBuildObject } from "src/utils/settings-to-json-build-object";

import { createE2ETest } from "../../../../test/create-e2e-test";
import { createCourseFactory } from "../../../../test/factory/course.factory";
import { createSettingsFactory } from "../../../../test/factory/settings.factory";
import { createUserFactory } from "../../../../test/factory/user.factory";
import { DEFAULT_E2E_GLOBAL_SETTINGS } from "../../../../test/helpers/e2e-settings";
import { NATIVE_ARCHIVE_KIND } from "../../native-archive.constants";
import { NativeArchiveAssetsService } from "../native-archive-assets.service";
import { NativeArchiveImportService } from "../native-archive-import.service";

import {
  createNativeArchiveCourseSnapshot,
  createNativeArchiveImportInput,
  createNativeArchiveLearningPathSnapshot,
  NATIVE_ARCHIVE_IMPORT_FIXTURE_IDS,
  writeNativeArchiveZip,
} from "./native-archive-import.e2e-utils";

import type { INestApplication } from "@nestjs/common";
import type { DatabasePg } from "src/common";
import type { CurrentUserType } from "src/common/types/current-user.type";

const {
  course: COURSE_ID,
  reusedCourse: REUSE_COURSE_ID,
  secondCourse: SECOND_COURSE_ID,
  learningPath: PATH_ID,
  reuseLearningPath: REUSE_PATH_ID,
  standaloneCourse: STANDALONE_COURSE_ID,
  invalidCourse: INVALID_COURSE_ID,
} = NATIVE_ARCHIVE_IMPORT_FIXTURE_IDS;

describe("Native archive import (e2e)", () => {
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
    temporaryDirectory = await mkdtemp(path.join(tmpdir(), "native-archive-import-e2e-"));

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
        rewriteReference: (reference) => reference,
        rewriteValue: (value) => value,
        deleteStaged: async () => undefined,
      }));
    jest
      .spyOn(app.get(MasterCourseService), "duplicateCourseIntoExistingCourse")
      .mockResolvedValue({ chapterMap: new Map(), lessonMap: new Map() });
  });

  afterAll(async () => {
    await rm(temporaryDirectory, { recursive: true, force: true });
    await app.close();
  });

  const importArchive = (zipPath: string, currentActor: CurrentUserType = actor) =>
    runAsTenant(currentActor.tenantId, () => importer.importArchive(zipPath, currentActor));

  it("imports a course into tenant-scoped rows with a distinct id and persisted originalId", async () => {
    const zipPath = await writeNativeArchiveZip(
      createNativeArchiveImportInput(NATIVE_ARCHIVE_KIND.COURSE, [
        createNativeArchiveCourseSnapshot(STANDALONE_COURSE_ID),
      ]),
      temporaryDirectory,
    );

    const result = await importArchive(zipPath);
    const targetId = uuidv5(`native-archive:${STANDALONE_COURSE_ID}`, actor.tenantId);
    const [savedCourse] = await db.select().from(courses).where(eq(courses.id, targetId));

    expect(result).toMatchObject({
      kind: NATIVE_ARCHIVE_KIND.COURSE,
      rootId: targetId,
      alreadyExists: false,
      createdCourseIds: [targetId],
    });
    expect(targetId).not.toBe(STANDALONE_COURSE_ID);
    expect(savedCourse).toMatchObject({
      id: targetId,
      originalId: STANDALONE_COURSE_ID,
      tenantId: actor.tenantId,
    });

    const repeatedResult = await importArchive(zipPath);
    expect(repeatedResult).toMatchObject({
      rootId: targetId,
      alreadyExists: true,
      createdCourseIds: [],
    });
  });

  it("imports a chapter and regular lesson with destination course and chapter IDs", async () => {
    jest.restoreAllMocks();
    const sourceCourseId = NATIVE_ARCHIVE_IMPORT_FIXTURE_IDS.contentCourse;
    const sourceChapterId = NATIVE_ARCHIVE_IMPORT_FIXTURE_IDS.contentChapter;
    const sourceLessonId = NATIVE_ARCHIVE_IMPORT_FIXTURE_IDS.contentLesson;
    const targetCourseId = uuidv5(`native-archive:${sourceCourseId}`, actor.tenantId);
    const zipPath = await writeNativeArchiveZip(
      createNativeArchiveImportInput(NATIVE_ARCHIVE_KIND.COURSE, [
        createNativeArchiveCourseSnapshot(sourceCourseId, { withContent: true }),
      ]),
      temporaryDirectory,
    );

    const result = await importArchive(zipPath);
    const [savedChapter] = await db
      .select()
      .from(chapters)
      .where(eq(chapters.courseId, targetCourseId));
    const [savedLesson] = savedChapter
      ? await db.select().from(lessons).where(eq(lessons.chapterId, savedChapter.id))
      : [];

    expect(result.createdCourseIds).toEqual([targetCourseId]);
    expect(savedChapter).toMatchObject({
      courseId: targetCourseId,
      title: { en: "Archive content chapter" },
    });
    expect(savedChapter?.id).not.toBe(sourceChapterId);
    expect(savedLesson).toMatchObject({
      chapterId: savedChapter?.id,
      type: "content",
      title: { en: "Archive content lesson" },
    });
    expect(savedLesson?.id).not.toBe(sourceLessonId);
  });

  it("restores a live training, its linked course, lesson, event, and material", async () => {
    jest.restoreAllMocks();
    const [globalSettings] = await db
      .select({ id: settings.id })
      .from(settings)
      .where(isNull(settings.userId));
    if (!globalSettings) await createSettingsFactory(db).create();

    await db
      .update(settings)
      .set({
        settings: settingsToJSONBuildObject({
          ...DEFAULT_E2E_GLOBAL_SETTINGS,
          calendarEnabled: true,
          liveTrainingEnabled: true,
        }),
      })
      .where(isNull(settings.userId));

    const sourceCourseId = NATIVE_ARCHIVE_IMPORT_FIXTURE_IDS.liveTrainingCourse;
    const sourceChapterId = NATIVE_ARCHIVE_IMPORT_FIXTURE_IDS.liveTrainingChapter;
    const sourceLessonId = NATIVE_ARCHIVE_IMPORT_FIXTURE_IDS.liveTrainingLesson;
    const targetCourseId = uuidv5(`native-archive:${sourceCourseId}`, actor.tenantId);
    const zipPath = await writeNativeArchiveZip(
      createNativeArchiveImportInput(NATIVE_ARCHIVE_KIND.COURSE, [
        createNativeArchiveCourseSnapshot(sourceCourseId, { withLiveTraining: true }),
      ]),
      temporaryDirectory,
    );

    const result = await importArchive(zipPath);
    const [targetChapter] = await db
      .select()
      .from(chapters)
      .where(eq(chapters.courseId, targetCourseId));
    const [targetLesson] = targetChapter
      ? await db.select().from(lessons).where(eq(lessons.chapterId, targetChapter.id))
      : [];
    const [liveLesson] = targetLesson
      ? await db.select().from(liveLessons).where(eq(liveLessons.lessonId, targetLesson.id))
      : [];
    const [training] = liveLesson
      ? await db.select().from(liveTrainings).where(eq(liveTrainings.id, liveLesson.liveTrainingId))
      : [];
    const [event] = training
      ? await db
          .select()
          .from(calendarEvents)
          .where(eq(calendarEvents.id, training.calendarEventId))
      : [];
    const [trainingLink] = training
      ? await db
          .select()
          .from(liveTrainingLinks)
          .where(eq(liveTrainingLinks.id, liveLesson.liveTrainingLinkId))
      : [];
    const [materialLink] = training
      ? await db.select().from(resourceEntity).where(eq(resourceEntity.entityId, training.id))
      : [];
    const [material] = materialLink
      ? await db.select().from(resources).where(eq(resources.id, materialLink.resourceId))
      : [];

    expect(result.createdCourseIds).toEqual([targetCourseId]);
    expect(targetChapter).toBeDefined();
    expect(targetChapter?.id).not.toBe(sourceChapterId);
    expect(targetLesson).toMatchObject({
      chapterId: targetChapter?.id,
      type: "live_training",
    });
    expect(targetLesson?.id).not.toBe(sourceLessonId);
    expect(liveLesson).toMatchObject({
      lessonId: targetLesson?.id,
      liveTrainingId: training?.id,
      liveTrainingLinkId: trainingLink?.id,
      language: "en",
    });
    expect(training).toMatchObject({
      authorId: actor.userId,
      status: LIVE_TRAINING_STATUSES.SCHEDULED,
      metadata: {
        importedFrom: "native-archive-e2e",
        nativeArchiveReviewRequired: true,
      },
    });
    expect(event).toMatchObject({
      title: { en: "Archive live training event" },
      organizerUserId: null,
      timezone: "Europe/Warsaw",
    });
    expect(trainingLink).toMatchObject({
      entityType: LIVE_TRAINING_LINK_ENTITY_TYPES.COURSE,
      entityId: targetCourseId,
    });
    expect(materialLink).toMatchObject({
      entityType: ENTITY_TYPES.LIVE_TRAINING,
      relationshipType: LIVE_TRAINING_RESOURCE_RELATIONSHIP_TYPES.BEFORE,
    });
    expect(material).toMatchObject({
      uploadedBy: actor.userId,
      reference: "https://assets.example.test/pre-training-handout.pdf",
      title: { en: "Pre-training handout" },
    });
  });

  it("imports a learning path, maps course links, and treats repeat import as idempotent", async () => {
    const input = createNativeArchiveImportInput(
      NATIVE_ARCHIVE_KIND.LEARNING_PATH,
      [
        createNativeArchiveCourseSnapshot(COURSE_ID),
        createNativeArchiveCourseSnapshot(SECOND_COURSE_ID),
      ],
      createNativeArchiveLearningPathSnapshot([COURSE_ID, SECOND_COURSE_ID]),
    );
    const zipPath = await writeNativeArchiveZip(input, temporaryDirectory);

    const firstResult = await importArchive(zipPath);
    const targetPathId = uuidv5(`native-archive:${PATH_ID}`, actor.tenantId);
    const targetCourseIds = [COURSE_ID, SECOND_COURSE_ID].map((id) =>
      uuidv5(`native-archive:${id}`, actor.tenantId),
    );
    const [savedPath] = await db
      .select()
      .from(learningPaths)
      .where(eq(learningPaths.id, targetPathId));
    const savedLinks = await db
      .select()
      .from(learningPathCourses)
      .where(eq(learningPathCourses.learningPathId, targetPathId));

    expect(firstResult).toMatchObject({
      kind: NATIVE_ARCHIVE_KIND.LEARNING_PATH,
      rootId: targetPathId,
      alreadyExists: false,
      createdCourseIds: targetCourseIds,
    });
    expect(targetPathId).not.toBe(PATH_ID);
    expect(savedPath).toMatchObject({
      id: targetPathId,
      originalId: PATH_ID,
      tenantId: actor.tenantId,
    });
    expect(savedLinks.map(({ courseId, displayOrder }) => ({ courseId, displayOrder }))).toEqual([
      { courseId: targetCourseIds[0], displayOrder: 0 },
      { courseId: targetCourseIds[1], displayOrder: 1 },
    ]);

    const repeatedResult = await importArchive(zipPath);
    expect(repeatedResult).toMatchObject({
      rootId: targetPathId,
      alreadyExists: true,
      createdCourseIds: [],
    });
    expect(
      await db.select().from(learningPaths).where(eq(learningPaths.id, targetPathId)),
    ).toHaveLength(1);
  });

  it("reuses an existing imported course in a new learning path", async () => {
    const sourceCourse = createNativeArchiveCourseSnapshot(REUSE_COURSE_ID);
    const existingTargetId = uuidv5(`native-archive:${REUSE_COURSE_ID}`, actor.tenantId);
    await createCourseFactory(db).create({
      id: existingTargetId,
      originalId: REUSE_COURSE_ID,
      title: "Previously imported course",
      description: "Existing imported course for reuse coverage",
      authorId: actor.userId,
      status: "draft",
      priceInCents: 0,
      currency: "usd",
    });

    const zipPath = await writeNativeArchiveZip(
      createNativeArchiveImportInput(
        NATIVE_ARCHIVE_KIND.LEARNING_PATH,
        [sourceCourse],
        createNativeArchiveLearningPathSnapshot([REUSE_COURSE_ID], REUSE_PATH_ID),
      ),
      temporaryDirectory,
    );
    const result = await importArchive(zipPath);
    const targetPathId = uuidv5(`native-archive:${REUSE_PATH_ID}`, actor.tenantId);
    const [link] = await db
      .select()
      .from(learningPathCourses)
      .where(
        and(
          eq(learningPathCourses.learningPathId, targetPathId),
          eq(learningPathCourses.courseId, existingTargetId),
        ),
      );

    expect(result).toMatchObject({
      rootId: targetPathId,
      createdCourseIds: [],
      reusedCourseIds: [existingTargetId],
    });
    expect(link).toMatchObject({
      learningPathId: targetPathId,
      courseId: existingTargetId,
      displayOrder: 0,
    });
  });

  it("rejects import when the actor lacks course creation permission", async () => {
    const student = await createUserFactory(db)
      .withUserSettings(db)
      .create({ role: SYSTEM_ROLE_SLUGS.STUDENT });
    const zipPath = await writeNativeArchiveZip(
      createNativeArchiveImportInput(NATIVE_ARCHIVE_KIND.COURSE, [
        createNativeArchiveCourseSnapshot(COURSE_ID),
      ]),
      temporaryDirectory,
    );

    await expect(
      importArchive(zipPath, { userId: student.id, tenantId: actor.tenantId } as CurrentUserType),
    ).rejects.toThrow("nativeArchive.error.createAccessRequired");
  });

  it("rejects a malformed course snapshot before creating destination rows", async () => {
    const malformedSnapshot = createNativeArchiveCourseSnapshot(INVALID_COURSE_ID);
    delete (malformedSnapshot.course as Partial<typeof malformedSnapshot.course>).title;
    const zipPath = await writeNativeArchiveZip(
      createNativeArchiveImportInput(NATIVE_ARCHIVE_KIND.COURSE, [malformedSnapshot]),
      temporaryDirectory,
    );

    await expect(importArchive(zipPath)).rejects.toThrow(
      "nativeArchive.error.invalidCourseSnapshot",
    );
    const destinationId = uuidv5(`native-archive:${INVALID_COURSE_ID}`, actor.tenantId);
    expect(await db.select().from(courses).where(eq(courses.id, destinationId))).toHaveLength(0);
  });
});
