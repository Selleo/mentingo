import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { SYSTEM_ROLE_SLUGS } from "@repo/shared";
import { and, eq } from "drizzle-orm";
import { v5 as uuidv5 } from "uuid";

import { DB } from "src/storage/db/db.providers";
import { chapters, courses, lessons, scormPackages, scormScos } from "src/storage/schema";

import { createE2ETest } from "../../../../test/create-e2e-test";
import { createUserFactory } from "../../../../test/factory/user.factory";
import { SCORM_MASTER_COURSE_PACKAGE_UUID_NAMESPACE } from "../../../courses/master-course-scorm.constants";
import { NativeArchiveImportService } from "../native-archive-import.service";

import {
  createInMemoryNativeArchiveStorage,
  createNativeArchiveScormFixture,
  writeNativeArchiveZip,
} from "./native-archive-import.e2e-utils";

import type { INestApplication } from "@nestjs/common";
import type { DatabasePg } from "src/common";
import type { CurrentUserType } from "src/common/types/current-user.type";

describe("Native archive SCORM import (e2e)", () => {
  let app: INestApplication;
  let db: DatabasePg;
  let importer: NativeArchiveImportService;
  let actor: CurrentUserType;
  let runAsTenant: <T>(tenantId: string, fn: () => Promise<T>) => Promise<T>;
  let temporaryDirectory: string;
  const storage = createInMemoryNativeArchiveStorage();

  beforeAll(async () => {
    const testContext = await createE2ETest([storage.provider]);
    app = testContext.app;
    db = app.get(DB);
    importer = app.get(NativeArchiveImportService);
    runAsTenant = testContext.runAsTenant;
    temporaryDirectory = await mkdtemp(path.join(tmpdir(), "native-archive-scorm-import-e2e-"));

    const user = await createUserFactory(db)
      .withAdminSettings(db)
      .create({ role: SYSTEM_ROLE_SLUGS.ADMIN });
    actor = { userId: user.id, tenantId: testContext.defaultTenantId } as CurrentUserType;
  });

  afterAll(async () => {
    await rm(temporaryDirectory, { recursive: true, force: true });
    await app.close();
  });

  it("maps the SCORM package and SCO to destination rows and copies package assets", async () => {
    const fixture = createNativeArchiveScormFixture();
    const zipPath = await writeNativeArchiveZip(fixture.input, temporaryDirectory);
    const targetCourseId = uuidv5(`native-archive:${fixture.sourceCourseId}`, actor.tenantId);

    const result = await runAsTenant(actor.tenantId, () => importer.importArchive(zipPath, actor));
    const [targetCourse] = await db.select().from(courses).where(eq(courses.id, targetCourseId));
    const [targetChapter] = await db
      .select()
      .from(chapters)
      .where(eq(chapters.courseId, targetCourseId));
    const [targetLesson] = targetChapter
      ? await db.select().from(lessons).where(eq(lessons.chapterId, targetChapter.id))
      : [];
    const [targetPackage] = targetLesson
      ? await db
          .select()
          .from(scormPackages)
          .where(
            and(
              eq(scormPackages.entityId, targetLesson.id),
              eq(scormPackages.entityType, "lesson"),
            ),
          )
      : [];
    const [targetSco] = targetPackage
      ? await db.select().from(scormScos).where(eq(scormScos.packageId, targetPackage.id))
      : [];
    const expectedPackageId = uuidv5(
      `master-course:${targetCourseId}:scorm-package:${fixture.sourcePackageId}`,
      SCORM_MASTER_COURSE_PACKAGE_UUID_NAMESPACE,
    );

    expect(result.createdCourseIds).toEqual([targetCourseId]);
    expect(targetCourse).toMatchObject({
      id: targetCourseId,
      originalId: fixture.sourceCourseId,
    });
    expect(targetLesson).toMatchObject({
      id: expect.any(String),
      chapterId: targetChapter?.id,
      type: "scorm",
      title: { en: "Archive SCORM lesson" },
    });
    expect(targetLesson?.id).not.toBe(fixture.sourceLessonId);
    expect(targetPackage).toMatchObject({
      id: expectedPackageId,
      entityType: "lesson",
      entityId: targetLesson?.id,
      status: "ready",
    });
    expect(targetPackage?.id).not.toBe(fixture.sourcePackageId);
    expect(targetPackage?.originalFileReference).toContain(
      `/scorm/packages/${expectedPackageId}/original/`,
    );
    expect(targetPackage?.extractedFilesReference).toContain(
      `/scorm/packages/${expectedPackageId}/extracted`,
    );
    expect(targetPackage?.manifestEntryPoint).toBe(
      `${targetPackage?.extractedFilesReference}/index.html`,
    );
    expect(targetSco).toMatchObject({
      packageId: expectedPackageId,
      lessonId: targetLesson?.id,
      identifier: "ITEM-1",
      launchPath: `${targetPackage?.extractedFilesReference}/index.html`,
    });
    expect(storage.getBytes(targetPackage!.originalFileReference)).toEqual(
      fixture.originalPackageBytes,
    );
    expect(storage.getBytes(`${targetPackage!.extractedFilesReference}/index.html`)).toEqual(
      fixture.extractedFileBytes,
    );
    expect(storage.copiedKeys).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ targetKey: targetPackage?.originalFileReference }),
        expect.objectContaining({
          targetKey: `${targetPackage?.extractedFilesReference}/index.html`,
        }),
      ]),
    );
    expect(storage.has(fixture.snapshot.scormPackages[0]!.originalFileReference)).toBe(false);
  });
});
