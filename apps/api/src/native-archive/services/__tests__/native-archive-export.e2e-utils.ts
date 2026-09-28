import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { Readable } from "node:stream";

import { faker } from "@faker-js/faker";
import {
  SCORM_PACKAGE_ENTITY_TYPE,
  SCORM_PACKAGE_STATUS,
  SCORM_STANDARD,
  SYSTEM_ROLE_SLUGS,
} from "@repo/shared";
import request from "supertest";

import { buildJsonbField } from "src/common/helpers/sqlHelpers";
import { S3Service } from "src/s3/s3.service";
import { lessons, scormPackages, scormScos, tenants } from "src/storage/schema";

import { cookieFor } from "../../../../test/helpers/test-helpers";
import { readNativeArchive } from "../native-archive-zip.service";

import type { createChapterFactory } from "../../../../test/factory/chapter.factory";
import type { createUserFactory } from "../../../../test/factory/user.factory";
import type { NativeArchiveJobStatus } from "../../native-archive.types";
import type { INestApplication } from "@nestjs/common";
import type { DatabasePg } from "src/common";
import type { Response as SupertestResponse } from "supertest";

export const NATIVE_ARCHIVE_E2E_PASSWORD = "Archive-export-e2e-password1!";

type NativeArchiveTestUserOptions = {
  app: INestApplication;
  db: DatabasePg;
  tenantId: string;
  runAsTenant: <T>(tenantId: string, fn: () => Promise<T>) => Promise<T>;
  userFactory: ReturnType<typeof createUserFactory>;
  role?: "admin" | "student";
  emailPrefix?: string;
  referer?: string;
};

export async function createNativeArchiveTestUser({
  app,
  db,
  tenantId,
  runAsTenant,
  userFactory,
  role = "admin",
  emailPrefix = "archive-admin",
  referer,
}: NativeArchiveTestUserOptions) {
  const user = await runAsTenant(tenantId, async () => {
    const builder = userFactory.withCredentials({ password: NATIVE_ARCHIVE_E2E_PASSWORD });
    if (role === "student") {
      return builder.withUserSettings(db).create({
        email: `${emailPrefix}-${faker.string.alphanumeric(8)}@example.com`,
        tenantId,
      });
    }

    return builder.withAdminSettings(db).create({
      email: `${emailPrefix}-${faker.string.alphanumeric(8)}@example.com`,
      role: SYSTEM_ROLE_SLUGS.ADMIN,
      tenantId,
    });
  });

  return { user, cookie: await cookieFor(user, app, referer) };
}

export async function createNativeArchiveCourseContent({
  db,
  chapterFactory,
  courseId,
  authorId,
  assetReference,
  lessonType = "content",
}: {
  db: DatabasePg;
  chapterFactory: ReturnType<typeof createChapterFactory>;
  courseId: string;
  authorId: string;
  assetReference?: string;
  lessonType?: string;
}) {
  const chapterTitle = "Native archive export chapter";
  const lessonTitle = "Native archive export lesson";
  const chapter = await chapterFactory.create({
    courseId,
    authorId,
    title: chapterTitle,
    displayOrder: 0,
    lessonCount: 1,
  });
  const [lesson] = await db
    .insert(lessons)
    .values({
      id: faker.string.uuid(),
      chapterId: chapter.id,
      type: lessonType,
      title: buildJsonbField("en", lessonTitle),
      description: buildJsonbField("en", "Exported lesson body"),
      displayOrder: 0,
      fileS3Key: assetReference ?? null,
      fileType: assetReference ? "pdf" : null,
    })
    .returning({ id: lessons.id });

  return { chapterId: chapter.id, chapterTitle, lessonId: lesson.id, lessonTitle };
}

export async function createNativeArchiveScormPackage({
  db,
  lessonId,
}: {
  db: DatabasePg;
  lessonId: string;
}) {
  const packageId = faker.string.uuid();
  const originalFileReference = `native-archive-source/scorm/${packageId}/original.zip`;
  const extractedFilesReference = `native-archive-source/scorm/${packageId}/extracted`;
  const indexHtmlReference = `${extractedFilesReference}/index.html`;
  const runtimeScriptReference = `${extractedFilesReference}/scripts/runtime.js`;
  const originalBytes = Buffer.from("SCORM package ZIP fixture bytes");
  const indexHtmlBytes = Buffer.from("<!doctype html><title>Exported SCO</title>");
  const runtimeScriptBytes = Buffer.from("window.__SCORM_EXPORT_FIXTURE__ = true;");
  const manifestJson = {
    identifier: `MANIFEST-${packageId}`,
    version: "1.2",
    organizationIdentifier: "ORG-EXPORT",
    scos: [{ identifier: "ITEM-EXPORT", title: "Exported SCO", href: "index.html" }],
  };

  await db.insert(scormPackages).values({
    id: packageId,
    entityType: SCORM_PACKAGE_ENTITY_TYPE.LESSON,
    entityId: lessonId,
    language: "en",
    standard: SCORM_STANDARD.SCORM_1_2,
    originalFileReference,
    extractedFilesReference,
    manifestEntryPoint: indexHtmlReference,
    manifestJson,
    status: SCORM_PACKAGE_STATUS.READY,
  });
  await db.insert(scormScos).values({
    packageId,
    lessonId,
    organizationIdentifier: "ORG-EXPORT",
    identifier: "ITEM-EXPORT",
    identifierRef: "RESOURCE-EXPORT",
    resourceIdentifier: "RESOURCE-EXPORT",
    resourceType: "webcontent",
    scormType: "sco",
    title: "Exported SCO",
    href: "index.html",
    launchPath: indexHtmlReference,
    parameters: null,
    displayOrder: 0,
    parentIdentifier: null,
    isVisible: true,
    itemMetadataJson: { identifier: "ITEM-EXPORT", title: "Exported SCO" },
    resourceMetadataJson: {
      identifier: "RESOURCE-EXPORT",
      files: ["index.html", "scripts/runtime.js"],
      fileReferences: [indexHtmlReference, runtimeScriptReference],
    },
  });

  return {
    packageId,
    originalFileReference,
    originalBytes,
    extractedFilesReference,
    extractedFiles: [
      { reference: indexHtmlReference, bytes: indexHtmlBytes },
      { reference: runtimeScriptReference, bytes: runtimeScriptBytes },
    ],
    manifestJson,
  };
}

export function createNativeArchiveExportStorage() {
  const archives = new Map<string, Buffer>();
  const sourceAssets = new Map<string, Buffer>();
  const uploadedKeys: string[] = [];
  const s3ServiceMock = {
    isConfigured: jest.fn(() => true),
    uploadStreamMultipart: jest.fn(async (stream: Readable, key: string) => {
      const chunks: Buffer[] = [];
      for await (const chunk of stream) chunks.push(Buffer.from(chunk));
      archives.set(key, Buffer.concat(chunks));
      uploadedKeys.push(key);
    }),
    getFileStream: jest.fn(async (key: string) => {
      const buffer = sourceAssets.get(key) ?? archives.get(key);
      if (!buffer) throw new Error(`Missing test S3 object ${key}`);
      return { stream: Readable.from([buffer]), contentLength: buffer.length };
    }),
    listFileKeysByPrefix: jest.fn(async (prefix: string) =>
      [...sourceAssets.keys()].filter((key) => key.startsWith(prefix)),
    ),
    deleteFile: jest.fn(async () => undefined),
  };

  return {
    provider: { provide: S3Service, useValue: s3ServiceMock },
    uploadedKeys,
    addSourceAsset: (key: string, bytes: Buffer) => sourceAssets.set(key, bytes),
    clear: () => {
      archives.clear();
      sourceAssets.clear();
      uploadedKeys.length = 0;
    },
    readArchive: async (key: string) => {
      const bytes = archives.get(key);
      if (!bytes) throw new Error(`Worker did not upload ${key}`);

      return readNativeArchiveBytes(bytes);
    },
  };
}

export async function readNativeArchiveBytes(bytes: Buffer) {
  const directory = await mkdtemp(path.join(tmpdir(), "native-archive-export-e2e-"));
  const zipPath = path.join(directory, "archive.zip");
  try {
    await writeFile(zipPath, bytes);
    const parsed = await readNativeArchive(zipPath);
    try {
      const assetContents = new Map(
        await Promise.all(
          [...parsed.assetFiles].map(
            async ([archivePath, assetPath]) => [archivePath, await readFile(assetPath)] as const,
          ),
        ),
      );
      return {
        manifest: parsed.manifest,
        courses: parsed.courses,
        learningPath: parsed.learningPath,
        assetContents,
      };
    } finally {
      await parsed.cleanup();
    }
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

export async function waitForNativeArchiveJob(
  app: INestApplication,
  jobId: string,
  cookie: string | string[],
): Promise<NativeArchiveJobStatus> {
  const cookieHeader = Array.isArray(cookie) ? cookie.join("; ") : cookie;
  let latestStatus: NativeArchiveJobStatus | undefined;

  for (let attempt = 0; attempt < 80; attempt += 1) {
    const response = await request(app.getHttpServer())
      .get(`/api/native-archives/jobs/${jobId}`)
      .set("Cookie", cookieHeader)
      .expect(200);
    latestStatus = response.body.data as NativeArchiveJobStatus;

    if (latestStatus.state === "completed" || latestStatus.state === "failed") {
      return latestStatus;
    }

    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  throw new Error(
    `Timed out waiting for native archive job ${jobId}; last observed state: ${
      latestStatus?.state ?? "unavailable"
    }`,
  );
}

export async function downloadNativeArchive(
  app: INestApplication,
  jobId: string,
  cookie: string | string[],
): Promise<SupertestResponse> {
  const cookieHeader = Array.isArray(cookie) ? cookie.join("; ") : cookie;
  return request(app.getHttpServer())
    .get(`/api/native-archives/jobs/${jobId}/download`)
    .set("Cookie", cookieHeader)
    .timeout({ response: 10_000, deadline: 20_000 })
    .buffer(true)
    .parse((response, callback) => {
      const chunks: Buffer[] = [];
      response.on("data", (chunk: Buffer | string) =>
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)),
      );
      response.on("end", () => callback(null, Buffer.concat(chunks)));
      response.on("error", (error) => callback(error, undefined));
    })
    .expect(200);
}

export async function createNativeArchiveTestTenant(dbAdmin: DatabasePg) {
  const host = `https://archive-export-${faker.string.alphanumeric(8).toLowerCase()}.tenant.local`;
  const [tenant] = await dbAdmin
    .insert(tenants)
    .values({ name: "Native Archive Export Foreign Tenant", host })
    .returning({ id: tenants.id });

  return { id: tenant.id, host };
}
