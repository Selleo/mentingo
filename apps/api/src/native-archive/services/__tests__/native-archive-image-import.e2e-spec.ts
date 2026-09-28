import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { SYSTEM_ROLE_SLUGS } from "@repo/shared";
import { eq } from "drizzle-orm";
import { v5 as uuidv5 } from "uuid";

import { getAllImageVariantKeys } from "src/file/image-variants/image-variant.utils";
import { NativeArchiveImportService } from "src/native-archive/services/native-archive-import.service";
import { DB } from "src/storage/db/db.providers";
import { courses, resources } from "src/storage/schema";

import { createE2ETest } from "../../../../test/create-e2e-test";
import { createUserFactory } from "../../../../test/factory/user.factory";

import {
  createNativeArchiveAssetImportStorage,
  createNativeArchiveWithCourseThumbnail,
} from "./native-archive-image-import.e2e-utils";

import type { INestApplication } from "@nestjs/common";
import type { DatabasePg } from "src/common";
import type { CurrentUserType } from "src/common/types/current-user.type";

jest.mock("load-esm", () => ({
  loadEsm: jest.fn(async () => ({
    fileTypeFromBuffer: async (buffer: Buffer) => {
      if (buffer.subarray(0, 2).toString("utf8") === "PK") {
        return { mime: "application/zip", ext: "zip" };
      }
      if (buffer.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47]))) {
        return { mime: "image/png", ext: "png" };
      }
      return undefined;
    },
  })),
}));

describe("Native archive image asset import (e2e)", () => {
  let app: INestApplication;
  let db: DatabasePg;
  let tenantId: string;
  let importer: NativeArchiveImportService;
  let actor: CurrentUserType;
  let runAsTenant: <T>(tenantId: string, fn: () => Promise<T>) => Promise<T>;
  let temporaryDirectory: string;
  const storage = createNativeArchiveAssetImportStorage();

  beforeAll(async () => {
    const e2e = await createE2ETest([storage.provider]);
    app = e2e.app;
    db = app.get(DB);
    tenantId = e2e.defaultTenantId;
    runAsTenant = e2e.runAsTenant;
    importer = app.get(NativeArchiveImportService);
    temporaryDirectory = await mkdtemp(path.join(tmpdir(), "native-archive-image-import-e2e-"));

    const user = await createUserFactory(db)
      .withCredentials({ password: "Native-archive-image-e2e-password1!" })
      .withAdminSettings(db)
      .create({ role: SYSTEM_ROLE_SLUGS.ADMIN });
    actor = { userId: user.id, tenantId } as CurrentUserType;
  }, 30000);

  afterAll(async () => {
    await rm(temporaryDirectory, { recursive: true, force: true });
    await app.close();
  });

  it("uploads a referenced image through FileService and rewrites the imported course reference", async () => {
    const fixture = await createNativeArchiveWithCourseThumbnail(temporaryDirectory);
    const result = await runAsTenant(actor.tenantId, () =>
      importer.importArchive(fixture.zipPath, actor),
    );
    const targetCourseId = uuidv5(`native-archive:${fixture.sourceCourseId}`, tenantId);
    const [course] = await db.select().from(courses).where(eq(courses.id, targetCourseId));

    expect(result).toMatchObject({
      alreadyExists: false,
      createdCourseIds: [targetCourseId],
      rootId: targetCourseId,
    });
    expect(course).toBeDefined();
    if (!course) throw new Error("Imported course was not persisted");
    expect(course.thumbnailS3Key).not.toBe(fixture.sourceReference);
    const thumbnailReference = course.thumbnailS3Key;
    expect(thumbnailReference).toBeTruthy();
    if (!thumbnailReference) throw new Error("Imported course thumbnail reference is missing");

    const [resource] = await db
      .select()
      .from(resources)
      .where(eq(resources.uploadedBy, actor.userId));
    expect(resource).toMatchObject({
      reference: expect.stringContaining("/variants/"),
      contentType: "image/webp",
      title: { en: "course-cover.png" },
      visibility: "private",
      uploadedBy: actor.userId,
      tenantId,
    });
    expect(resource.metadata).toEqual(
      expect.objectContaining({
        originalFilename: "course-cover.png",
        size: fixture.imageBuffer.length,
        imageVariants: expect.any(Object),
      }),
    );

    const storedVariants = storage.uploadedKeys.filter((key) => key.includes("/variants/"));
    expect(storedVariants.length).toBeGreaterThan(0);
    expect(storage.s3ServiceMock.uploadFile).toHaveBeenCalled();
    const firstStoredVariant = storedVariants[0];
    expect(firstStoredVariant).toBeDefined();
    if (!firstStoredVariant) throw new Error("FileService did not upload image variants");
    expect(storage.getObject(firstStoredVariant)?.contentType).toBe("image/webp");
    expect(thumbnailReference).toContain("/variants/");
    const expectedVariantKeys = getAllImageVariantKeys(thumbnailReference);
    expect(storage.copiedKeys.length).toBeGreaterThan(0);
    expect(storage.copiedKeys.every((key) => expectedVariantKeys.includes(key))).toBe(true);
  });
});
