import "reflect-metadata";

import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import dotenv from "dotenv";
import { eq, isNotNull, isNull, sql } from "drizzle-orm";

import database from "src/common/configuration/database";
import s3Config from "src/common/configuration/s3";
import { IMAGE_VARIANT_CONTENT_TYPE } from "src/file/image-variants/image-variant.constants";
import { ImageVariantService } from "src/file/image-variants/image-variant.service";
import {
  getAllImageVariantKeys,
  isImageVariantReference,
  isSupportedImageVariantMimeType,
} from "src/file/image-variants/image-variant.utils";
import { S3Module } from "src/s3/s3.module";
import { S3Service } from "src/s3/s3.service";
import { DbModule } from "src/storage/db/db.module";
import { DB_ADMIN } from "src/storage/db/db.providers";
import {
  aiMentorLessons,
  courses,
  learningPaths,
  questions,
  resources,
  settings,
  users,
} from "src/storage/schema";

import {
  getMimeTypeSkipReason,
  getReferenceSkipReason,
  getResourceFolderFromReference,
  hasAllVariantKeys,
  selectBestExistingVariantSourceKey,
} from "./migrateImageVariants.helpers";

import type { DatabasePg, UUIDType } from "src/common";
import type { ImageVariantMetadata } from "src/file/image-variants/image-variant.types";

dotenv.config({ path: ".env" });

@Module({
  imports: [
    ConfigModule.forRoot({
      load: [database, s3Config],
      isGlobal: true,
    }),
    DbModule,
    S3Module,
  ],
  providers: [ImageVariantService],
})
class ImageVariantMigrationModule {}

type MigrationStats = {
  candidates: number;
  inspected: number;
  updated: number;
  repaired: number;
  alreadyComplete: number;
  skipped: number;
  failed: number;
};

type ReferenceCandidate = {
  label: string;
  id: UUIDType;
  tenantId: UUIDType | null;
  reference: string | null;
  contentType?: string | null;
  update: (params: {
    db: DatabasePg;
    reference: string;
    contentType: string;
    metadata: ImageVariantMetadata;
  }) => Promise<void>;
};

const createInitialStats = (): MigrationStats => ({
  candidates: 0,
  inspected: 0,
  updated: 0,
  repaired: 0,
  alreadyComplete: 0,
  skipped: 0,
  failed: 0,
});

const updateJsonbTextField = (fieldName: string, nextReference: string) =>
  sql`jsonb_set(settings, ${`{${fieldName}}`}::text[], to_jsonb(${nextReference}::text), true)`;

const withImageVariantMetadata = (metadata: ImageVariantMetadata) =>
  sql`jsonb_set(coalesce(${resources.metadata}, '{}'::jsonb), '{imageVariants}', ${JSON.stringify(
    metadata,
  )}::jsonb, true)`;

async function collectReferenceCandidates(db: DatabasePg): Promise<ReferenceCandidate[]> {
  const [
    userRows,
    courseRows,
    aiMentorRows,
    questionRows,
    resourceRows,
    learningPathRows,
    globalSettingsRows,
  ] = await Promise.all([
    db
      .select({
        id: users.id,
        tenantId: users.tenantId,
        reference: users.avatarReference,
      })
      .from(users)
      .where(isNotNull(users.avatarReference)),
    db
      .select({
        id: courses.id,
        tenantId: courses.tenantId,
        thumbnailS3Key: courses.thumbnailS3Key,
        certificateSignature: sql<string | null>`${courses.settings}->>'certificateSignature'`,
      })
      .from(courses),
    db
      .select({
        id: aiMentorLessons.id,
        tenantId: aiMentorLessons.tenantId,
        reference: aiMentorLessons.avatarReference,
      })
      .from(aiMentorLessons)
      .where(isNotNull(aiMentorLessons.avatarReference)),
    db
      .select({
        id: questions.id,
        tenantId: questions.tenantId,
        reference: questions.photoS3Key,
      })
      .from(questions)
      .where(isNotNull(questions.photoS3Key)),
    db
      .select({
        id: resources.id,
        tenantId: resources.tenantId,
        reference: resources.reference,
        contentType: resources.contentType,
      })
      .from(resources),
    db
      .select({
        id: learningPaths.id,
        tenantId: learningPaths.tenantId,
        thumbnailReference: learningPaths.thumbnailReference,
        certificateSignature: sql<
          string | null
        >`${learningPaths.settings}->>'certificateSignature'`,
      })
      .from(learningPaths),
    db
      .select({
        id: settings.id,
        tenantId: settings.tenantId,
        certificateBackgroundImage: sql<
          string | null
        >`${settings.settings}->>'certificateBackgroundImage'`,
        platformLogoS3Key: sql<string | null>`${settings.settings}->>'platformLogoS3Key'`,
        platformSimpleLogoS3Key: sql<
          string | null
        >`${settings.settings}->>'platformSimpleLogoS3Key'`,
        loginBackgroundImageS3Key: sql<
          string | null
        >`${settings.settings}->>'loginBackgroundImageS3Key'`,
      })
      .from(settings)
      .where(isNull(settings.userId)),
  ]);

  return [
    ...userRows.map(
      (row): ReferenceCandidate => ({
        label: "users.avatarReference",
        id: row.id,
        tenantId: row.tenantId,
        reference: row.reference,
        update: async ({ db, reference }) => {
          await db.update(users).set({ avatarReference: reference }).where(eq(users.id, row.id));
        },
      }),
    ),
    ...courseRows.flatMap((row): ReferenceCandidate[] => [
      {
        label: "courses.thumbnailS3Key",
        id: row.id,
        tenantId: row.tenantId,
        reference: row.thumbnailS3Key,
        update: async ({ db, reference }) => {
          await db.update(courses).set({ thumbnailS3Key: reference }).where(eq(courses.id, row.id));
        },
      },
      {
        label: "courses.settings.certificateSignature",
        id: row.id,
        tenantId: row.tenantId,
        reference: row.certificateSignature,
        update: async ({ db, reference }) => {
          await db
            .update(courses)
            .set({ settings: updateJsonbTextField("certificateSignature", reference) })
            .where(eq(courses.id, row.id));
        },
      },
    ]),
    ...aiMentorRows.map(
      (row): ReferenceCandidate => ({
        label: "aiMentorLessons.avatarReference",
        id: row.id,
        tenantId: row.tenantId,
        reference: row.reference,
        update: async ({ db, reference }) => {
          await db
            .update(aiMentorLessons)
            .set({ avatarReference: reference })
            .where(eq(aiMentorLessons.id, row.id));
        },
      }),
    ),
    ...questionRows.map(
      (row): ReferenceCandidate => ({
        label: "questions.photoS3Key",
        id: row.id,
        tenantId: row.tenantId,
        reference: row.reference,
        update: async ({ db, reference }) => {
          await db.update(questions).set({ photoS3Key: reference }).where(eq(questions.id, row.id));
        },
      }),
    ),
    ...resourceRows.map(
      (row): ReferenceCandidate => ({
        label: "resources.reference",
        id: row.id,
        tenantId: row.tenantId,
        reference: row.reference,
        contentType: row.contentType,
        update: async ({ db, reference, contentType, metadata }) => {
          await db
            .update(resources)
            .set({
              reference,
              contentType,
              metadata: withImageVariantMetadata(metadata),
            })
            .where(eq(resources.id, row.id));
        },
      }),
    ),
    ...learningPathRows.flatMap((row): ReferenceCandidate[] => [
      {
        label: "learningPaths.thumbnailReference",
        id: row.id,
        tenantId: row.tenantId,
        reference: row.thumbnailReference,
        update: async ({ db, reference }) => {
          await db
            .update(learningPaths)
            .set({ thumbnailReference: reference })
            .where(eq(learningPaths.id, row.id));
        },
      },
      {
        label: "learningPaths.settings.certificateSignature",
        id: row.id,
        tenantId: row.tenantId,
        reference: row.certificateSignature,
        update: async ({ db, reference }) => {
          await db
            .update(learningPaths)
            .set({ settings: updateJsonbTextField("certificateSignature", reference) })
            .where(eq(learningPaths.id, row.id));
        },
      },
    ]),
    ...globalSettingsRows.flatMap((row): ReferenceCandidate[] => {
      const settingsFields: { label: string; fieldName: string; reference: string | null }[] = [
        {
          label: "settings.certificateBackgroundImage",
          fieldName: "certificateBackgroundImage",
          reference: row.certificateBackgroundImage,
        },
        {
          label: "settings.platformLogoS3Key",
          fieldName: "platformLogoS3Key",
          reference: row.platformLogoS3Key,
        },
        {
          label: "settings.platformSimpleLogoS3Key",
          fieldName: "platformSimpleLogoS3Key",
          reference: row.platformSimpleLogoS3Key,
        },
        {
          label: "settings.loginBackgroundImageS3Key",
          fieldName: "loginBackgroundImageS3Key",
          reference: row.loginBackgroundImageS3Key,
        },
      ];

      return settingsFields.map(({ label, fieldName, reference }) => ({
        label,
        id: row.id,
        tenantId: row.tenantId,
        reference,
        update: async ({ db, reference: nextReference }) => {
          await db
            .update(settings)
            .set({ settings: updateJsonbTextField(fieldName, nextReference) })
            .where(eq(settings.id, row.id));
        },
      }));
    }),
  ];
}

async function getExistingVariantKeys(s3Service: S3Service, reference: string) {
  const entries = await Promise.all(
    getAllImageVariantKeys(reference).map(
      async (key) => [key, await s3Service.getFileExists(key)] as const,
    ),
  );

  return new Set(entries.filter(([, exists]) => exists).map(([key]) => key));
}

async function resolveContentType(params: {
  candidate: ReferenceCandidate;
  s3Service: S3Service;
  sourceKey: string;
}) {
  if (params.candidate.contentType) return params.candidate.contentType;
  return await params.s3Service.getFileContentType(params.sourceKey);
}

async function repairExistingVariantReference(params: {
  candidate: ReferenceCandidate;
  db: DatabasePg;
  s3Service: S3Service;
  imageVariantService: ImageVariantService;
  stats: MigrationStats;
}) {
  const existingKeys = await getExistingVariantKeys(params.s3Service, params.candidate.reference!);

  if (hasAllVariantKeys(params.candidate.reference!, existingKeys)) {
    params.stats.alreadyComplete += 1;
    return;
  }

  const sourceKey = selectBestExistingVariantSourceKey(params.candidate.reference!, existingKeys);
  if (!sourceKey) {
    params.stats.skipped += 1;
    console.warn(`[skip:missing-source] ${params.candidate.label} ${params.candidate.id}`);
    return;
  }

  const buffer = await params.s3Service.getFileBuffer(sourceKey);
  const result = await params.imageVariantService.createVariantsForReference({
    buffer,
    referenceKey: params.candidate.reference!,
    mimeType: IMAGE_VARIANT_CONTENT_TYPE,
  });

  if (!result) {
    params.stats.skipped += 1;
    return;
  }

  await params.candidate.update({
    db: params.db,
    reference: result.referenceKey,
    contentType: result.contentType,
    metadata: result.metadata,
  });
  params.stats.repaired += 1;
}

async function migrateOriginalReference(params: {
  candidate: ReferenceCandidate;
  db: DatabasePg;
  s3Service: S3Service;
  imageVariantService: ImageVariantService;
  stats: MigrationStats;
}) {
  const reference = params.candidate.reference!;
  const sourceExists = await params.s3Service.getFileExists(reference);

  if (!sourceExists) {
    params.stats.skipped += 1;
    console.warn(`[skip:missing-source] ${params.candidate.label} ${params.candidate.id}`);
    return;
  }

  const contentType = await resolveContentType({
    candidate: params.candidate,
    s3Service: params.s3Service,
    sourceKey: reference,
  });

  const mimeSkipReason = getMimeTypeSkipReason(contentType);
  if (mimeSkipReason || !contentType || !isSupportedImageVariantMimeType(contentType)) {
    params.stats.skipped += 1;
    console.warn(
      `[skip:${mimeSkipReason ?? "missing_content_type"}] ${params.candidate.label} ${
        params.candidate.id
      }`,
    );
    return;
  }

  const buffer = await params.s3Service.getFileBuffer(reference);
  const result = await params.imageVariantService.createVariants({
    buffer,
    resource: getResourceFolderFromReference(reference, params.candidate.tenantId!),
    mimeType: contentType,
    tenantId: params.candidate.tenantId!,
  });

  if (!result) {
    params.stats.skipped += 1;
    return;
  }

  await params.candidate.update({
    db: params.db,
    reference: result.referenceKey,
    contentType: result.contentType,
    metadata: result.metadata,
  });
  params.stats.updated += 1;
}

async function processCandidate(params: {
  candidate: ReferenceCandidate;
  db: DatabasePg;
  s3Service: S3Service;
  imageVariantService: ImageVariantService;
  stats: MigrationStats;
}) {
  const skipReason = getReferenceSkipReason(params.candidate.reference);
  if (skipReason) {
    params.stats.skipped += 1;
    return;
  }

  if (!params.candidate.tenantId) {
    params.stats.skipped += 1;
    console.warn(`[skip:missing-tenant] ${params.candidate.label} ${params.candidate.id}`);
    return;
  }

  params.stats.inspected += 1;

  try {
    if (isImageVariantReference(params.candidate.reference!)) {
      await repairExistingVariantReference(params);
      return;
    }

    await migrateOriginalReference(params);
  } catch (error) {
    params.stats.failed += 1;
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[failed] ${params.candidate.label} ${params.candidate.id}: ${message}`);
  }
}

async function runMigration() {
  const app = await NestFactory.createApplicationContext(ImageVariantMigrationModule, {
    logger: ["error", "warn", "log"],
  });

  try {
    const db = app.get<DatabasePg>(DB_ADMIN);
    const s3Service = app.get(S3Service);
    const imageVariantService = app.get(ImageVariantService);
    const stats = createInitialStats();
    const candidates = await collectReferenceCandidates(db);
    stats.candidates = candidates.length;

    for (const candidate of candidates) {
      await processCandidate({ candidate, db, s3Service, imageVariantService, stats });
    }

    console.log("Image variant migration finished", stats);
  } finally {
    await app.close();
  }
}

runMigration()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
