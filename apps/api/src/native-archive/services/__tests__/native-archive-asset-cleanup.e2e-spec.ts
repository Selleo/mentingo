import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { SYSTEM_ROLE_SLUGS } from "@repo/shared";
import { and, eq } from "drizzle-orm";
import { v5 as uuidv5 } from "uuid";

import { NativeArchiveImportService } from "src/native-archive/services/native-archive-import.service";
import { DB } from "src/storage/db/db.providers";
import { courses, resources } from "src/storage/schema";

import { createE2ETest } from "../../../../test/create-e2e-test";
import { createUserFactory } from "../../../../test/factory/user.factory";

import {
  createNativeArchiveAssetImportStorage,
  createNativeArchiveWithThumbnailAndAttachment,
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

describe("Native archive asset staging cleanup (e2e)", () => {
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
    temporaryDirectory = await mkdtemp(path.join(tmpdir(), "native-archive-asset-cleanup-e2e-"));

    const user = await createUserFactory(db)
      .withCredentials({ password: "Native-archive-cleanup-e2e-password1!" })
      .withAdminSettings(db)
      .create({ role: SYSTEM_ROLE_SLUGS.ADMIN });
    actor = { userId: user.id, tenantId } as CurrentUserType;
  }, 30000);

  afterAll(async () => {
    await rm(temporaryDirectory, { recursive: true, force: true });
    await app.close();
  });

  it("cleans staged image resources and variants when a later asset upload fails", async () => {
    const fixture = await createNativeArchiveWithThumbnailAndAttachment(temporaryDirectory);
    storage.s3ServiceMock.uploadStreamMultipart.mockRejectedValueOnce(
      new Error("simulated attachment storage failure"),
    );

    await expect(
      runAsTenant(actor.tenantId, () => importer.importArchive(fixture.zipPath, actor)),
    ).rejects.toThrow("simulated attachment storage failure");

    const targetCourseId = uuidv5(`native-archive:${fixture.sourceCourseId}`, tenantId);
    const importedCourses = await db.select().from(courses).where(eq(courses.id, targetCourseId));
    expect(importedCourses).toHaveLength(0);

    const stagedResources = await db
      .select()
      .from(resources)
      .where(eq(resources.uploadedBy, actor.userId));
    expect(stagedResources).toHaveLength(1);
    expect(stagedResources[0]).toMatchObject({ archived: true, visibility: "private" });

    const uploadedVariantKeys = storage.uploadedKeys.filter((key) => key.includes("/variants/"));
    expect(uploadedVariantKeys.length).toBeGreaterThan(0);
    expect(storage.s3ServiceMock.deleteFile).toHaveBeenCalledWith(
      expect.stringMatching(new RegExp(`^${tenantId}/course/native-archive/variants/`)),
    );
    expect(storage.objects.size).toBe(0);
    expect(storage.s3ServiceMock.uploadStreamMultipart).toHaveBeenCalledTimes(1);
    expect(storage.s3ServiceMock.copyFile).not.toHaveBeenCalled();

    const [activeResource] = await db
      .select()
      .from(resources)
      .where(and(eq(resources.uploadedBy, actor.userId), eq(resources.archived, false)));
    expect(activeResource).toBeUndefined();
  });
});
