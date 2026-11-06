import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { Readable } from "node:stream";

import { SYSTEM_ROLE_SLUGS } from "@repo/shared";
import { eq } from "drizzle-orm";
import { v5 as uuidv5 } from "uuid";

import { DB } from "src/storage/db/db.providers";
import { chapters, lessons } from "src/storage/schema";

import { createE2ETest } from "../../../../test/create-e2e-test";
import { createUserFactory } from "../../../../test/factory/user.factory";
import { NATIVE_ARCHIVE_IMPORT_MODES, NATIVE_ARCHIVE_KIND } from "../../native-archive.constants";
import { NativeArchiveImportService } from "../native-archive-import.service";

import { LESSON_HANDOUT } from "./native-archive-asset-reuse.scenarios";
import {
  createInMemoryNativeArchiveStorage,
  createNativeArchiveCourseSnapshot,
  writeNativeArchiveZip,
} from "./native-archive-import.e2e-utils";

import type { INestApplication } from "@nestjs/common";
import type { DatabasePg } from "src/common";
import type { CurrentUserType } from "src/common/types/current-user.type";

describe("Native archive asset reuse (e2e)", () => {
  let app: INestApplication;
  let db: DatabasePg;
  let importer: NativeArchiveImportService;
  let actor: CurrentUserType;
  let temporaryDirectory: string;
  let runAsTenant: <T>(tenantId: string, fn: () => Promise<T>) => Promise<T>;
  const storage = createInMemoryNativeArchiveStorage();

  beforeAll(async () => {
    const testContext = await createE2ETest([storage.provider]);
    app = testContext.app;
    db = app.get(DB);
    importer = app.get(NativeArchiveImportService);
    runAsTenant = testContext.runAsTenant;
    temporaryDirectory = await mkdtemp(path.join(tmpdir(), "native-archive-asset-reuse-e2e-"));

    const user = await createUserFactory(db)
      .withAdminSettings(db)
      .create({ role: SYSTEM_ROLE_SLUGS.ADMIN });
    actor = { userId: user.id, tenantId: testContext.defaultTenantId } as CurrentUserType;
  });

  afterAll(async () => {
    await rm(temporaryDirectory, { recursive: true, force: true });
    await app.close();
  });

  const writeCourseArchiveWithHandout = (sourceCourseId: string) => {
    const courseSnapshot = createNativeArchiveCourseSnapshot(sourceCourseId, { withContent: true });
    const snapshot = {
      ...courseSnapshot,
      lessons: courseSnapshot.lessons.map((lesson) => ({
        ...lesson,
        fileS3Key: LESSON_HANDOUT.sourceReference,
      })),
    };

    return writeNativeArchiveZip(
      {
        kind: NATIVE_ARCHIVE_KIND.COURSE,
        rootId: snapshot.course.id,
        courses: { [snapshot.course.id]: snapshot },
        files: [
          {
            path: LESSON_HANDOUT.sourceReference,
            sourceReference: LESSON_HANDOUT.sourceReference,
            contentType: LESSON_HANDOUT.contentType,
            open: async () => Readable.from([Buffer.from(LESSON_HANDOUT.content)]),
          },
        ],
      },
      temporaryDirectory,
    );
  };

  const syncArchive = (zipPath: string) =>
    runAsTenant(actor.tenantId, () =>
      importer.importArchive(zipPath, actor, NATIVE_ARCHIVE_IMPORT_MODES.SYNC),
    );

  const findImportedLessonFile = async (sourceCourseId: string) => {
    const targetCourseId = uuidv5(`native-archive:${sourceCourseId}`, actor.tenantId);
    const [lesson] = await runAsTenant(actor.tenantId, () =>
      db
        .select({ fileS3Key: lessons.fileS3Key })
        .from(lessons)
        .innerJoin(chapters, eq(chapters.id, lessons.chapterId))
        .where(eq(chapters.courseId, targetCourseId)),
    );

    return lesson?.fileS3Key;
  };

  const countStoredFiles = () => ({
    uploads: storage.uploadedKeys.length,
    copies: storage.copiedKeys.length,
  });

  it("stores an unchanged file once when a shared course is synced again", async () => {
    const sourceCourseId = randomUUID();
    const zipPath = await writeCourseArchiveWithHandout(sourceCourseId);

    await syncArchive(zipPath);
    const afterFirstSync = countStoredFiles();
    const lessonFileAfterFirstSync = await findImportedLessonFile(sourceCourseId);
    await syncArchive(zipPath);

    expect(storage.uploadedKeys).toEqual([
      expect.stringMatching(new RegExp(`^${actor.tenantId}/native-archive/assets/`)),
    ]);
    expect(afterFirstSync).toEqual({ uploads: 1, copies: 1 });
    expect(countStoredFiles()).toEqual(afterFirstSync);
    expect(storage.getBytes(storage.copiedKeys[0]!.targetKey)?.toString()).toBe(
      LESSON_HANDOUT.content,
    );
    expect(await findImportedLessonFile(sourceCourseId)).toBe(lessonFileAfterFirstSync);
    expect(lessonFileAfterFirstSync).toBe(storage.copiedKeys[0]!.targetKey);
  });
});
