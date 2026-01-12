import { ALLOWED_PRESENTATION_FILE_TYPES, ALLOWED_VIDEO_FILE_TYPES } from "@repo/shared";
import dotenv from "dotenv";
import { and, eq, getTableColumns, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { match } from "ts-pattern";

import { LESSON_TYPES } from "src/lesson/lesson.type";
import { ENTITY_TYPE } from "src/localization/localization.types";
import { chapters, courses, lessons, resourceEntity, resources } from "src/storage/schema";

import * as schema from "../src/storage/schema";

import type { SupportedLanguages } from "@repo/shared";
import type { DatabasePg } from "src/common";

dotenv.config({ path: ".env" });

const allowedVideoExtensions = ["mp4", "mov", "webm", "ogg", "avi", "wmv", "quicktime"];
const allowedPresentationExtensions = ["ppt", "pptx", "odp"];
const allowedVideoContentTypes = [
  ...ALLOWED_VIDEO_FILE_TYPES,
  ...ALLOWED_VIDEO_FILE_TYPES.map((type) => type.split("/")[1]).filter(Boolean),
  ...allowedVideoExtensions,
];
const allowedPresentationContentTypes = [
  ...ALLOWED_PRESENTATION_FILE_TYPES,
  ...allowedPresentationExtensions,
];
const normalizedVideoContentTypes = allowedVideoContentTypes.map((type) => type.toLowerCase());
const normalizedPresentationContentTypes = allowedPresentationContentTypes.map((type) =>
  type.toLowerCase(),
);

const presentationReferenceRegex = /docs\.google\.com\/.*presentation|canva\.com\/.*design/i;

const normalizeContentType = (contentType: string | null | undefined) =>
  typeof contentType === "string" ? contentType.toLowerCase() : "";

const isExternalReference = (reference: string | null | undefined) =>
  !!reference && /^https?:\/\//i.test(reference);

const isPresentationReference = (reference: string | null | undefined) =>
  typeof reference === "string" &&
  (/(\.pptx|\.ppt)(\?|#|$)/i.test(reference) || presentationReferenceRegex.test(reference));

const buildSqlInClause = (values: string[]) =>
  sql`(${sql.join(
    values.map((value) => sql`${value}`),
    sql`, `,
  )})`;

const buildEmbedHtml = ({
  isVideo,
  isPresentation,
  isExternal,
  reference,
  resourceUrl,
  fileName,
}: {
  isVideo: boolean;
  isPresentation: boolean;
  isExternal: boolean;
  reference: string | null;
  resourceUrl: string;
  fileName: string | null;
}) =>
  match({ isVideo, isPresentation, isExternal })
    .with(
      { isPresentation: true, isExternal: false },
      () =>
        `<div data-node-type="presentation" data-source-type="internal" data-provider="self" data-src="${resourceUrl}"></div>`,
    )
    .with({ isPresentation: true, isExternal: true }, () =>
      match(reference ?? "")
        .when(
          (value) => /docs\.google\.com\/.*presentation/i.test(value),
          (value) =>
            `<div data-node-type="presentation" data-source-type="external" data-provider="google" data-src="${value}"></div>`,
        )
        .when(
          (value) => /canva\.com\/.*design/i.test(value),
          (value) =>
            `<div data-node-type="presentation" data-source-type="external" data-provider="canva" data-src="${value}"></div>`,
        )
        .otherwise(
          () =>
            '<div data-error="unsupported">External presentation URL is not supported. Please upload the file and replace this block.</div>',
        ),
    )
    .with(
      { isVideo: true, isExternal: false },
      () =>
        `<div data-node-type="video" data-source-type="internal" data-provider="self" data-src="${resourceUrl}"></div>`,
    )
    .with({ isVideo: true, isExternal: true }, () =>
      match(reference ?? "")
        .when(
          (value) => /youtube\.com|youtu\.be/i.test(value),
          (value) =>
            `<div data-node-type="video" data-source-type="external" data-provider="youtube" data-src="${value}"></div>`,
        )
        .when(
          (value) => /vimeo\.com/i.test(value),
          (value) =>
            `<div data-node-type="video" data-source-type="external" data-provider="vimeo" data-src="${value}"></div>`,
        )
        .otherwise(
          () =>
            "<p>External video URL is not supported. Please upload the file and replace this block.</p>",
        ),
    )
    .otherwise(
      () =>
        `<div data-node-type="downloadable-file" data-src="${resourceUrl}" data-name="${
          fileName ?? ""
        }"></div>`,
    );

async function runMigration() {
  const yargs = await import("yargs");
  const { hideBin } = await import("yargs/helpers");
  const argv = await yargs
    .default(hideBin(process.argv))
    .option("url", {
      alias: "u",
      description: "Instance URL",
      type: "string",
      demandOption: true,
    })
    .help().argv;

  const pg = postgres(process.env.DATABASE_URL!, { connect_timeout: 2 });
  const db = drizzle(pg, { schema }) as DatabasePg;

  const existingLessons = await db
    .select({
      ...getTableColumns(lessons),
      baseLanguage: sql<SupportedLanguages>`${courses.baseLanguage}`,
      resourceId: resources.id,
      resourceReference: resources.reference,
      resourceContentType: resources.contentType,
      resourceMetadata: resources.metadata,
    })
    .from(lessons)
    .innerJoin(
      resourceEntity,
      and(
        eq(resourceEntity.entityId, lessons.id),
        eq(resourceEntity.entityType, ENTITY_TYPE.LESSON),
      ),
    )
    .innerJoin(resources, eq(resources.id, resourceEntity.resourceId))
    .innerJoin(chapters, eq(chapters.id, lessons.chapterId))
    .innerJoin(courses, eq(courses.id, chapters.courseId))
    .where(
      and(
        eq(lessons.type, LESSON_TYPES.CONTENT),
        sql`(
          lower(${resources.contentType}) in ${buildSqlInClause(normalizedVideoContentTypes)}
          OR lower(${resources.contentType}) in ${buildSqlInClause(
            normalizedPresentationContentTypes,
          )}
          OR ${resources.contentType} = 'embed'
          OR ${
            resources.reference
          } ~* '(youtube\\.com|youtu\\.be|vimeo\\.com|docs\\.google\\.com/.*/presentation|canva\\.com/.*/design)'
        )`,
      ),
    );

  await Promise.all(
    existingLessons.map(async (lesson) => {
      const { resourceReference: reference, resourceContentType: contentType, resourceId } = lesson;

      const resourceUrl = `${argv.url}/api/lesson/lesson-resource/${resourceId}`;

      const metadata = lesson.resourceMetadata as Record<string, unknown> | null;
      const fileName =
        typeof metadata?.originalFilename === "string" ? metadata.originalFilename : null;

      const normalizedContentType = normalizeContentType(contentType);

      const isExternal = isExternalReference(reference);

      const isVideo =
        normalizedContentType.startsWith("video/") ||
        normalizedVideoContentTypes.includes(normalizedContentType);

      const isPresentation =
        normalizedPresentationContentTypes.includes(normalizedContentType) ||
        isPresentationReference(reference);

      const html = buildEmbedHtml({
        isVideo,
        isPresentation,
        isExternal,
        reference,
        resourceUrl,
        fileName,
      });

      const existingDescription = (() => {
        const description = lesson.description as Record<string, string> | null;
        return description?.[lesson.baseLanguage] ?? "";
      })();

      const mergedDescription = existingDescription
        ? `<p>${existingDescription}</p><p></p>${html}`
        : html;

      if (
        existingDescription.includes(String(lesson.resourceId)) ||
        (reference && existingDescription.includes(reference))
      ) {
        console.log("Skipping lesson (already contains resource):", lesson.id);
        return;
      }

      await db
        .update(lessons)
        .set({
          description: sql`
            jsonb_set(
              COALESCE(${lessons.description}, '{}'::jsonb),
              ARRAY[${lesson.baseLanguage}::text],
              to_jsonb(${sql`${mergedDescription}::text`}),
              true
            )
          `,
        })
        .where(eq(lessons.id, lesson.id));
    }),
  );

  console.log(`Successfully migrated ${existingLessons.length} lesson(s) of type CONTENT`);

  await pg.end();
}

runMigration().catch((err) => {
  console.error(err);
  process.exit(1);
});
